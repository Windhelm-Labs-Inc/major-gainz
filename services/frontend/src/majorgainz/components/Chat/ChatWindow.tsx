import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ComponentInstruction, ChartContext } from '../../types';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import PromptSuggestions from './PromptSuggestions';
import styles from './chat.module.css';

interface ChatWindowProps {
  context?: ChartContext;
  onSendMessage?: (message: string) => Promise<string>;
  onComponentRender?: (instruction: ComponentInstruction) => React.ReactNode;
  isProcessing?: boolean;
  quickActions?: (send: (message: string) => void, isProcessing: boolean) => React.ReactNode;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  context,
  onSendMessage,
  onComponentRender,
  isProcessing = false,
  quickActions
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: 'Major Gainz reporting to duty. What is the wallet we\'re conducting a recon mission on?',
      sender: 'agent',
      timestamp: new Date(),
    },
  ]);
  
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const parseAgentResponse = (response: string, userMessageText?: string): { text: string; components: ComponentInstruction[] } => {
    // Simple parser for component instructions
    // Look for patterns like [CHART:portfolio-chart] or [COMPONENT:risk-scatter:above]
  // Allow optional second segment for either position (above|inline|below) OR a token symbol (e.g., token-analysis:SAUCE)
  const componentRegex = /\[(?:CHART|COMPONENT):([^:\]]+)(?::([^:\]]+))?\]/g;
    const components: ComponentInstruction[] = [];
    let cleanText = response;
    let match;

    // Try to infer a token symbol from the conversation if the agent omits it in the tag
    const inferTokenSymbol = (text: string): string | undefined => {
      try {
        const combined = `${text}`;
        const holdings = context?.portfolio?.holdings || [];
        const knownSymbols = Array.from(new Set([
          ...holdings.map(h => h.symbol),
          'HBAR', 'SAUCE', 'USDC', 'USDT', 'HBTC'
        ]));
        let best: { sym: string; idx: number } | null = null;
        for (const sym of knownSymbols) {
          const re = new RegExp(`\\b${sym}\\b`, 'i');
          const m = combined.match(re);
          if (m && typeof m.index === 'number') {
            if (!best || m.index < best.idx) best = { sym, idx: m.index };
          }
        }
        return best?.sym;
      } catch {
        return undefined;
      }
    };

    while ((match = componentRegex.exec(response)) !== null) {
      const [fullMatch, type, maybeParam] = match;
      // Determine if the param is a position or token symbol
      const isPosition = /^(above|inline|below)$/i.test(maybeParam || '');
      const position = (isPosition ? (maybeParam as any) : 'below') as any;
      const props: Record<string, any> = {};
      if (maybeParam && !isPosition) {
        props.tokenSymbol = maybeParam;
      }

      components.push({
        id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        position: position as any,
        height: 400,
        props,
      });
      
      // Remove the instruction from the text
      cleanText = cleanText.replace(fullMatch, '');
    }

    // Post-process components: for token-analysis without explicit symbol, try to infer one
    if (components.length) {
      const inferred = inferTokenSymbol(`${response} ${userMessageText || ''}`);
      components.forEach((c) => {
        if (c.type === 'token-analysis') {
          if (!c.props) c.props = {};
          if (!c.props.tokenSymbol && inferred) {
            c.props.tokenSymbol = inferred;
          }
        }
      });
    }

    return {
      text: cleanText.trim(),
      components
    };
  };

  const handleSendMessage = async (messageText: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);

    // Add processing indicator
    const processingMessage: ChatMessage = {
      id: `processing-${Date.now()}`,
      text: 'Working on your request',
      sender: 'agent',
      timestamp: new Date(),
      isProcessing: true,
    };
    
    setMessages(prev => [...prev, processingMessage]);

    try {
      // Call the agent
      let response = '';
      if (onSendMessage) {
        response = await onSendMessage(messageText);
      } else {
        // Fallback response for development
        response = `Roger that. I received your message: "${messageText}". [CHART:portfolio-chart]`;
      }

      // Parse response for components
      const { text, components } = parseAgentResponse(response, messageText);

      // Replace processing message with actual response
      const agentMessage: ChatMessage = {
        id: `agent-${Date.now()}`,
        text,
        sender: 'agent',
        timestamp: new Date(),
        components: components.length > 0 ? components : undefined,
      };

      setMessages(prev => 
        prev.filter(m => m.id !== processingMessage.id).concat([agentMessage])
      );

    } catch (error) {
      console.error('Chat error:', error);
      
      // Replace processing message with error
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
        sender: 'agent',
        timestamp: new Date(),
      };

      setMessages(prev => 
        prev.filter(m => m.id !== processingMessage.id).concat([errorMessage])
      );
    }
  };

  const handlePromptSelect = (prompt: string) => {
    setSuggestionsCollapsed(true);
    handleSendMessage(prompt);
  };

  return (
    <div className={styles.chatWindow}>
      {/* Messages Container */}
      <div className={styles.messagesContainer}>
        {messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            context={context}
            onComponentRender={onComponentRender}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      {quickActions && (
        <div style={{ padding: '8px 20px', marginTop: '-8px' }}>
          {quickActions((text: string) => { void handleSendMessage(text); }, isProcessing)}
        </div>
      )}

      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isProcessing}
        placeholder="Type your message here..."
      />

      {/* Prompt Suggestions */}
      <PromptSuggestions
        onPromptSelect={handlePromptSelect}
        portfolio={context?.portfolio}
        defiData={context?.defiData}
        returnsStats={context?.returnsStats}
        isCollapsed={suggestionsCollapsed}
        onToggleCollapse={() => setSuggestionsCollapsed(!suggestionsCollapsed)}
      />
    </div>
  );
};

export default ChatWindow;
