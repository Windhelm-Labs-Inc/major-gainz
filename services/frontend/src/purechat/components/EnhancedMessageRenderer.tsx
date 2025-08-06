import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { EnhancedMessage, ChartContext } from '../types/enhancedMessage';
import { ChatComponent } from './ChatComponentRegistry';

interface Props {
  message: EnhancedMessage;
  context: ChartContext;
  onComponentError?: (error: Error) => void;
}

const EnhancedMessageRenderer: React.FC<Props> = ({ 
  message, 
  context, 
  onComponentError 
}) => {
  const [componentErrors, setComponentErrors] = useState<Record<string, string>>({});

  const handleComponentError = (componentId: string, error: Error) => {
    setComponentErrors(prev => ({
      ...prev,
      [componentId]: error.message
    }));
    onComponentError?.(error);
  };

  const renderComponents = (position: 'above' | 'inline' | 'below') => {
    if (!message.components) return null;

    return message.components
      .filter(comp => comp.position === position)
      .map(comp => (
        <div key={comp.id} className={`component-wrapper component-${position}`}>
          <ChatComponent
            instruction={comp}
            context={context}
            onError={(error) => handleComponentError(comp.id, error)}
          />
          {componentErrors[comp.id] && (
            <div className="component-error-notice">
              <span>⚠️ {componentErrors[comp.id]}</span>
              <button 
                onClick={() => setComponentErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors[comp.id];
                  return newErrors;
                })}
              >
                ×
              </button>
            </div>
          )}
        </div>
      ));
  };

  const customMarkdownComponents = {
    // Enhanced table styling
    table: ({ children, ...props }: any) => (
      <div className="table-wrapper">
        <table className="markdown-table enhanced" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="markdown-thead enhanced" {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }: any) => (
      <tbody className="markdown-tbody enhanced" {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="markdown-tr enhanced" {...props}>
        {children}
      </tr>
    ),
    th: ({ children, ...props }: any) => (
      <th className="markdown-th enhanced" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="markdown-td enhanced" {...props}>
        {children}
      </td>
    ),

    // Enhanced code blocks with syntax highlighting
    code: ({ children, className, inline, ...props }: any) => {
      const isCodeBlock = !inline && className;
      return isCodeBlock ? (
        <div className="code-block-wrapper">
          <div className="code-block-header">
            <span className="code-language">
              {className?.replace('language-', '') || 'text'}
            </span>
            <button 
              className="copy-button"
              onClick={() => navigator.clipboard?.writeText(String(children))}
            >
              📋 Copy
            </button>
          </div>
          <pre className="markdown-pre enhanced" {...props}>
            <code className={`markdown-code enhanced ${className || ''}`}>
              {children}
            </code>
          </pre>
        </div>
      ) : (
        <code className={`markdown-code enhanced inline ${className || ''}`} {...props}>
          {children}
        </code>
      );
    },

    // Enhanced blockquotes
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="markdown-blockquote enhanced" {...props}>
        <div className="blockquote-border"></div>
        <div className="blockquote-content">{children}</div>
      </blockquote>
    ),

    // Enhanced headings with anchors
    h1: ({ children, ...props }: any) => (
      <h1 className="markdown-h1 enhanced" {...props}>
        <span className="heading-content">{children}</span>
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="markdown-h2 enhanced" {...props}>
        <span className="heading-content">{children}</span>
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="markdown-h3 enhanced" {...props}>
        <span className="heading-content">{children}</span>
      </h3>
    ),

    // Enhanced lists
    ul: ({ children, ...props }: any) => (
      <ul className="markdown-ul enhanced" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="markdown-ol enhanced" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="markdown-li enhanced" {...props}>
        {children}
      </li>
    ),

    // Enhanced links
    a: ({ children, href, ...props }: any) => (
      <a 
        className="markdown-link enhanced" 
        href={href}
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
        {href?.startsWith('http') && <span className="external-link-icon">🔗</span>}
      </a>
    ),

    // Enhanced emphasis
    strong: ({ children, ...props }: any) => (
      <strong className="markdown-strong enhanced" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }: any) => (
      <em className="markdown-em enhanced" {...props}>
        {children}
      </em>
    ),

    // Custom component for inline chart placeholders
    'chart-placeholder': ({ children, ...props }: any) => {
      const inlineComponents = renderComponents('inline');
      return inlineComponents ? (
        <div className="inline-chart-container">{inlineComponents}</div>
      ) : null;
    },

    // Custom component for financial data tables
    'financial-table': ({ children, ...props }: any) => (
      <div className="financial-table-wrapper">
        <table className="financial-table" {...props}>
          {children}
        </table>
      </div>
    ),

    // Custom component for metrics display
    'metric-card': ({ children, title, value, ...props }: any) => (
      <div className="metric-card" {...props}>
        {title && <div className="metric-title">{title}</div>}
        {value && <div className="metric-value">{value}</div>}
        {children && <div className="metric-content">{children}</div>}
      </div>
    ),
  };

  return (
    <div className="enhanced-message-content">
      {/* Components positioned above */}
      {renderComponents('above')}
      
      {/* Main message content with enhanced markdown */}
      <div className="message-text-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm as any, remarkMath as any]}
          rehypePlugins={[rehypeKatex as any]}
          components={customMarkdownComponents}
        >
          {message.text}
        </ReactMarkdown>
      </div>
      
      {/* Components positioned below */}
      {renderComponents('below')}

      {/* Message metadata */}
      {(message.components?.length || Object.keys(componentErrors).length > 0) && (
        <div className="message-metadata">
          {message.components?.length && (
            <div className="components-info">
              <span className="metadata-label">
                📊 {message.components.length} chart{message.components.length !== 1 ? 's' : ''} embedded
              </span>
            </div>
          )}
          
          {Object.keys(componentErrors).length > 0 && (
            <div className="errors-info">
              <span className="metadata-label error">
                ⚠️ {Object.keys(componentErrors).length} chart error{Object.keys(componentErrors).length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}


    </div>
  );
};

export default EnhancedMessageRenderer;