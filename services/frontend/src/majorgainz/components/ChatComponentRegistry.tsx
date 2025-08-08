import React, { lazy, Suspense } from 'react';
import { ComponentInstruction, ComponentType, ChartContext } from '../types';

// Lazy load chart components for better performance
const PortfolioChart = lazy(() => import('./Charts/PortfolioChart'));
const RiskScatter = lazy(() => import('./Charts/RiskScatter'));
const DefiHeatmap = lazy(() => import('./Charts/DefiHeatmap'));
const CorrelationMatrix = lazy(() => import('./Charts/CorrelationMatrix'));
const TokenHolderAnalysis = lazy(() => import('./Charts/TokenHolderAnalysis'));
const MGTokenHoldersInteractive = lazy(() => import('./Charts/MGTokenHoldersInteractive'));

interface ChatComponentRegistryProps {
  instruction: ComponentInstruction;
  context?: ChartContext;
  onTokenSelect?: (symbol: string, amount?: number) => void;
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
    overflow: 'hidden',
    maxHeight: height ? `${height}px` : undefined
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
    <div style={{ height: height ? `${height - (title ? 48 : 0)}px` : 'auto' }}>
      {children}
    </div>
  </div>
);

const ChatComponentRegistry: React.FC<ChatComponentRegistryProps> = ({
  instruction,
  context,
  onTokenSelect,
}) => {
  const { type, title, height = 400, props = {} } = instruction;
  // Allow per-component default sizing. Make portfolio chart significantly larger by default.
  let resolvedHeight = height;
  if (type === 'portfolio-chart' && (typeof height !== 'number' || height < 560)) {
    resolvedHeight = 560;
  }
  // portfolio-table removed per updated requirements
  if (type === 'defi-heatmap' && (typeof height !== 'number' || height < 600)) {
    resolvedHeight = 700;
  }
  if (type === 'risk-scatter' && (typeof height !== 'number' || height < 420)) {
    resolvedHeight = 480;
  }

  const renderComponent = () => {
    try {
      switch (type) {
        case 'portfolio-chart':
          return (
            <Suspense fallback={<LoadingFallback height={resolvedHeight} />}>
              <PortfolioChart
                portfolio={context?.portfolio}
                height={resolvedHeight}
                onTokenSelect={onTokenSelect}
                {...props}
              />
            </Suspense>
          );

        // portfolio-table intentionally removed

        case 'risk-scatter':
          return (
            <Suspense fallback={<LoadingFallback height={resolvedHeight} />}>
              <RiskScatter
                returnsStats={context?.returnsStats}
                height={resolvedHeight}
                {...props}
              />
            </Suspense>
          );

        case 'defi-heatmap':
          return (
            <Suspense fallback={<LoadingFallback height={resolvedHeight} />}>
              <DefiHeatmap
                defiData={context?.defiData}
                height={resolvedHeight}
                {...props}
              />
            </Suspense>
          );


        case 'correlation-matrix':
          return (
            <Suspense fallback={<LoadingFallback height={resolvedHeight} />}>
              <CorrelationMatrix
                returnsStats={context?.returnsStats}
                height={resolvedHeight}
                {...props}
              />
            </Suspense>
          );

        case 'token-analysis':
          return (
            <Suspense fallback={<LoadingFallback height={resolvedHeight} />}>
              <TokenHolderAnalysis
                tokenData={((): any => {
                  // Priority: explicit tokenSymbol prop → selectedToken → first holding
                  const explicit = props.tokenData
                    || (props.tokenSymbol && context?.portfolio?.holdings?.find(h => h.symbol === props.tokenSymbol))
                    || context?.selectedToken
                    || context?.portfolio?.holdings?.[0];

                  if (explicit) return explicit;

                  // If a tokenSymbol was provided but not found in holdings, construct minimal tokenData
                  if (props.tokenSymbol && typeof props.tokenSymbol === 'string') {
                    return { symbol: props.tokenSymbol, tokenId: props.tokenSymbol, amount: 0, usd: 0, percent: 0 };
                  }
                  return undefined;
                })()}
                userAddress={context?.userAddress}
                onAddressClick={props.onAddressClick}
                height={resolvedHeight}
                {...props}
              />
            </Suspense>
          );

        case 'mg-token-holders':
          return (
            <Suspense fallback={<LoadingFallback height={resolvedHeight} />}>
              <MGTokenHoldersInteractive
                holders={context?.holders}
                percentiles={context?.percentiles}
                portfolio={context?.portfolio}
                height={resolvedHeight}
                {...props}
              />
            </Suspense>
          );

        default:
          return (
            <ErrorFallback 
              error={`Unknown component type: ${type}`}
              height={resolvedHeight}
            />
          );
      }
    } catch (error) {
      console.error(`Error rendering component ${type}:`, error);
      return (
        <ErrorFallback 
          error={`Failed to render ${type}: ${error}`}
          height={resolvedHeight}
        />
      );
    }
  };

  return (
    <ComponentWrapper title={title} height={resolvedHeight}>
      {renderComponent()}
    </ComponentWrapper>
  );
};

export default ChatComponentRegistry;
