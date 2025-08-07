import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ChatMessage, ComponentInstruction, ChartContext } from '../../types';
import styles from './chat.module.css';
import Avatar from './Avatar';

interface MessageBubbleProps {
  message: ChatMessage;
  context?: ChartContext;
  onComponentRender?: (instruction: ComponentInstruction) => React.ReactNode;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  context, 
  onComponentRender 
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const renderComponents = (position: 'above' | 'inline' | 'below') => {
    if (!message.components || !onComponentRender) return null;

    return message.components
      .filter(comp => comp.position === position)
      .map(comp => (
        <div key={comp.id} className={styles.componentWrapper}>
          {onComponentRender(comp)}
        </div>
      ));
  };

  const messageClass = [
    styles.message,
    styles[message.sender],
    message.isProcessing ? styles.processing : ''
  ].filter(Boolean).join(' ');

  const bubbleClass = [
    styles.bubble,
    styles[message.sender]
  ].filter(Boolean).join(' ');

  const customMarkdownComponents = {
    // Enhanced code blocks
    code: ({ children, className, inline, ...props }: any) => {
      const isCodeBlock = !inline && className;
      return isCodeBlock ? (
        <pre style={{ 
          background: '#f8f9fa', 
          padding: '12px', 
          borderRadius: '6px',
          overflow: 'auto',
          fontSize: '0.875rem'
        }}>
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code style={{ 
          background: '#f1f3f4', 
          padding: '2px 4px', 
          borderRadius: '3px',
          fontSize: '0.875rem'
        }} {...props}>
          {children}
        </code>
      );
    },

    // Enhanced tables
    table: ({ children, ...props }: any) => (
      <div style={{ overflowX: 'auto', margin: '8px 0' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '0.875rem'
        }} {...props}>
          {children}
        </table>
      </div>
    ),

    th: ({ children, ...props }: any) => (
      <th style={{ 
        padding: '8px', 
        borderBottom: '2px solid #dee2e6',
        textAlign: 'left',
        fontWeight: '600'
      }} {...props}>
        {children}
      </th>
    ),

    td: ({ children, ...props }: any) => (
      <td style={{ 
        padding: '8px', 
        borderBottom: '1px solid #dee2e6'
      }} {...props}>
        {children}
      </td>
    ),

    // Enhanced links
    a: ({ children, href, ...props }: any) => (
      <a 
        href={href}
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        style={{ color: 'var(--mg-blue-500)', textDecoration: 'underline' }}
        {...props}
      >
        {children}
      </a>
    ),
  };

  return (
    <div className={messageClass}>
      {message.sender === 'agent' && <Avatar sender={message.sender} />}
      
      <div className={styles.messageContent}>
        {/* Components positioned above */}
        {renderComponents('above')}
        
        {/* Main message bubble */}
        <div className={bubbleClass}>
          {message.isProcessing ? (
            <span>
              {message.text}
              <span className={styles.processingDots}>...</span>
            </span>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm as any, remarkMath as any]}
              rehypePlugins={[rehypeKatex as any]}
              components={customMarkdownComponents}
            >
              {message.text}
            </ReactMarkdown>
          )}
        </div>
        
        {/* Components positioned below */}
        {renderComponents('below')}
        
        {/* Timestamp */}
        <div className={styles.timestamp}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
