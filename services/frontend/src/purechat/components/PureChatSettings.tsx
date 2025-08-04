import React, { useState } from 'react';

interface Props {
  open: boolean;
  onClose(): void;
  onSave(address: string, network: 'mainnet' | 'testnet'): void;
  initialAddress?: string;
  initialNetwork?: 'mainnet' | 'testnet';
}

const PureChatSettings: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  initialAddress = '',
  initialNetwork = 'testnet',
}) => {
  const [address, setAddress] = useState(initialAddress);
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(initialNetwork);

  if (!open) return null;

  return (
    <div className="pc-settings-overlay">
      <div className="pc-settings-modal">
        <h2>Settings</h2>
        <label>
          Address
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0.0.xxxxx"
          />
        </label>

        <label>
          Network
          <div className="network-options">
            <label>
              <input
                type="radio"
                value="mainnet"
                checked={network === 'mainnet'}
                onChange={() => setNetwork('mainnet')}
              />
              Mainnet
            </label>
            <label>
              <input
                type="radio"
                value="testnet"
                checked={network === 'testnet'}
                onChange={() => setNetwork('testnet')}
              />
              Testnet
            </label>
          </div>
        </label>

        <div className="btn-row">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => {
              onSave(address, network);
              onClose();
            }}
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PureChatSettings;
