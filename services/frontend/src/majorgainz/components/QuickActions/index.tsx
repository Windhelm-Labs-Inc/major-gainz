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
    const actions: QuickAction[] = [
      { id: 'portfolio-chart', label: 'Portfolio Allocation Chart', prompt: 'Show me a portfolio allocation chart' },
      {
        id: 'risk-analysis',
        label: 'Risk Analysis Chart',
        prompt: 'Create a risk vs return scatter plot for my holdings'
      },
      {
        id: 'defi-heatmap',
        label: 'DeFi Heatmap',
        prompt: 'Show me a DeFi opportunities heatmap'
      }
    ];

    // If there is no DeFi data, leave the button enabled; the agent will fetch/handle gracefully
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
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
