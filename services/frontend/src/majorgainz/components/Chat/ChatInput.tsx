import React, { useState, useRef, useEffect } from 'react';
import styles from './chat.module.css';
import ArrowIconUrl from '../../assets/Arrow.svg?url';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message here..."
}) => {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || disabled) return;
    
    onSendMessage(trimmed);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputContainer}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className={styles.input}
            rows={1}
            aria-label="Chat message input"
          />
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={disabled || !inputValue.trim()}
          className={styles.sendButton}
          aria-label="Send message"
          type="button"
        >
          <img src={ArrowIconUrl} alt="Send" className={styles.sendIconImg} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
