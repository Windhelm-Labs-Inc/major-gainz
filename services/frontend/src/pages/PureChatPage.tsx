import React, { useState, useEffect } from 'react';
import PureChatPersonalityPanel from '../purechat/components/PureChatPersonalityPanel';
import PureChatChatWindow from '../purechat/components/PureChatChatWindow';
import PureChatSettings from '../purechat/components/PureChatSettings';
import { DEFAULT_PURECHAT_PERSONALITY } from '../purechat/utils/defaultPersonality';
import usePureChatScratchpad from '../purechat/hooks/usePureChatScratchpad';
import '../purechat/styles/pureChatLayout.css';

const PureChatPage: React.FC = () => {
  const [personality, setPersonality] = useState<string>(DEFAULT_PURECHAT_PERSONALITY);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('testnet');

  // Pure-Chat scratchpad
  const { 
    scratchpadContext, 
    updateUserContext,
    updatePortfolioSummary,
    updateDefiSummary,
    clearScratchpad 
  } = usePureChatScratchpad();

  // Update user context when address/network changes
  useEffect(() => {
    if (address) {
      updateUserContext({
        address,
        network,
        connectionType: 'HashPack', // Could be expanded later
      });
    } else {
      clearScratchpad();
    }
  }, [address, network, updateUserContext, clearScratchpad]);

  return (
    <div className="purechat-container purechat-page">
      <PureChatPersonalityPanel personality={personality} onActivate={setPersonality} />

      <PureChatChatWindow 
        personality={personality} 
        hederaNetwork={network}
        walletAddress={address}
        scratchpadContext={scratchpadContext}
      />

      {/* Settings trigger */}
      <button
        className="pc-settings-btn"
        onClick={() => setSettingsOpen(true)}
        style={{ position: 'absolute', top: 10, right: 10 }}
      >
        ⚙ Settings
      </button>

      <PureChatSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(addr, net) => {
          setAddress(addr);
          setNetwork(net);
        }}
        initialAddress={address}
        initialNetwork={network}
      />
    </div>
  );
};

export default PureChatPage;
