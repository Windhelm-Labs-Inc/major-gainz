import React from 'react';
import { Portfolio, DefiData } from '../../types';
import styles from './quickActions.module.css';

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'mint';
  disabled?: boolean;
}

interface QuickActionsProps {
  onActionSelect: (prompt: string) => void;
  portfolio?: Portfolio;
  defiData?: DefiData;
  isLoading?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onActionSelect,
  portfolio,
  defiData,
  isLoading = false
}) => {
  const getActions = (): QuickAction[] => {
    const actions: QuickAction[] = [];

    // Always available actions
    actions.push({
      id: 'portfolio-chart',
      label: 'Portfolio Chart',
      prompt: 'Show me a portfolio allocation chart',
      icon: '📊',
      variant: 'primary'
    });

    actions.push({
      id: 'defi-analysis',
      label: 'DeFi Analysis',
      prompt: 'Analyze my DeFi positions and show opportunities',
      icon: '🏛️',
      variant: 'mint'
    });

    actions.push({
      id: 'risk-analysis',
      label: 'Risk Analysis',
      prompt: 'Create a risk vs return scatter plot for my holdings',
      icon: '⚠️'
    });

    // Conditional actions based on data availability
    if (portfolio?.holdings?.length) {
      actions.push({
        id: 'correlation',
        label: 'Correlations',
        prompt: 'Show me correlation matrix between my holdings',
        icon: '🔗'
      });

      // Token-specific action for largest holding
      const topHolding = portfolio.holdings[0];
      if (topHolding) {
        actions.push({
          id: 'token-analysis',
          label: `${topHolding.symbol} Analysis`,
          prompt: `Analyze ${topHolding.symbol} token holder distribution`,
          icon: '🔍'
        });
      }
    }

    if (defiData?.positionCount) {
      actions.push({
        id: 'defi-heatmap',
        label: 'DeFi Heatmap',
        prompt: 'Show me a DeFi opportunities heatmap',
        icon: '🗺️'
      });
    }

    return actions;
  };

  const actions = getActions();

  const handleActionClick = (action: QuickAction) => {
    if (action.disabled || isLoading) return;
    onActionSelect(action.prompt);
  };

  const getButtonClass = (action: QuickAction) => {
    const classes = [styles.actionButton];
    
    if (action.variant === 'primary') classes.push(styles.primary);
    if (action.variant === 'mint') classes.push(styles.mint);
    if (isLoading) classes.push(styles.loading);
    
    return classes.join(' ');
  };

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={styles.quickActions}>
      <div className={styles.actionRow}>
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action)}
            disabled={action.disabled || isLoading}
            className={getButtonClass(action)}
            aria-label={`Quick action: ${action.label}`}
            title={action.prompt}
          >
            {action.icon && (
              <span className={styles.icon} aria-hidden="true">
                {action.icon}
              </span>
            )}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
