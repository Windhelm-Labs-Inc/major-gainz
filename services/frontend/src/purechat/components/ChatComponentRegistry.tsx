import React, { Suspense } from 'react';
import { ChartContext, ComponentInstruction } from '../types/enhancedMessage';
import EnhancedPortfolioChart from './charts/EnhancedPortfolioChart';
import ReturnsVolatilityChart from './charts/ReturnsVolatilityChart';
import EnhancedDefiHeatmap from './charts/EnhancedDefiHeatmap';
import CorrelationMatrix from './charts/CorrelationMatrix';

// Import existing components for comparison
import PortfolioChart from '../../components/PortfolioChart';
import TokenHolderAnalysis from '../../components/TokenHolderAnalysis';

const COMPONENT_REGISTRY = {
  'portfolio-chart': EnhancedPortfolioChart,
  'returns-chart': ReturnsVolatilityChart,
  'defi-heatmap': EnhancedDefiHeatmap,
  'correlation-matrix': CorrelationMatrix,
  'token-analysis': TokenHolderAnalysis,
  'legacy-portfolio-chart': PortfolioChart, // For comparison
} as const;

export type ComponentType = keyof typeof COMPONENT_REGISTRY;

interface ChatComponentProps {
  instruction: ComponentInstruction;
  context: ChartContext;
  onError?: (error: Error) => void;
}

const ChatComponentSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div 
    className="chart-skeleton" 
    style={{ 
      height: height,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'loading 1.5s infinite',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#888'
    }}
  >
    Loading chart...
  </div>
);

const ChatComponentError: React.FC<{ error: string; height: number }> = ({ error, height }) => (
  <div 
    className="chart-error" 
    style={{ 
      height: height,
      background: '#fee2e2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: '#dc2626',
      padding: '20px',
      textAlign: 'center'
    }}
  >
    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Chart Error</div>
    <div style={{ fontSize: '14px' }}>{error}</div>
  </div>
);

export const ChatComponent: React.FC<ChatComponentProps> = ({ 
  instruction, 
  context, 
  onError 
}) => {
  const Component = COMPONENT_REGISTRY[instruction.type];
  
  if (!Component) {
    const error = `Unknown component type: ${instruction.type}`;
    onError?.(new Error(error));
    return (
      <ChatComponentError 
        error={error}
        height={instruction.height || 400}
      />
    );
  }

  // Prepare component props based on type
  const getComponentProps = () => {
    const baseProps = {
      title: instruction.title,
      height: instruction.height || 400,
      theme: 'light', // Could be dynamic based on user preference
      ...instruction.props
    };

    switch (instruction.type) {
      case 'portfolio-chart':
        if (!context.portfolio?.holdings) {
          throw new Error('Portfolio data required for portfolio chart');
        }
        return {
          ...baseProps,
          data: context.portfolio.holdings
        };

      case 'returns-chart':
        if (!context.returnsStats?.length) {
          throw new Error('Returns statistics required for returns chart');
        }
        return {
          ...baseProps,
          data: context.returnsStats
        };

      case 'defi-heatmap':
        if (!context.defiData) {
          throw new Error('DeFi data required for heatmap');
        }
        return {
          ...baseProps,
          data: context.defiData
        };

      case 'correlation-matrix':
        if (!context.returnsStats?.length) {
          throw new Error('Returns statistics required for correlation matrix');
        }
        if (context.returnsStats.length < 2) {
          throw new Error('At least 2 tokens required for correlation analysis');
        }
        return {
          ...baseProps,
          data: context.returnsStats
        };

      case 'token-analysis':
        if (!instruction.props.selectedToken || !context.userAddress) {
          throw new Error('Selected token and user address required for token analysis');
        }
        return {
          ...baseProps,
          selectedToken: instruction.props.selectedToken,
          userAddress: context.userAddress,
          onClose: () => {}, // Placeholder
        };

      case 'legacy-portfolio-chart':
        if (!context.portfolio?.holdings) {
          throw new Error('Portfolio data required for portfolio chart');
        }
        // Convert to legacy format
        const legacyHoldings = context.portfolio.holdings.map(h => ({
          ...h,
          tokenId: h.symbol // Use symbol as tokenId for legacy compatibility
        }));
        return {
          ...baseProps,
          data: legacyHoldings
        };

      default:
        return baseProps;
    }
  };

  try {
    const componentProps = getComponentProps();
    
    return (
      <div className={`chat-embedded-component ${instruction.type}`}>
        <Suspense 
          fallback={<ChatComponentSkeleton height={instruction.height || 400} />}
        >
          <Component {...componentProps} />
        </Suspense>
      </div>
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    onError?.(error instanceof Error ? error : new Error(errorMessage));
    
    return (
      <ChatComponentError 
        error={errorMessage}
        height={instruction.height || 400}
      />
    );
  }
};

// Helper function to validate if a component can be rendered with given context
export const canRenderComponent = (type: ComponentType, context: ChartContext): boolean => {
  switch (type) {
    case 'portfolio-chart':
    case 'legacy-portfolio-chart':
      return !!(context.portfolio?.holdings?.length);
    
    case 'returns-chart':
      return !!(context.returnsStats?.length);
    
    case 'defi-heatmap':
      return !!(context.defiData);
    
    case 'correlation-matrix':
      return !!(context.returnsStats?.length && context.returnsStats.length >= 2);
    
    case 'token-analysis':
      return !!(context.userAddress);
    
    default:
      return false;
  }
};

// Helper function to get available components for current context
export const getAvailableComponents = (context: ChartContext): ComponentType[] => {
  return Object.keys(COMPONENT_REGISTRY).filter(type => 
    canRenderComponent(type as ComponentType, context)
  ) as ComponentType[];
};

// Helper function to get component descriptions for agent
export const getComponentDescriptions = (): Record<ComponentType, string> => {
  return {
    'portfolio-chart': 'Interactive pie/doughnut chart showing portfolio allocation with selection and detailed stats',
    'returns-chart': 'Scatter plot and time series analysis of token returns vs volatility with risk metrics',
    'defi-heatmap': 'Visual heatmap of DeFi opportunities with APY, TVL, and risk analysis',
    'correlation-matrix': 'Color-coded correlation matrix showing how token returns move together',
    'token-analysis': 'Detailed holder analysis for specific tokens including percentile rankings',
    'legacy-portfolio-chart': 'Simple portfolio pie chart (legacy version for comparison)'
  };
};

export default ChatComponent;