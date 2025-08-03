import React, { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Portfolio } from '../types/portfolio'

interface Message {
  id: number
  text: string
  sender: 'user' | 'system'
  timestamp: Date
}

interface ChatWindowProps {
  selectedAddress: string
  hederaNetwork: 'mainnet' | 'testnet'
  portfolio?: Portfolio
  scratchpadContext?: string
}

interface ReturnsStats {
  token: string
  meanReturn: number
  stdReturn: number
  days: number
  dailyReturns: number[] // 14 days of daily simple returns
}

const ChatWindow: React.FC<ChatWindowProps> = ({ selectedAddress, hederaNetwork: _hederaNetwork, portfolio, scratchpadContext }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Welcome to Quick Origins POC! This is a sample chat interface.',
      sender: 'system',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')

  // Lazy-initialised agent executor instance
  const [_agentExecutor, setAgentExecutor] = useState<any>(null)
  
  // Store returns statistics
  const [_returnsStats, setReturnsStats] = useState<ReturnsStats[]>([])

  // Track the last scratchpad content that was sent to the agent
  const lastSentScratchpad = useRef<string>('')

  // Only reset agent when address or portfolio changes (not for scratchpad updates)
  React.useEffect(() => {
    console.log('[ChatWindow] selectedAddress or portfolio changed', selectedAddress)
    setAgentExecutor(null)
    
    // Fetch returns statistics when portfolio changes
    if (portfolio && portfolio.holdings.length > 0) {
      console.log('[ChatWindow] Fetching returns statistics...')
      fetchReturnsStats()
    }
  }, [selectedAddress, portfolio?.holdings.length])

  const fetchReturnsStats = async () => {
    console.log('[ChatWindow] Fetching returns statistics...')
    const stats: ReturnsStats[] = []
    
    // Get unique symbols from portfolio
    const symbols = [...new Set(portfolio?.holdings.map(h => h.symbol) || [])]
    
    for (const symbol of symbols) {
      try {
        const [meanResp, stdResp, logReturnsResp] = await Promise.all([
                  fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/ohlcv/${symbol}/mean_return?days=30`),
        fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/ohlcv/${symbol}/return_std?days=30`),
        fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/ohlcv/${symbol}/log_returns?days=14`)
        ])
        
        if (meanResp.ok && stdResp.ok && logReturnsResp.ok) {
          const meanData = await meanResp.json()
          const stdData = await stdResp.json()
          const logReturnsData = await logReturnsResp.json()
          
          stats.push({
            token: symbol,
            meanReturn: meanData.mean_return,
            stdReturn: stdData.std_return,
            days: 30,
            dailyReturns: logReturnsData.log_returns
          })
        }
      } catch (error) {
        console.warn(`[ChatWindow] Failed to fetch stats for ${symbol}:`, error)
      }
    }
    
    setReturnsStats(stats)
    console.log('[ChatWindow] Returns statistics loaded:', stats)
  }

  // Simplified chat function that calls backend proxy
  const sendChatMessage = async (userMessage: string): Promise<string> => {
    try {
      console.log('[ChatWindow] Sending message to backend proxy...')
      
      const response = await fetch('/chat/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: userMessage
            }
          ],
          model: 'gpt-4o',
          max_tokens: 2000,
          temperature: 0.7,
          portfolio_context: portfolio,
          scratchpad_context: scratchpadContext
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Backend chat API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      return result.message

    } catch (error) {
      console.error('[ChatWindow] Chat API error:', error)
      throw error
    }
  }

  // Note: Agent functionality moved to secure backend proxy
  // All OpenAI API calls now go through /chat/completion endpoint

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return

    // Check if scratchpad has changed since the last message
    const currentScratchpad = scratchpadContext || 'No active context'
    const scratchpadChanged = currentScratchpad !== lastSentScratchpad.current
    
    // Prepare the message with scratchpad context only if it has changed
    let messageToSend = inputValue.trim()
    if (scratchpadChanged && currentScratchpad !== 'No active context') {
      messageToSend = `${messageToSend}\n\n[Updated Context: ${currentScratchpad}]`
      console.log('[ChatWindow] Scratchpad changed, including in message:', currentScratchpad)
      // Update the last sent scratchpad reference
      lastSentScratchpad.current = currentScratchpad
    } else if (scratchpadChanged) {
      console.log('[ChatWindow] Scratchpad cleared since last message')
      lastSentScratchpad.current = currentScratchpad
    } else {
      console.log('[ChatWindow] Scratchpad unchanged, not including in message')
    }

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue, // Show original user input in UI
      sender: 'user',
      timestamp: new Date()
    }

    console.log('[ChatWindow] User message', userMessage)
    if (scratchpadChanged && currentScratchpad !== 'No active context') {
      console.log('[ChatWindow] Message with updated context sent to agent:', messageToSend)
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')

    try {
      // Use backend proxy instead of local agent
      const response = await sendChatMessage(messageToSend)
      console.log('[ChatWindow] Backend proxy response', response)

      const systemMessage: Message = {
        id: userMessage.id + 1,
        text: response,
        sender: 'system',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, systemMessage])
    } catch (err: any) {
      console.error('[ChatWindow] Backend proxy error', err)
      const errorMessage: Message = {
        id: userMessage.id + 1,
        text: `Error: ${err.message || 'Failed to process request. Check backend connection.'}`,
        sender: 'system',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('[ChatWindow] Enter pressed')
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="chat-container">
      <div className="chat-window">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.sender}`}
          >
            <div className="message-content">
              <div className="message-text">
                {message.sender === 'system' ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({children, ...props}) => (
                        <table className="markdown-table" {...props}>{children}</table>
                      ),
                      thead: ({children, ...props}) => (
                        <thead className="markdown-thead" {...props}>{children}</thead>
                      ),
                      tbody: ({children, ...props}) => (
                        <tbody className="markdown-tbody" {...props}>{children}</tbody>
                      ),
                      tr: ({children, ...props}) => (
                        <tr className="markdown-tr" {...props}>{children}</tr>
                      ),
                      th: ({children, ...props}) => (
                        <th className="markdown-th" {...props}>{children}</th>
                      ),
                      td: ({children, ...props}) => (
                        <td className="markdown-td" {...props}>{children}</td>
                      ),
                      code: ({children, className, ...props}) => (
                        <code className={`markdown-code ${className || ''}`} {...props}>{children}</code>
                      ),
                      pre: ({children, ...props}) => (
                        <pre className="markdown-pre" {...props}>{children}</pre>
                      ),
                      h1: ({children, ...props}) => (
                        <h1 className="markdown-h1" {...props}>{children}</h1>
                      ),
                      h2: ({children, ...props}) => (
                        <h2 className="markdown-h2" {...props}>{children}</h2>
                      ),
                      h3: ({children, ...props}) => (
                        <h3 className="markdown-h3" {...props}>{children}</h3>
                      ),
                      ul: ({children, ...props}) => (
                        <ul className="markdown-ul" {...props}>{children}</ul>
                      ),
                      ol: ({children, ...props}) => (
                        <ol className="markdown-ol" {...props}>{children}</ol>
                      ),
                      li: ({children, ...props}) => (
                        <li className="markdown-li" {...props}>{children}</li>
                      ),
                      blockquote: ({children, ...props}) => (
                        <blockquote className="markdown-blockquote" {...props}>{children}</blockquote>
                      ),
                      strong: ({children, ...props}) => (
                        <strong className="markdown-strong" {...props}>{children}</strong>
                      ),
                      em: ({children, ...props}) => (
                        <em className="markdown-em" {...props}>{children}</em>
                      )
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  <span>{message.text}</span>
                )}
              </div>
              <span className="message-time">
                {formatTime(message.timestamp)}
              </span>
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
          className="chat-input"
        />
        <button 
          onClick={handleSendMessage}
          disabled={inputValue.trim() === ''}
          className="send-btn"
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatWindow 