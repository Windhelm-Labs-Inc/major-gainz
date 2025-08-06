import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// @ts-ignore – missing types
import remarkMath from 'remark-math';
// @ts-ignore – missing types
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import usePureChatAgent, { HederaNetwork } from '../hooks/usePureChatAgent';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'system';
  timestamp: Date;
}

interface Props {
  personality: string;
  hederaNetwork: HederaNetwork;
}

const PureChatChatWindow: React.FC<Props> = ({ personality, hederaNetwork }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Welcome to PureChat! Adjust personality on the left and start chatting.',
      sender: 'system',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const agentExecutor = usePureChatAgent(personality, hederaNetwork);

  const sendMessage = async () => {
    if (!inputValue.trim() || !agentExecutor) return;

    const userMsg: Message = {
      id: messages.length + 1,
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    try {
      const res = await agentExecutor.invoke({ input: userMsg.text });
      const reply = res?.output ?? JSON.stringify(res);
      const systemMsg: Message = {
        id: userMsg.id + 1,
        text: reply,
        sender: 'system',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, systemMsg]);
    } catch (err) {
      console.error('[PureChat] Agent error', err);
      setMessages((prev) => [
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
      <div className="chat-messages">
        {messages.map((m) => (
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
          onChange={(e) => setInputValue(e.target.value)}
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
