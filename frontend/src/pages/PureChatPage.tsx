import React, { useState } from 'react';
import PureChatPersonalityPanel from '../purechat/components/PureChatPersonalityPanel';
import PureChatChatWindow from '../purechat/components/PureChatChatWindow';
import PureChatSettings from '../purechat/components/PureChatSettings';
import { DEFAULT_PURECHAT_PERSONALITY } from '../purechat/utils/defaultPersonality';
import '../purechat/styles/pureChatLayout.css';

const PureChatPage: React.FC = () => {
  const [personality, setPersonality] = useState<string>(DEFAULT_PURECHAT_PERSONALITY);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('testnet');

  return (
    <div className="purechat-container">
      <PureChatPersonalityPanel personality={personality} onActivate={setPersonality} />

      <PureChatChatWindow personality={personality} hederaNetwork={network} />

      {/* Settings trigger */}
      <button className="pc-settings-btn" onClick={() => setSettingsOpen(true)} style={{position:'absolute',top:10,right:10}}>
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
