import React, { useState } from 'react';
import { PureChatPortfolio, PureChatDefiData, PureChatReturnsStats } from '../types/pureChatTypes';

interface Props {
  onPromptSelect: (prompt: string) => void;
  portfolio?: PureChatPortfolio;
  defiData?: PureChatDefiData;
  returnsStats?: PureChatReturnsStats[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface PromptSuggestion {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  description: string;
  requiresData: 'portfolio' | 'defi' | 'returns' | 'any';
  color: string;
}

const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  {
    id: 'portfolio-allocation',
    label: 'Portfolio Chart',
    prompt: 'Show me my portfolio allocation with an interactive pie chart',
    icon: '🥧',
    description: 'Interactive portfolio breakdown',
    requiresData: 'portfolio',
    color: '#3b82f6'
  },
  {
    id: 'risk-analysis',
    label: 'Risk Analysis',
    prompt: 'Analyze the risk vs return profile of my tokens with a scatter plot',
    icon: '📊',
    description: 'Risk and volatility analysis',
    requiresData: 'returns',
    color: '#10b981'
  },
  {
    id: 'defi-opportunities',
    label: 'DeFi Heatmap',
    prompt: 'Show me DeFi opportunities with a visual heatmap',
    icon: '🔥',
    description: 'DeFi protocol opportunities',
    requiresData: 'defi',
    color: '#f59e0b'
  },
  {
    id: 'correlation-matrix',
    label: 'Correlations',
    prompt: 'Create a correlation matrix showing how my tokens move together',
    icon: '🔗',
    description: 'Token correlation analysis',
    requiresData: 'returns',
    color: '#8b5cf6'
  },
  {
    id: 'complete-analysis',
    label: 'Full Analysis',
    prompt: 'Give me a complete portfolio analysis with all relevant charts and insights',
    icon: '🎯',
    description: 'Comprehensive analysis',
    requiresData: 'any',
    color: '#ef4444'
  },
  {
    id: 'performance-tracking',
    label: 'Performance',
    prompt: 'Show me time series analysis of my token returns and performance trends',
    icon: '📈',
    description: 'Historical performance',
    requiresData: 'returns',
    color: '#06b6d4'
  }
];

const PromptSuggestions: React.FC<Props> = ({
  onPromptSelect,
  portfolio,
  defiData,
  returnsStats,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [hoveredPrompt, setHoveredPrompt] = useState<string | null>(null);

  const isDataAvailable = (requiresData: string): boolean => {
    console.log('[PromptSuggestions] Checking data availability for:', requiresData, {
      portfolio: !!portfolio?.holdings?.length,
      portfolioCount: portfolio?.holdings?.length || 0,
      defi: !!defiData?.positionCount,
      defiPositions: defiData?.positionCount || 0,
      returns: !!returnsStats?.length,
      returnsCount: returnsStats?.length || 0
    });
    
    switch (requiresData) {
      case 'portfolio':
        return !!(portfolio?.holdings?.length);
      case 'defi':
        return !!(defiData?.positionCount);
      case 'returns':
        return !!(returnsStats?.length);
      case 'any':
        return !!(portfolio?.holdings?.length || defiData?.positionCount || returnsStats?.length);
      default:
        return true;
    }
  };

  const getDataStatus = () => {
    const hasPortfolio = !!(portfolio?.holdings?.length);
    const hasDefi = !!(defiData?.positionCount);
    const hasReturns = !!(returnsStats?.length);
    
    return {
      hasPortfolio,
      hasDefi,
      hasReturns,
      totalSources: [hasPortfolio, hasDefi, hasReturns].filter(Boolean).length
    };
  };

  const dataStatus = getDataStatus();

  if (isCollapsed) {
    return (
      <div className="prompt-suggestions collapsed">
        <button 
          className="expand-button"
          onClick={onToggleCollapse}
          title="Show Chart Suggestions"
        >
          <span className="expand-icon">📊</span>
          <span className="expand-text">Charts</span>
        </button>
      </div>
    );
  }

  return (
    <div className="prompt-suggestions expanded">
      {/* Header */}
      <div className="suggestions-header">
        <div className="header-content">
          <h3>
            <span className="header-icon">📊</span>
            Chart Suggestions
          </h3>
          <button 
            className="collapse-button"
            onClick={onToggleCollapse}
            title="Hide Suggestions"
          >
            ×
          </button>
        </div>
        
        {/* Data status indicators */}
        <div className="data-status">
          <div className="status-indicators">
            <div className={`status-indicator ${dataStatus.hasPortfolio ? 'active' : 'inactive'}`}>
              <span className="indicator-icon">💼</span>
              <span className="indicator-label">Portfolio</span>
            </div>
            <div className={`status-indicator ${dataStatus.hasDefi ? 'active' : 'inactive'}`}>
              <span className="indicator-icon">🏦</span>
              <span className="indicator-label">DeFi</span>
            </div>
            <div className={`status-indicator ${dataStatus.hasReturns ? 'active' : 'inactive'}`}>
              <span className="indicator-icon">📈</span>
              <span className="indicator-label">Returns</span>
            </div>
          </div>
          <div className="data-summary">
            {dataStatus.totalSources} of 3 data sources available
          </div>
        </div>
      </div>

      {/* Suggestion buttons */}
      <div className="suggestions-list">
        {PROMPT_SUGGESTIONS.map((suggestion) => {
          const isAvailable = isDataAvailable(suggestion.requiresData);
          const isHovered = hoveredPrompt === suggestion.id;
          
          return (
            <div key={suggestion.id} className="suggestion-item-wrapper">
              <button
                className={`suggestion-button ${isAvailable ? 'available' : 'disabled'}`}
                onClick={() => isAvailable && onPromptSelect(suggestion.prompt)}
                onMouseEnter={() => setHoveredPrompt(suggestion.id)}
                onMouseLeave={() => setHoveredPrompt(null)}
                disabled={!isAvailable}
                style={{
                  borderColor: isAvailable ? suggestion.color : '#e5e7eb',
                  background: isHovered && isAvailable 
                    ? `${suggestion.color}10` 
                    : 'white'
                }}
              >
                <div className="button-content">
                  <div className="button-icon" style={{ color: suggestion.color }}>
                    {suggestion.icon}
                  </div>
                  <div className="button-text">
                    <div className="button-label">{suggestion.label}</div>
                    <div className="button-description">{suggestion.description}</div>
                  </div>
                </div>
                
                {!isAvailable && (
                  <div className="disabled-overlay">
                    <span className="disabled-icon">🔒</span>
                    <span className="disabled-text">Data Required</span>
                  </div>
                )}
              </button>
              
              {/* Tooltip for disabled items */}
              {isHovered && !isAvailable && (
                <div className="suggestion-tooltip">
                  <div className="tooltip-content">
                    <div className="tooltip-title">Data Required</div>
                    <div className="tooltip-message">
                      {suggestion.requiresData === 'portfolio' && 'Connect a wallet to view portfolio data'}
                      {suggestion.requiresData === 'defi' && 'DeFi positions data needed'}
                      {suggestion.requiresData === 'returns' && 'Returns statistics data needed'}
                      {suggestion.requiresData === 'any' && 'Connect a wallet to access data'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick tip */}
      <div className="suggestions-footer">
        <div className="quick-tip">
          <span className="tip-icon">💡</span>
          <span className="tip-text">
            Click any button to add the prompt to your chat input
          </span>
        </div>
      </div>
    </div>
  );
};

export default PromptSuggestions;