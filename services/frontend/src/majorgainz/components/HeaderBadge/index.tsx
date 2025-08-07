import React from 'react';
import styles from './headerBadge.module.css';

interface HeaderBadgeProps {
  walletAddress?: string;
  balanceUsd?: number;
  isLoading?: boolean;
  error?: string;
  onClick?: () => void;
}

const HeaderBadge: React.FC<HeaderBadgeProps> = ({
  walletAddress,
  balanceUsd,
  isLoading = false,
  error,
  onClick
}) => {
  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: number) => {
    if (balance >= 1000000) {
      return `$${(balance / 1000000).toFixed(1)}M`;
    } else if (balance >= 1000) {
      return `$${(balance / 1000).toFixed(1)}K`;
    } else {
      return `$${balance.toFixed(2)}`;
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <header className={styles.headerBadge}>
      <div 
        className={styles.badge}
        onClick={handleClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? "Open wallet settings" : "Wallet information"}
      >
        {/* Wallet Address */}
        <div className={styles.walletAddress}>
          {walletAddress ? formatAddress(walletAddress) : (
            <button
              onClick={onClick}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--mg-blue-700)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'underline',
              }}
            >
              Connect Wallet
            </button>
          )}
        </div>

        {/* Chevron Icon */}
        <div className={styles.chevron} aria-hidden="true">
          ▲
        </div>

        {/* Balance */}
        <div className={styles.balance}>
          {error ? (
            <span className={styles.error}>Error</span>
          ) : isLoading ? (
            <span className={styles.loading}>Loading...</span>
          ) : balanceUsd !== undefined ? (
            formatBalance(balanceUsd)
          ) : (
            '$0.00'
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderBadge;
