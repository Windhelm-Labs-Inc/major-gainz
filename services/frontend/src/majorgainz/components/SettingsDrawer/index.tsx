import React, { useState, useEffect } from 'react';
import { HederaNetwork } from '../../types';
import styles from './settingsDrawer.module.css';
import HashPackConnect from '../Wallet/HashPackConnect';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress?: string;
  onAddressChange?: (address: string) => void;
  balanceUsd?: number;
  isConnecting?: boolean;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  userAddress,
  onAddressChange,
  balanceUsd,
  isConnecting = false,
}) => {
  const [addressInput, setAddressInput] = useState(userAddress || '');
  const [addressError, setAddressError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  // Fixed network (mainnet only for Major Gainz)
  const network: HederaNetwork = 'mainnet';

  useEffect(() => {
    if (userAddress) {
      setAddressInput(userAddress);
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('idle');
    }
  }, [userAddress]);

  useEffect(() => {
    if (isConnecting) {
      setConnectionStatus('connecting');
    }
  }, [isConnecting]);

  const validateAddress = (address: string): boolean => {
    // Basic Hedera account ID validation (e.g., 0.0.123456)
    const hederaAccountPattern = /^0\.0\.\d+$/;
    return hederaAccountPattern.test(address.trim());
  };

  const handleAddressSubmit = () => {
    const trimmedAddress = addressInput.trim();

    if (!trimmedAddress) {
      setAddressError('Address is required');
      return;
    }

    if (!validateAddress(trimmedAddress)) {
      setAddressError('Invalid Hedera account ID format (expected: 0.0.123456)');
      return;
    }

    setAddressError('');
    setConnectionStatus('connecting');

    if (onAddressChange) {
      onAddressChange(trimmedAddress);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddressSubmit();
    }
  };

  const handleDisconnect = () => {
    setAddressInput('');
    setAddressError('');
    setConnectionStatus('idle');

    if (onAddressChange) {
      onAddressChange('');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatBalance = (balance: number) => {
    if (balance >= 1000000) {
      return `$${(balance / 1000000).toFixed(2)}M`;
    } else if (balance >= 1000) {
      return `$${(balance / 1000).toFixed(2)}K`;
    } else {
      return `$${balance.toFixed(2)}`;
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`${styles.overlay} ${isOpen ? styles.open : ''}`}
        onClick={handleOverlayClick}
      />

      {/* Drawer */}
      <div className={`${styles.drawer} ${isOpen ? styles.open : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>MISSION PARAMETERS</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Target Wallet */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Target Wallet</h3>
            <div className={styles.sectionDescription}>
              Enter a Hedera mainnet account ID to establish mission context. Or pair with HashPack below.
            </div>

            {/* Optional HashPack pairing */}
            <div style={{ marginBottom: 12 }}>
              <HashPackConnect
                onConnect={(addr) => onAddressChange && onAddressChange(addr)}
                onDisconnect={() => onAddressChange && onAddressChange('')}
                isDisabled={connectionStatus === 'connecting'}
              />
            </div>

            {/* Connected Wallet Info */}
            {userAddress && connectionStatus === 'connected' && (
              <div className={styles.walletInfo}>
                <div className={styles.walletAddress}>{userAddress}</div>
                <div className={styles.walletBalance}>
                  {balanceUsd !== undefined ? formatBalance(balanceUsd) : 'Loading...'}
                </div>
                <div className={styles.networkBadge}>{network.toUpperCase()}</div>
              </div>
            )}

            {/* Address Input */}
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="wallet-address">
                Hedera Account ID
              </label>
              <input
                id="wallet-address"
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0.0.123456"
                className={`${styles.input} ${addressError ? styles.error : ''}`}
                disabled={connectionStatus === 'connecting'}
              />
              {addressError && (
                <div className={`${styles.status} ${styles.statusError}`}>{addressError}</div>
              )}
            </div>

            {/* Connection Actions */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {!userAddress || connectionStatus !== 'connected' ? (
                <button
                  className={styles.button}
                  onClick={handleAddressSubmit}
                  disabled={connectionStatus === 'connecting' || !addressInput.trim()}
                >
                  {connectionStatus === 'connecting' ? 'Connecting…' : 'Set Target'}
                </button>
              ) : (
                <button
                  className={`${styles.button} ${styles.buttonDanger}`}
                  onClick={handleDisconnect}
                >
                  Clear Target
                </button>
              )}
            </div>
          </div>

          <div className={styles.divider} />

          {/* Network Information */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Network Status</h3>
            <div className={styles.sectionDescription}>
              Major Gainz operates exclusively on Hedera mainnet for maximum security and real-time data.
            </div>

            <div className={styles.walletInfo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--mg-mint-500)' }} />
                <strong>Hedera Mainnet</strong>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--mg-gray-600)' }}>
                Production network • Real transactions • Live data
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Data & Privacy */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Data & Privacy</h3>
            <div className={styles.sectionDescription}>
              All data is fetched in real-time from public blockchain sources. No private keys or sensitive information is stored.
            </div>
            <ul style={{ fontSize: '0.875rem', color: 'var(--mg-gray-600)', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li>Portfolio data is read-only from public ledger</li>
              <li>Chat sessions are not permanently stored</li>
              <li>All API calls are encrypted in transit</li>
              <li>No wallet private keys required or stored</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsDrawer;
