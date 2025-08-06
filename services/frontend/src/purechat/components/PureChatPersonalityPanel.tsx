import React, { useState } from 'react';

interface Props {
  personality: string;
  onActivate(newPrompt: string): void;
}

const PureChatPersonalityPanel: React.FC<Props> = ({ personality, onActivate }) => {
  const [draft, setDraft] = useState(personality);

  return (
    <aside className="pc-personality-panel">
      <h2>Personality Prompt</h2>
      <textarea
        className="pc-personality-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste or edit personality prompt here..."
      />
      <button
        className="activate-btn"
        onClick={() => onActivate(draft)}
        disabled={draft.trim() === ''}
      >
        Activate
      </button>
    </aside>
  );
};

export default PureChatPersonalityPanel;
