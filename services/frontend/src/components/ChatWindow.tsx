import React, { useState } from 'react'
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
}

interface ReturnsStats {
  token: string
  meanReturn: number
  stdReturn: number
  days: number
  dailyReturns: number[] // 14 days of daily simple returns
}

const ChatWindow: React.FC<ChatWindowProps> = ({ selectedAddress, hederaNetwork, portfolio }) => {
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
  const [agentExecutor, setAgentExecutor] = useState<any>(null)
  
  // Store returns statistics
  const [returnsStats, setReturnsStats] = useState<ReturnsStats[]>([])

  // Reset agent when address changes to ensure prompt is up to date
  React.useEffect(() => {
    console.log('[ChatWindow] selectedAddress changed', selectedAddress)
    setAgentExecutor(null)
    
    // Fetch returns statistics when portfolio changes
    if (portfolio && portfolio.holdings.length > 0) {
      fetchReturnsStats(portfolio)
    }
  }, [selectedAddress, portfolio])

  const fetchReturnsStats = async (portfolio: Portfolio) => {
    console.log('[ChatWindow] Fetching returns statistics...')
    const stats: ReturnsStats[] = []
    
    // Get unique symbols from portfolio
    const symbols = [...new Set(portfolio.holdings.map(h => h.symbol))]
    
    for (const symbol of symbols) {
      try {
        const [meanResp, stdResp, logReturnsResp] = await Promise.all([
          fetch(`http://localhost:8000/ohlcv/${symbol}/mean_return?days=30`),
          fetch(`http://localhost:8000/ohlcv/${symbol}/return_std?days=30`),
          fetch(`http://localhost:8000/ohlcv/${symbol}/log_returns?days=14`)
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

  const initAgent = async () => {
    if (agentExecutor) return agentExecutor

    console.log('[ChatWindow] Initialising agent...')
    const [{ HederaLangchainToolkit }, { ChatOpenAI }] = await Promise.all([
      import('hedera-agent-kit'),
      import('@langchain/openai')
    ])
    const { Client, PrivateKey, LedgerId } = await import('@hashgraph/sdk')

    // @ts-ignore
    const { ChatPromptTemplate } = await import('@langchain/core/prompts')

    // @ts-ignore
    const { AgentExecutor, createToolCallingAgent } = await import('langchain/agents')

    const settings = (await import('../../appSettings.json')).default as { OPENAI_API_KEY: string }

    const openAIApiKey = settings.OPENAI_API_KEY


    // @ts-ignore
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.process = window.process || { env: {} }
      // @ts-ignore
      window.process.env.OPENAI_API_KEY = openAIApiKey
    }

    const llm = new ChatOpenAI({
      model: 'gpt-4o',
      openAIApiKey
    })


    const client = hederaNetwork === 'mainnet'
      ? Client.forMainnet().setLedgerId(LedgerId.MAINNET)
      : Client.forTestnet().setLedgerId(LedgerId.TESTNET)
    // @ts-ignore 
    if ((settings as any).ACCOUNT_ID && (settings as any).PRIVATE_KEY) {
      try {
        // @ts-ignore
        client.setOperator((settings as any).ACCOUNT_ID, PrivateKey.fromStringDer((settings as any).PRIVATE_KEY))
      } catch {
        // #todo handle 
      }
    }

    const toolkit = new HederaLangchainToolkit({
      client,
      configuration: {
        tools: []
      }
    })

    const portfolioSummary = portfolio
      ? portfolio.holdings.map(h => `${h.symbol}: ${h.amount.toFixed(4)} (${h.percent.toFixed(2)}%)`).join(', ')
      : 'Portfolio not loaded.'

    const portfolioTable = portfolio
      ? portfolio.holdings
          .map(h => `${h.symbol}\t${h.amount.toFixed(4)}\t$${h.usd.toFixed(2)}\t${h.percent.toFixed(2)}%`)
          .join('\n')
      : ''

    // Create returns statistics summary
    const returnsStatsSummary = returnsStats.length > 0
      ? returnsStats.map(stat => 
          `${stat.token}: Avg Return ${(stat.meanReturn * 100).toFixed(3)}%/day, Volatility ${(stat.stdReturn * 100).toFixed(3)}%/day, 14-day log returns available`
        ).join('\n')
      : 'Returns statistics not available.'

    console.log('[ChatWindow] Portfolio summary in prompt:', portfolioSummary)
    console.log('[ChatWindow] Returns statistics summary:', returnsStatsSummary)

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an elite FRM Financial Engineer and Hedera assistant on ${hederaNetwork}. The user's currently selected address is ${selectedAddress || 'not set'}.`+
        `\n\nCurrent portfolio (USD terms):\nTOKEN\tAMOUNT\tUSD\t%\n${portfolioTable || 'N/A'}\n`+
        `Summary: ${portfolioSummary}`+
        `\n\nReturns Statistics (30-day averages):\n${returnsStatsSummary}`+
        `\n\nIMPORTANT: Daily returns data provided via get_returns_stats tool contains LOG RETURNS (natural logarithm), not simple returns. `+
        `Each token has 14 days of daily log returns available for detailed analysis.`+
        `\n\nUse this portfolio and returns data to provide informed financial analysis and recommendations.`
      ],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}']
    ])

    const tools = toolkit.getTools()
    console.log('[ChatWindow] Base tools count:', tools.length)
    
    // Add a read-only tool that returns current portfolio with proper Langchain tool format
    if (portfolio) {
      const { DynamicTool } = await import('@langchain/core/tools')
      
      const portfolioTool = new DynamicTool({
        name: 'get_portfolio',
        description: 'Returns the current USD-valued portfolio for the user address',
        func: async () => JSON.stringify(portfolio),
      })
      
      tools.push(portfolioTool)
    }

    // Add returns statistics tool
    if (returnsStats.length > 0) {
      const { DynamicTool } = await import('@langchain/core/tools')
      
      const returnsTool = new DynamicTool({
        name: 'get_returns_stats',
        description: 'Returns 30-day average returns, standard deviation, and 14 days of daily LOG RETURNS for portfolio tokens. Note: dailyReturns field contains log returns (ln(P_t/P_{t-1})), not simple returns.',
        func: async () => JSON.stringify(returnsStats),
      })
      
      tools.push(returnsTool)
    }

    const agent = createToolCallingAgent({ llm, tools, prompt })
    const executor = new AgentExecutor({ agent, tools })
    console.log('[ChatWindow] Agent initialised')
    setAgentExecutor(executor)
    return executor
  }

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    }

    console.log('[ChatWindow] User message', userMessage)
    setMessages(prev => [...prev, userMessage])
    setInputValue('')

    try {
      const executor = await initAgent()
      const response = await executor.invoke({ input: inputValue })
      console.log('[ChatWindow] Agent response', response)

      const systemMessage: Message = {
        id: userMessage.id + 1,
        text: response?.output ?? JSON.stringify(response),
        sender: 'system',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, systemMessage])
    } catch (err: any) {
      console.error('[ChatWindow] Agent error', err)
      const errorMessage: Message = {
        id: userMessage.id + 1,
        text: 'Error processing request. See console.',
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