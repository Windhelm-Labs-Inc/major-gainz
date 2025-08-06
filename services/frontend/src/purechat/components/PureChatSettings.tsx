import React, { useState } from 'react';
// Environment variables bundled at build time (injected by Vite)
declare const __WALLETCONNECT_PROJECT_ID__: string;

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
  const [isConnecting, setIsConnecting] = useState(false);
  const connectHashPack = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore – runtime import; types may not be available in build
      const [{ HashConnect }, { LedgerId }] = await Promise.all([
        import('hashconnect'),
        import('@hashgraph/sdk'),
      ]);
      /* eslint-enable @typescript-eslint/ban-ts-comment */

      const projectId =
        __WALLETCONNECT_PROJECT_ID__ && __WALLETCONNECT_PROJECT_ID__ !== 'YOUR_PROJECT_ID_HERE'
          ? __WALLETCONNECT_PROJECT_ID__
          : undefined;
      if (!projectId) {
        alert('HashPack requires a valid WalletConnect Project ID configured at build time.');
        return;
      }

      const appMetadata = {
        name: 'Quick Origins POC – PureChat',
        description: 'Pure chat interface',
        icons: ['https://www.hashpack.app/img/logo.svg'],
        url: window.location.origin,
      };

      const network = LedgerId.MAINNET; // PureChat uses mainnet for now
      const hashconnect = new HashConnect(network, projectId, appMetadata, false);
      await hashconnect.init();

      // Immediate account if paired previously
      if (hashconnect.connectedAccountIds.length > 0) {
        const acct = hashconnect.connectedAccountIds[0].toString();
        setAddress(acct);
        setNetwork('mainnet');
        return;
      }

      hashconnect.openPairingModal();
      const pairingData: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('User cancelled pairing.')), 60000);
        hashconnect.pairingEvent.on((pdata: any) => {
          clearTimeout(timeout);
          resolve(pdata);
        });
      });

      if (pairingData?.accountIds?.length) {
        setAddress(pairingData.accountIds[0]);
        setNetwork('mainnet');
      } else {
        alert('No Hedera account returned from HashPack.');
      }
    } catch (err) {
      console.error('[PureChatSettings] HashPack connect error', err);
      alert('Failed to connect to HashPack. See console for details.');
    } finally {
      setIsConnecting(false);
    }
  };
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

        {/* HashPack connect */}
        <div style={{ marginTop: '1rem' }}>
          {address ? (
            <p style={{ margin: 0 }}>✅ Connected: {address}</p>
          ) : (
            <button onClick={connectHashPack} disabled={isConnecting}>
              {isConnecting ? 'Connecting…' : 'Connect HashPack'}
            </button>
          )}
        </div>

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
