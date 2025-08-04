import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import usePureChatAgent, { HederaNetwork } from '../hooks/usePureChatAgent';
import usePureChatPortfolio from '../hooks/usePureChatPortfolio';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'system';
  timestamp: Date;
}

interface Props {
  personality: string;
  hederaNetwork: HederaNetwork;
  walletAddress?: string;
  scratchpadContext?: string;
}

const PureChatChatWindow: React.FC<Props> = ({ 
  personality, 
  hederaNetwork, 
  walletAddress,
  scratchpadContext 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Welcome to PureChat! Connect a wallet in Settings to enable portfolio-aware responses.',
      sender: 'system',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const lastSentScratchpad = useRef<string>('');

  // Fetch portfolio and DeFi data
  const { portfolio, returnsStats, defiData, loading, error } = usePureChatPortfolio(walletAddress);

  // Create agent with portfolio + DeFi context
  const agentExecutor = usePureChatAgent(
    personality, 
    hederaNetwork, 
    portfolio, 
    returnsStats,
    defiData,
    scratchpadContext
  );

  const sendMessage = async () => {
    if (!inputValue.trim() || !agentExecutor) return;

    // Handle scratchpad context changes
    const currentScratchpad = scratchpadContext || 'No active context';
    const scratchpadChanged = currentScratchpad !== lastSentScratchpad.current;

    let messageToSend = inputValue.trim();
    if (scratchpadChanged && currentScratchpad !== 'No active context') {
      messageToSend += `\n\n[Updated Context: ${currentScratchpad}]`;
      lastSentScratchpad.current = currentScratchpad;
    } else if (scratchpadChanged) {
      lastSentScratchpad.current = currentScratchpad;
    }

    const userMsg: Message = {
      id: messages.length + 1,
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    try {
      const res = await agentExecutor.invoke({ input: messageToSend });
      const reply = res?.output ?? JSON.stringify(res);
      const systemMsg: Message = {
        id: userMsg.id + 1,
        text: reply,
        sender: 'system',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, systemMsg]);
    } catch (err) {
      console.error('[PureChat] Agent error', err);
      setMessages(prev => [
        ...prev,
        {
          id: userMsg.id + 1,
          text: 'Error processing request. See console.',
          sender: 'system',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="purechat-window">
      {/* Portfolio & DeFi status banner */}
      {walletAddress && (
        <div style={{ 
          padding: '0.5rem', 
          backgroundColor: loading ? '#fff3cd' : error ? '#f8d7da' : '#d1ecf1',
          borderBottom: '1px solid #dee2e6',
          fontSize: '0.875rem'
        }}>
          {loading && '📊 Loading portfolio & DeFi data...'}
          {error && `⚠️ Data unavailable: ${error}`}
          {portfolio && (
            <>
              ✅ Portfolio: $${portfolio.totalValue.toFixed(2)} across ${portfolio.holdings.length} tokens
              {defiData && ` | DeFi: $${defiData.totalValueLocked.toFixed(2)} TVL in ${defiData.positionCount} positions`}
            </>
          )}
          {walletAddress && <span style={{ float: 'right' }}>🔗 {walletAddress}</span>}
        </div>
      )}

      <div className="chat-messages">
        {messages.map(m => (
          <div key={m.id} className={`message ${m.sender}`}>
            <div className="message-content">
              {m.sender === 'system' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {m.text}
                </ReactMarkdown>
              ) : (
                <span>{m.text}</span>
              )}
              <span className="message-time">{time(m.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here..."
        />
        <button disabled={!inputValue.trim()} onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
};

export default PureChatChatWindow;