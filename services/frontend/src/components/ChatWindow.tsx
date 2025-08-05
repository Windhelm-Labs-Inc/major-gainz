import React, { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// @ts-ignore – no TS types
import remarkMath from 'remark-math'
// @ts-ignore – no TS types
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
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
  /**
   * Short-lived context that reflects the user’s current UI snapshot
   * (e.g., selected token, percentile stats, etc.)
   */
  scratchpadContext?: string
}

interface ReturnsStats {
  token: string
  meanReturn: number
  stdReturn: number
  days: number
  /** 14 days of daily *log* returns */
  dailyReturns: number[]
}

const FAKE_OPENAI_KEY =
  'NOTAREALKEYSECRETSCRETSTOPLOOKINGATALLMYSECRETSAHHHHHHH!'

const ChatWindow: React.FC<ChatWindowProps> = ({
  selectedAddress,
  hederaNetwork,
  portfolio,
  scratchpadContext,
}) => {
  /* --------------------------------------------------------------------- */
  /* State                                                                 */
  /* --------------------------------------------------------------------- */
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Welcome to Quick Origins POC! This is a sample chat interface.',
      sender: 'system',
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')

  // Lazy-initialised LangChain agent executor
  const [agentExecutor, setAgentExecutor] = useState<any>(null)

  // Cached 30-day return statistics for portfolio tokens
  const [returnsStats, setReturnsStats] = useState<ReturnsStats[]>([])

  // Track last scratchpad content that was sent to the agent
  const lastSentScratchpad = useRef<string>('')

  /* --------------------------------------------------------------------- */
  /* Effects                                                                */
  /* --------------------------------------------------------------------- */
  React.useEffect(() => {
    // Whenever the address OR portfolio shape changes we rebuild the agent
    console.log('[ChatWindow] selectedAddress or portfolio changed', selectedAddress)
    setAgentExecutor(null)

    if (portfolio && portfolio.holdings.length > 0) {
      fetchReturnsStats(portfolio)
    }
  }, [selectedAddress, portfolio?.holdings.length])

  /* --------------------------------------------------------------------- */
  /* Helpers                                                                */
  /* --------------------------------------------------------------------- */
  const fetchReturnsStats = async (p: Portfolio) => {
    console.log('[ChatWindow] Fetching returns statistics...')
    const stats: ReturnsStats[] = []

    const symbols = [...new Set(p.holdings.map((h) => h.symbol))]

    for (const symbol of symbols) {
      try {
        const base = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'
        const [meanResp, stdResp, logReturnsResp] = await Promise.all([
          fetch(`${base}/ohlcv/${symbol}/mean_return?days=30`),
          fetch(`${base}/ohlcv/${symbol}/return_std?days=30`),
          fetch(`${base}/ohlcv/${symbol}/log_returns?days=14`),
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
            dailyReturns: logReturnsData.log_returns,
          })
        }
      } catch (error) {
        console.warn(`[ChatWindow] Failed to fetch stats for ${symbol}:`, error)
      }
    }

    setReturnsStats(stats)
    console.log('[ChatWindow] Returns statistics loaded:', stats)
  }

  /**
   * Dynamically initialises the Hedera-enabled LangChain agent.
   * Re-invoked when `agentExecutor` state is reset.
   */
  const initAgent = async () => {
    if (agentExecutor) return agentExecutor

    console.log('[ChatWindow] Initialising agent…')

    // Dynamic imports keep initial bundle size small
    const [{ HederaLangchainToolkit }, { ChatOpenAI }] = await Promise.all([
      import('hedera-agent-kit'),
      import('@langchain/openai'),
    ])
    const { Client, LedgerId } = await import('@hashgraph/sdk')
    // @ts-ignore – CommonJS interop
    const { ChatPromptTemplate } = await import('@langchain/core/prompts')
    // @ts-ignore – type packages lag behind
    const { AgentExecutor, createToolCallingAgent } = await import('langchain/agents')
    const { DynamicTool } = await import('@langchain/core/tools')

    /* --------------------------------------------------------- */
    /* Polyfill OPENAI_API_KEY env (browser)                     */
    /* --------------------------------------------------------- */
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.process ??= { 
        env: {},
        platform: 'browser',
        version: '18.0.0',
        versions: { node: '18.0.0' }
      }
      // Polyfill Node global object for browser so libs like "which" work
      // @ts-ignore
      window.global ??= window
      // @ts-ignore
      window.process.env.OPENAI_API_KEY = FAKE_OPENAI_KEY
    }

    /* --------------------------------------------------------- */
    /* LLM (pointing to backend proxy)                           */
    /* --------------------------------------------------------- */
    const baseURL = `${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/v1`
    console.log('[ChatWindow] Using baseURL:', baseURL)
    console.log('[ChatWindow] VITE_BACKEND_URL:', import.meta.env.VITE_BACKEND_URL)
    
    const llm = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0.7,
      openAIApiKey: FAKE_OPENAI_KEY,
      configuration: {
        baseURL,
      },
    })

    /* --------------------------------------------------------- */
    /* Hedera client                                             */
    /* --------------------------------------------------------- */
    const client =
      hederaNetwork === 'mainnet'
        ? Client.forMainnet().setLedgerId(LedgerId.MAINNET)
        : Client.forTestnet().setLedgerId(LedgerId.TESTNET)

    const toolkit = new HederaLangchainToolkit({
      client,
      configuration: { tools: [] },
    })

    /* --------------------------------------------------------- */
    /* Prompt construction                                       */
    /* --------------------------------------------------------- */
    const portfolioSummary = portfolio
      ? portfolio.holdings
          .map((h) => `${h.symbol}: ${h.amount.toFixed(4)} (${h.percent.toFixed(2)}%)`)
          .join(', ')
      : 'Portfolio not loaded.'

    const portfolioTable = portfolio
      ? portfolio.holdings
          .map(
            (h) =>
              `${h.symbol}\t${h.amount.toFixed(4)}\t$${h.usd.toFixed(2)}\t${h.percent.toFixed(2)}%`,
          )
          .join('\n')
      : ''

    const returnsStatsSummary =
      returnsStats.length > 0
        ? returnsStats
            .map(
              (stat) =>
                `${stat.token}: Avg Return ${(stat.meanReturn * 100).toFixed(3)}%/day, Volatility ${(stat.stdReturn * 100).toFixed(3)}%/day, 14-day log returns available`,
            )
            .join('\n')
        : 'Returns statistics not available.'

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an elite FRM Financial Engineer and Hedera assistant on ${hederaNetwork}. The user's currently selected address is ${selectedAddress || 'not set'}.` +
          `\n\nCurrent snapshot memory:\n${scratchpadContext || 'No active context'}\n` +
          `\nCurrent portfolio (USD terms):\nTOKEN\tAMOUNT\tUSD\t%\n${portfolioTable || 'N/A'}\n` +
          `Summary: ${portfolioSummary}` +
          `\n\nReturns Statistics (30-day averages):\n${returnsStatsSummary}` +
          `\n\nIMPORTANT: Daily returns data provided via get_returns_stats tool contains LOG RETURNS (natural logarithm), not simple returns. ` +
          `Each token has 14 days of daily log returns available for detailed analysis.` +
          `\n\nUse this portfolio and returns data to provide informed financial analysis and recommendations.`,
      ],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ])

    /* --------------------------------------------------------- */
    /* Tool wiring                                               */
    /* --------------------------------------------------------- */
    const tools = toolkit.getTools()
    console.log('[ChatWindow] Base Hedera tools:', tools.length)

    if (portfolio) {
      tools.push(
        new DynamicTool({
          name: 'get_portfolio',
          description: 'Returns the current USD-valued portfolio for the user',
          func: async () => JSON.stringify(portfolio),
        }),
      )
    }

    if (returnsStats.length > 0) {
      tools.push(
        new DynamicTool({
          name: 'get_returns_stats',
          description:
            'Returns 30-day mean, standard deviation, and 14 days of daily LOG RETURNS for portfolio tokens.',
          func: async () => JSON.stringify(returnsStats),
        }),
      )
    }

    /* --------------------------------------------------------- */
    /* Load external MCP tools (Hedera RAG server)               */
    /* --------------------------------------------------------- */
    try {
      const { MultiServerMCPClient } = await import('@langchain/mcp-adapters')
      const ragUrl =
        import.meta.env.VITE_RAG_MCP_URL || `${window.location.origin}/mcp`
      const mcpClient = new MultiServerMCPClient({
        hedera_rag: {
          url: ragUrl,
          transport: 'http',
        },
      })
      const mcpTools = await mcpClient.getTools()
      const toolNames = mcpTools.map((t: any) => t.name || 'unknown')
      console.info('[ChatWindow] Connected to Hedera RAG MCP – tools loaded:', toolNames)
      tools.push(...mcpTools)
    } catch (err) {
      console.warn('[ChatWindow] Failed to load MCP tools', err)
    }

    const agent = createToolCallingAgent({ llm, tools, prompt })
    const executor = new AgentExecutor({ agent, tools })
    console.log('[ChatWindow] Agent initialised')
    setAgentExecutor(executor)
    return executor
  }

  /* --------------------------------------------------------------------- */
  /* Event handlers                                                         */
  /* --------------------------------------------------------------------- */
  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return

    const currentScratchpad = scratchpadContext || 'No active context'
    const scratchpadChanged = currentScratchpad !== lastSentScratchpad.current

    let messageToSend = inputValue.trim()
    if (scratchpadChanged && currentScratchpad !== 'No active context') {
      messageToSend += `\n\n[Updated Context: ${currentScratchpad}]`
      lastSentScratchpad.current = currentScratchpad
    } else if (scratchpadChanged) {
      lastSentScratchpad.current = currentScratchpad
    }

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')

    try {
      const executor = await initAgent()
      const response = await executor.invoke({ input: messageToSend })
      const reply = response?.output ?? JSON.stringify(response)

      const systemMessage: Message = {
        id: userMessage.id + 1,
        text: reply,
        sender: 'system',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, systemMessage])
    } catch (err: any) {
      console.error('[ChatWindow] Agent error', err)
      const errorMessage: Message = {
        id: userMessage.id + 1,
        text: 'Error processing request. See console log for details.',
        sender: 'system',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /* --------------------------------------------------------------------- */
  /* JSX                                                                    */
  /* --------------------------------------------------------------------- */
  return (
    <div className="chat-container">
      <div className="chat-window">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              <div className="message-text">
                {message.sender === 'system' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      table: ({ children, ...props }) => (
                        <table className="markdown-table" {...props}>
                          {children}
                        </table>
                      ),
                      thead: ({ children, ...props }) => (
                        <thead className="markdown-thead" {...props}>
                          {children}
                        </thead>
                      ),
                      tbody: ({ children, ...props }) => (
                        <tbody className="markdown-tbody" {...props}>
                          {children}
                        </tbody>
                      ),
                      tr: ({ children, ...props }) => (
                        <tr className="markdown-tr" {...props}>
                          {children}
                        </tr>
                      ),
                      th: ({ children, ...props }) => (
                        <th className="markdown-th" {...props}>
                          {children}
                        </th>
                      ),
                      td: ({ children, ...props }) => (
                        <td className="markdown-td" {...props}>
                          {children}
                        </td>
                      ),
                      code: ({ children, className, ...props }) => (
                        <code className={`markdown-code ${className || ''}`} {...props}>
                          {children}
                        </code>
                      ),
                      pre: ({ children, ...props }) => (
                        <pre className="markdown-pre" {...props}>
                          {children}
                        </pre>
                      ),
                      h1: ({ children, ...props }) => (
                        <h1 className="markdown-h1" {...props}>
                          {children}
                        </h1>
                      ),
                      h2: ({ children, ...props }) => (
                        <h2 className="markdown-h2" {...props}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children, ...props }) => (
                        <h3 className="markdown-h3" {...props}>
                          {children}
                        </h3>
                      ),
                      ul: ({ children, ...props }) => (
                        <ul className="markdown-ul" {...props}>
                          {children}
                        </ul>
                      ),
                      ol: ({ children, ...props }) => (
                        <ol className="markdown-ol" {...props}>
                          {children}
                        </ol>
                      ),
                      li: ({ children, ...props }) => (
                        <li className="markdown-li" {...props}>
                          {children}
                        </li>
                      ),
                      blockquote: ({ children, ...props }) => (
                        <blockquote className="markdown-blockquote" {...props}>
                          {children}
                        </blockquote>
                      ),
                      strong: ({ children, ...props }) => (
                        <strong className="markdown-strong" {...props}>
                          {children}
                        </strong>
                      ),
                      em: ({ children, ...props }) => (
                        <em className="markdown-em" {...props}>
                          {children}
                        </em>
                      ),
                    }}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  <span>{message.text}</span>
                )}
              </div>
              <span className="message-time">{formatTime(message.timestamp)}</span>
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
