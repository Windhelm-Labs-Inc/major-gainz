import React, { useState } from 'react';

// Build-time constant expected to be provided by Vite define.
// Falls back to undefined so we can show a helpful message if missing.
declare const __WALLETCONNECT_PROJECT_ID__: string | undefined;

interface HashPackConnectProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
  isDisabled?: boolean;
}

const HashPackConnect: React.FC<HashPackConnectProps> = ({ onConnect, onDisconnect, isDisabled }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaired, setIsPaired] = useState(false);

  const connect = async () => {
    if (isDisabled || isConnecting) return;
    setIsConnecting(true);

    try {
      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore - runtime imports
      const [{ HashConnect }, { LedgerId }] = await Promise.all([
        import('hashconnect'),
        import('@hashgraph/sdk'),
      ]);
      /* eslint-enable @typescript-eslint/ban-ts-comment */

      const projectId = __WALLETCONNECT_PROJECT_ID__ && __WALLETCONNECT_PROJECT_ID__ !== 'YOUR_PROJECT_ID_HERE'
        ? __WALLETCONNECT_PROJECT_ID__
        : undefined;

      if (!projectId) {
        alert('HashPack pairing requires a WalletConnect Project ID at build time.');
        setIsConnecting(false);
        return;
      }

      const appMetadata = {
        name: 'Major Gainz',
        description: 'DeFi Operations – Mission Parameters',
        icons: ['https://www.hashpack.app/img/logo.svg'],
        url: window.location.origin,
      };

      // Quick localStorage scan for previous sessions
      const prior = (() => {
        try {
          for (const k in localStorage) {
            if (k.startsWith('hashconnect')) {
              const data = JSON.parse(localStorage.getItem(k) || 'null');
              if (data?.pairingData?.accountIds?.length) return data.pairingData.accountIds[0] as string;
              if (data?.pairings?.length && data.pairings[0].accountIds?.length) return data.pairings[0].accountIds[0] as string;
            }
          }
        } catch { /* ignore */ }
        return null;
      })();

      if (prior) {
        setIsPaired(true);
        onConnect(prior);
        setIsConnecting(false);
        return;
      }

      const network = LedgerId.MAINNET;
      const hashconnect = new HashConnect(network, projectId, appMetadata, false);
      await hashconnect.init();

      if (hashconnect.connectedAccountIds.length > 0) {
        const acct = hashconnect.connectedAccountIds[0].toString();
        setIsPaired(true);
        onConnect(acct);
        setIsConnecting(false);
        return;
      }

      hashconnect.openPairingModal();

      const pairingData: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('User did not approve connection in time.')), 60000);
        hashconnect.pairingEvent.on((pdata: any) => {
          clearTimeout(timeout);
          resolve(pdata);
        });
      });

      const address = pairingData?.accountIds?.[0];
      if (address) {
        setIsPaired(true);
        onConnect(address);
      } else {
        alert('No Hedera account returned from HashPack.');
      }
    } catch (e) {
      console.error('[HashPackConnect] Error:', e);
      alert('Failed to pair with HashPack. See console for details.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setIsPaired(false);
    onDisconnect();
  };

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {!isPaired ? (
        <button onClick={connect} disabled={!!isDisabled || isConnecting} className="hashpack-btn">
          {isConnecting ? 'Pairing…' : 'Pair HashPack'}
        </button>
      ) : (
        <button onClick={disconnect} className="disconnect-btn">
          Disconnect HashPack
        </button>
      )}
    </div>
  );
};

export default HashPackConnect;
