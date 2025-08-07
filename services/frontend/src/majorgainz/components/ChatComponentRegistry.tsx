import React, { lazy, Suspense } from 'react';
import { ComponentInstruction, ComponentType, ChartContext } from '../types';

// Lazy load chart components for better performance
const PortfolioChart = lazy(() => import('./Charts/PortfolioChart'));
const RiskScatter = lazy(() => import('./Charts/RiskScatter'));
const DefiHeatmap = lazy(() => import('./Charts/DefiHeatmap'));
const CorrelationMatrix = lazy(() => import('./Charts/CorrelationMatrix'));
const TokenHolderAnalysis = lazy(() => import('./Charts/TokenHolderAnalysis'));

interface ChatComponentRegistryProps {
  instruction: ComponentInstruction;
  context?: ChartContext;
}

const LoadingFallback: React.FC<{ height?: number }> = ({ height = 400 }) => (
  <div
    style={{
      height: `${height}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--mg-gray-100)',
      color: 'var(--mg-gray-600)',
      borderRadius: 'var(--mg-radius-md)'
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div style={{ 
        width: '32px', 
        height: '32px', 
        border: '3px solid var(--mg-gray-300)',
        borderTop: '3px solid var(--mg-blue-500)',
        borderRadius: '50%',
        animation: 'var(--mg-animate-spin)',
        margin: '0 auto 8px'
      }} />
      <div style={{ fontSize: '0.875rem' }}>Loading chart...</div>
    </div>
  </div>
);

const ErrorFallback: React.FC<{ error: string; height?: number }> = ({ error, height = 400 }) => (
  <div
    style={{
      height: `${height}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fee2e2',
      border: '1px solid #fecaca',
      borderRadius: 'var(--mg-radius-md)',
      padding: '20px',
      textAlign: 'center'
    }}
  >
    <div>
      <div style={{ 
        fontSize: '24px', 
        marginBottom: '8px' 
      }}>
        ⚠️
      </div>
      <div style={{ 
        fontSize: '0.875rem', 
        color: '#dc2626',
        marginBottom: '4px',
        fontWeight: '600'
      }}>
        Chart Error
      </div>
      <div style={{ 
        fontSize: '0.75rem', 
        color: '#991b1b' 
      }}>
        {error}
      </div>
    </div>
  </div>
);

const ComponentWrapper: React.FC<{
  children: React.ReactNode;
  title?: string;
  height?: number;
}> = ({ children, title, height }) => (
  <div style={{
    background: 'var(--mg-white)',
    border: '1px solid var(--mg-gray-200)',
    borderRadius: 'var(--mg-radius-md)',
    overflow: 'hidden'
  }}>
    {title && (
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--mg-gray-200)',
        background: 'var(--mg-gray-50)',
        fontSize: '0.875rem',
        fontWeight: '600',
        color: 'var(--mg-gray-900)'
      }}>
        {title}
      </div>
    )}
    <div style={{ height: height ? `${height}px` : 'auto' }}>
      {children}
    </div>
  </div>
);

const ChatComponentRegistry: React.FC<ChatComponentRegistryProps> = ({
  instruction,
  context
}) => {
  const { type, title, height = 400, props = {} } = instruction;

  const renderComponent = () => {
    try {
      switch (type) {
        case 'portfolio-chart':
          return (
            <Suspense fallback={<LoadingFallback height={height} />}>
              <PortfolioChart
                portfolio={context?.portfolio}
                height={height}
                {...props}
              />
            </Suspense>
          );

        case 'risk-scatter':
          return (
            <Suspense fallback={<LoadingFallback height={height} />}>
              <RiskScatter
                returnsStats={context?.returnsStats}
                height={height}
                {...props}
              />
            </Suspense>
          );

        case 'defi-heatmap':
          return (
            <Suspense fallback={<LoadingFallback height={height} />}>
              <DefiHeatmap
                defiData={context?.defiData}
                height={height}
                {...props}
              />
            </Suspense>
          );

        case 'correlation-matrix':
          return (
            <Suspense fallback={<LoadingFallback height={height} />}>
              <CorrelationMatrix
                returnsStats={context?.returnsStats}
                height={height}
                {...props}
              />
            </Suspense>
          );

        case 'token-analysis':
          return (
            <Suspense fallback={<LoadingFallback height={height} />}>
              <TokenHolderAnalysis
                tokenData={props.tokenData || context?.portfolio?.holdings?.[0]}
                height={height}
                {...props}
              />
            </Suspense>
          );

        default:
          return (
            <ErrorFallback 
              error={`Unknown component type: ${type}`}
              height={height}
            />
          );
      }
    } catch (error) {
      console.error(`Error rendering component ${type}:`, error);
      return (
        <ErrorFallback 
          error={`Failed to render ${type}: ${error}`}
          height={height}
        />
      );
    }
  };

  return (
    <ComponentWrapper title={title} height={height}>
      {renderComponent()}
    </ComponentWrapper>
  );
};

export default ChatComponentRegistry;
