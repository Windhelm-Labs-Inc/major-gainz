import React from 'react';
import { Portfolio, DefiData, ReturnsStats } from '../../types';

interface PromptSuggestionsProps {
  onPromptSelect: (prompt: string) => void;
  portfolio?: Portfolio;
  defiData?: DefiData;
  returnsStats?: ReturnsStats[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const PromptSuggestions: React.FC<PromptSuggestionsProps> = ({
  onPromptSelect,
  portfolio,
  defiData,
  returnsStats,
  isCollapsed = true,
  onToggleCollapse
}) => {
  const getContextualPrompts = () => {
    const prompts: string[] = [];
    
    // Base prompts always available
    prompts.push(
      "What's the current state of my portfolio?",
      "Show me a portfolio allocation chart",
      "Analyze my DeFi positions"
    );
    
    // Portfolio-specific prompts
    if (portfolio?.holdings?.length) {
      prompts.push(
        `Analyze the risk of my ${portfolio.holdings.length} token holdings`,
        "Which tokens are most volatile in my portfolio?",
        "Show me correlation between my holdings"
      );
      
      // Token-specific prompts
      const topHolding = portfolio.holdings[0];
      if (topHolding) {
        prompts.push(`Tell me about ${topHolding.symbol} token holder distribution`);
      }
    }
    
    // DeFi-specific prompts
    if (defiData?.positionCount) {
      prompts.push(
        "Compare APY across my DeFi positions",
        "Show me a DeFi heatmap with opportunities",
        "What's my total DeFi exposure?"
      );
    }
    
    // Returns data prompts
    if (returnsStats?.length) {
      prompts.push(
        "Create a risk vs return scatter plot",
        "Which assets have the best Sharpe ratio?"
      );
    }
    
    return prompts;
  };

  const prompts = getContextualPrompts();

  if (isCollapsed && onToggleCollapse) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        zIndex: 30
      }}>
        <button
          onClick={onToggleCollapse}
          style={{
            background: 'var(--mg-mint-500)',
            color: 'var(--mg-white)',
            border: 'none',
            borderRadius: 'var(--mg-radius-pill)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--mg-shadow-lg)',
            transition: 'all var(--mg-transition)',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}
          aria-label="Show Mission Context Assist"
        >
          Mission Context Assist
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      width: '320px',
      maxHeight: '400px',
      background: 'var(--mg-white)',
      border: '1px solid var(--mg-gray-300)',
      borderRadius: 'var(--mg-radius-lg)',
      boxShadow: 'var(--mg-shadow-lg)',
      zIndex: 30,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--mg-gray-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--mg-gray-50)'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '0.875rem',
          fontWeight: '600',
          color: 'var(--mg-gray-900)'
        }}>
          Prompt Suggestions
        </h3>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--mg-gray-600)',
              fontSize: '16px'
            }}
            aria-label="Hide suggestions"
          >
            ✕
          </button>
        )}
      </div>
      
      {/* Prompts List */}
      <div style={{
        maxHeight: '320px',
        overflowY: 'auto',
        padding: '8px'
      }}>
        {prompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onPromptSelect(prompt)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              margin: '2px 0',
              background: 'none',
              border: '1px solid transparent',
              borderRadius: 'var(--mg-radius)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--mg-gray-700)',
              transition: 'all var(--mg-transition-fast)',
              lineHeight: '1.4'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--mg-mint-100)';
              e.currentTarget.style.borderColor = 'var(--mg-mint-300)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
      
      {/* Footer */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--mg-gray-200)',
        background: 'var(--mg-gray-50)',
        fontSize: '0.75rem',
        color: 'var(--mg-gray-600)',
        textAlign: 'center'
      }}>
        Click any suggestion to use it
      </div>
    </div>
  );
};

export default PromptSuggestions;
