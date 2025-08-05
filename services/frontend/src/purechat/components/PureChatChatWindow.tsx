import React, { useState, useRef } from 'react';
import usePureChatAgent, { HederaNetwork } from '../hooks/usePureChatAgent';
import usePureChatPortfolio from '../hooks/usePureChatPortfolio';
import EnhancedMessageRenderer from './EnhancedMessageRenderer';
import PromptSuggestions from './PromptSuggestions';
import { EnhancedMessage, ChartContext } from '../types/enhancedMessage';
import { parseAgentResponse } from '../utils/responseParser';
import '../styles/enhancedCharts.css';

// Using EnhancedMessage from types instead of local interface

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
  const [messages, setMessages] = useState<EnhancedMessage[]>([
    {
      id: 1,
      text: 'Welcome to PureChat! Connect a wallet in Settings to enable portfolio-aware responses with interactive charts.',
      sender: 'system',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(true);
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

  const [isProcessing, setIsProcessing] = useState(false);

  const sendMessage = async () => {
    if (!inputValue.trim() || !agentExecutor || isProcessing) return;

    setIsProcessing(true);

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

    const userMsg: EnhancedMessage = {
      id: messages.length + 1,
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // Add processing indicator
          const processingMsg: EnhancedMessage = {
      id: userMsg.id + 0.5, // Use decimal to insert between messages
      text: 'Working on your request…',
      sender: 'system',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, processingMsg]);

    try {
      const res = await agentExecutor.invoke({ input: messageToSend });
      const reply = res?.output ?? JSON.stringify(res);
      
      // Parse the response to extract chart instructions
      console.log('[PureChat] Raw agent response:', reply);
      const { text, components } = parseAgentResponse(reply);
      console.log('[PureChat] Parsed components:', components);
      console.log('[PureChat] Clean text:', text);
      
      const systemMsg: EnhancedMessage = {
        id: userMsg.id + 1,
        text,
        sender: 'system',
        timestamp: new Date(),
        components: components.length > 0 ? components : undefined,
      };
      
      // Remove processing indicator and add actual response
      setMessages(prev => [
        ...prev.filter(m => m.id !== processingMsg.id), // Remove processing message
        systemMsg
      ]);
    } catch (err) {
      console.error('[PureChat] Agent error', err);
      
      // Remove processing indicator and add error message
      setMessages(prev => [
        ...prev.filter(m => m.id !== processingMsg.id), // Remove processing message
        {
          id: userMsg.id + 1,
          text: 'Error processing request. See console for details.',
          sender: 'system',
          timestamp: new Date(),
        } as EnhancedMessage,
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePromptSelect = (prompt: string) => {
    setInputValue(prompt);
    // Don't auto-send, just populate the input as requested
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
              ✅ Portfolio: ${portfolio.totalValue.toFixed(2)} across {portfolio.holdings.length} tokens
              {defiData && ` | DeFi: $${defiData.totalValueLocked.toFixed(2)} TVL in ${defiData.positionCount} positions`}
              {!defiData && ' | DeFi: No positions found'}
            </>
          )}
          {walletAddress && <span style={{ float: 'right' }}>🔗 {walletAddress}</span>}
        </div>
      )}

      <div className="chat-messages">
        {messages.map(m => {
          // Create chart context for components
          const chartContext: ChartContext = {
            portfolio,
            defiData,
            returnsStats,
            userAddress: walletAddress,
            network: hederaNetwork
          };



          return (
            <div key={m.id} className={`message ${m.sender}`}>
              <div className="message-content">
                <EnhancedMessageRenderer 
                  message={m}
                  context={chartContext}
                  onComponentError={(error) => {
                    console.error('[PureChat] Component error:', error);
                  }}
                />
                <span className="message-time">{time(m.timestamp)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here..."
        />
        <button disabled={!inputValue.trim() || isProcessing} onClick={sendMessage}>
          {isProcessing ? 'Processing...' : 'Send'}
        </button>
      </div>

      {/* Prompt Suggestions Panel */}
      <PromptSuggestions
        onPromptSelect={handlePromptSelect}
        portfolio={portfolio}
        defiData={defiData}
        returnsStats={returnsStats}
        isCollapsed={suggestionsCollapsed}
        onToggleCollapse={() => setSuggestionsCollapsed(!suggestionsCollapsed)}
      />
    </div>
  );
};

export default PureChatChatWindow;