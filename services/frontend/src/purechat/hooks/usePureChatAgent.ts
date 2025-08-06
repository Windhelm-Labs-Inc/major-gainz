// Set up browser environment early
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.global ??= window;
  // @ts-ignore
  window.process ??= { env: {}, platform: 'browser', version: '18.0.0', versions: { node: '18.0.0' } };
  // @ts-ignore
  window.process.env.OPENAI_API_KEY = 'NOTAREALKEYSECRETSCRETSTOPLOOKINGATALLMYSECRETSAHHHHHHH!';
}

import { useEffect, useState } from 'react';
import { PureChatPortfolio, PureChatReturnsStats, PureChatDefiData } from '../types/pureChatTypes';

const FAKE_OPENAI_KEY = 'NOTAREALKEYSECRETSCRETSTOPLOOKINGATALLMYSECRETSAHHHHHHH!';

export type HederaNetwork = 'mainnet' | 'testnet';

export default function usePureChatAgent(
  personality: string,
  hederaNetwork: HederaNetwork,
  portfolio?: PureChatPortfolio,
  returnsStats?: PureChatReturnsStats[],
  defiData?: PureChatDefiData,
  scratchpadContext?: string
) {
  const [executor, setExecutor] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [{ HederaLangchainToolkit }, { ChatOpenAI }] = await Promise.all([
          import('hedera-agent-kit'),
          import('@langchain/openai'),
        ]);
        const { Client, LedgerId } = await import('@hashgraph/sdk');
        const { ChatPromptTemplate } = await import('@langchain/core/prompts');
        const { AgentExecutor, createToolCallingAgent } = await import('langchain/agents');
        const { DynamicTool } = await import('@langchain/core/tools');

        if (typeof window !== 'undefined') {
          // @ts-ignore
          window.global ??= window;
        }

        const client =
          hederaNetwork === 'mainnet'
            ? Client.forMainnet().setLedgerId(LedgerId.MAINNET)
            : Client.forTestnet().setLedgerId(LedgerId.TESTNET);

        const toolkit = new HederaLangchainToolkit({ client, configuration: { tools: [] } });
        let tools = toolkit.getTools();

        // Build portfolio summary strings
        const portfolioSummary = portfolio
          ? portfolio.holdings
              .map(h => `${h.symbol}: ${h.amount.toFixed(4)} (${h.percent.toFixed(2)}%)`)
              .join(', ')
          : 'Portfolio not loaded.';

        const portfolioTable = portfolio
          ? portfolio.holdings
              .map(h => `${h.symbol}\t${h.amount.toFixed(4)}\t$${h.usd.toFixed(2)}\t${h.percent.toFixed(2)}%`)
              .join('\n')
          : '';

        const returnsStatsSummary = returnsStats?.length
          ? returnsStats
              .map(stat => 
                `${stat.token}: Avg Return ${(stat.meanReturn * 100).toFixed(3)}%/day, Volatility ${(stat.stdReturn * 100).toFixed(3)}%/day, 14-day log returns available`
              )
              .join('\n')
          : 'Returns statistics not available.';

        // Build DeFi summary
        const defiSummary = defiData
          ? `DeFi Total Value Locked: $${defiData.totalValueLocked.toFixed(2)} across ${defiData.positionCount} positions\n` +
            `Platforms: ${Object.keys(defiData.platforms).join(', ')}`
          : 'DeFi data not available.';

        // Add portfolio tools if available
        if (portfolio) {
          tools.push(
            new DynamicTool({
              name: 'get_portfolio',
              description: 'Returns the current USD-valued portfolio for the user',
              func: async () => JSON.stringify(portfolio),
            })
          );
        }

        if (returnsStats?.length) {
          tools.push(
            new DynamicTool({
              name: 'get_returns_stats',
              description: 'Returns 30-day mean, standard deviation, and 14 days of daily LOG RETURNS for portfolio tokens.',
              func: async () => JSON.stringify(returnsStats),
            })
          );
        }

        if (defiData) {
          tools.push(
            new DynamicTool({
              name: 'get_defi_data',
              description: 'Returns DeFi platform holdings and position details for the user',
              func: async () => JSON.stringify(defiData),
            })
          );
        }

        // Add chart rendering tools
        tools.push(
          new DynamicTool({
            name: 'render_chart',
            description: `Render interactive charts in the chat response. Available chart types:
              - portfolio-chart: Interactive pie/doughnut chart showing portfolio allocation with selection and detailed stats
              - returns-chart: Scatter plot and time series analysis of token returns vs volatility with risk metrics  
              - defi-heatmap: Visual heatmap of DeFi opportunities with APY, TVL, and risk analysis
              - correlation-matrix: Color-coded correlation matrix showing how token returns move together
              - token-analysis: Detailed holder analysis for specific tokens including percentile rankings
              
              Usage: render_chart({"type": "portfolio-chart", "position": "below", "title": "My Portfolio", "props": {"chartType": "doughnut"}})
              
              Position options: "above", "below", "inline"
              Props are chart-specific customization options.`,
            func: async (input: string) => {
              try {
                const instruction = JSON.parse(input);
                console.log('[usePureChatAgent] render_chart called with:', instruction);
                // Return a special marker that the frontend will parse
                const marker = `[CHART_COMPONENT:${JSON.stringify(instruction)}]`;
                console.log('[usePureChatAgent] returning marker:', marker);
                return marker;
              } catch (err) {
                console.error('[usePureChatAgent] render_chart error:', err);
                return 'Error: Invalid chart instruction format. Use JSON format with type, position, and optional props.';
              }
            }
          })
        );

        tools.push(
          new DynamicTool({
            name: 'suggest_chart',
            description: `Suggest appropriate charts based on user query and available data. 
              This analyzes the current data context and recommends relevant visualizations.
              Returns suggestions that can be used with render_chart tool.`,
            func: async (query: string) => {
              const suggestions = [];
              
              if (portfolio?.holdings.length) {
                suggestions.push({
                  type: 'portfolio-chart',
                  reason: 'Portfolio data available',
                  description: 'Show portfolio allocation and token distribution'
                });
              }
              
              if (returnsStats?.length) {
                suggestions.push({
                  type: 'returns-chart',
                  reason: 'Returns statistics available',
                  description: 'Analyze risk vs return profile of tokens'
                });
                
                if (returnsStats.length >= 2) {
                  suggestions.push({
                    type: 'correlation-matrix',
                    reason: 'Multiple tokens with returns data',
                    description: 'Show how token returns correlate with each other'
                  });
                }
              }
              
              if (defiData?.positionCount) {
                suggestions.push({
                  type: 'defi-heatmap',
                  reason: 'DeFi positions available',
                  description: 'Visualize DeFi opportunities and current positions'
                });
              }
              
              return JSON.stringify({
                query,
                suggestions,
                context: {
                  hasPortfolio: !!portfolio?.holdings.length,
                  hasReturnsData: !!returnsStats?.length,
                  hasDefiData: !!defiData?.positionCount,
                  tokenCount: portfolio?.holdings.length || 0,
                  defiPositions: defiData?.positionCount || 0
                }
              });
            }
          })
        );

        // Load external MCP tools (Hedera RAG server)
        try {
          const { MultiServerMCPClient } = await import('@langchain/mcp-adapters');
          // Force relative paths in production (avoid localhost URLs in Azure)
          let ragUrl = import.meta.env.VITE_RAG_BASE || '/mcp';
          if (ragUrl.includes('127.0.0.1') || ragUrl.includes('localhost')) {
            ragUrl = '/mcp';
          }
          if (!/^https?:\/\//.test(ragUrl)) {
            ragUrl = `${window.location.origin}${ragUrl.startsWith('/') ? '' : '/'}${ragUrl}`;
          }
          const mcpClient = new MultiServerMCPClient({
            hedera_rag: {
              url: ragUrl,
              transport: 'http',
            },
          });
          const mcpTools = await mcpClient.getTools();
          const toolNames = mcpTools.map((t: any) => t.name || 'unknown');
          console.info('[usePureChatAgent] Connected to Hedera RAG MCP – tools loaded:', toolNames);
          tools.push(...mcpTools);
        } catch (err) {
          console.warn('[usePureChatAgent] Failed to load MCP tools', err);
        }

        const prompt = ChatPromptTemplate.fromMessages([
          ,
          ['placeholder', '{chat_history}'],
          ['placeholder', '{agent_scratchpad}'],
          ['human', '{input}'],
          [
            'system',`${personality}\n\n`+`Current snapshot memory:\n${scratchpadContext || 'No active context'}\n\n` +
            `Current portfolio (USD terms):\nTOKEN\tAMOUNT\tUSD\t%\n${portfolioTable || 'N/A'}\n` +
            `Summary: ${portfolioSummary}\n\n` +
            `DeFi Holdings:\n${defiSummary}\n\n` +
            `Returns Statistics (30-day averages):\n${returnsStatsSummary}\n\n` +
            `IMPORTANT: Daily returns data provided via get_returns_stats tool contains LOG RETURNS (natural logarithm), not simple returns. ` +
            `Each token has 14 days of daily log returns available for detailed analysis.\n\n` +
            `Use this portfolio, DeFi, and returns data to provide informed financial analysis and recommendations.\n\n` +
            `CHART RENDERING CAPABILITIES:\n` +
            `You can render interactive charts directly in your responses using the render_chart tool. ` +
            `When providing analysis, consider including relevant visualizations to enhance understanding:\n` +
            `- Use portfolio-chart when discussing portfolio allocation or token distribution\n` +
            `- Use returns-chart when analyzing risk/return profiles or volatility\n` +
            `- Use defi-heatmap when discussing DeFi opportunities or protocol analysis\n` +
            `- Use correlation-matrix when analyzing how tokens move together\n` +
            `- Use token-analysis for detailed holder information\n\n` +
            `Example: If user asks "show my portfolio", respond with text analysis AND call render_chart with portfolio-chart.\n` +
            `Charts will appear embedded in your response. Use the suggest_chart tool first if you're unsure which chart is most appropriate.\n\n` +
            `IMPORTANT: You MUST call the render_chart tool to actually display charts.\n` +
            `After you call render_chart, you MUST include the EXACT string returned by the tool (the \"[CHART_COMPONENT:...]\" marker) somewhere in the SAME assistant message so the frontend can render the chart.\n` +
            `Do NOT paraphrase the marker or wrap it in markdown code fences—just include it inline. If you provide analysis text, place the marker on its own line before or after the explanation.\n` +
            `Simply mentioning charts without including the marker will NOT render anything.`, 
          ],
        ]);

        // Force relative paths in production (avoid localhost URLs in Azure)
        let basePath = import.meta.env.VITE_API_BASE || '/api';
        if (basePath.includes('127.0.0.1') || basePath.includes('localhost')) {
          basePath = '/api';
        }
        if (!/^https?:\/\//.test(basePath)) {
          basePath = `${window.location.origin}${basePath.startsWith('/') ? '' : '/'}${basePath}`;
        }
        const baseURL = `${basePath}/v1`;
        const llm = new ChatOpenAI({
          modelName: 'o3-mini',
          temperature: 1,
          apiKey: FAKE_OPENAI_KEY,
          configuration: { 
            baseURL,
            timeout: 180000, // 3 minutes to account for retry delays
          },
        });

        const agent = createToolCallingAgent({ llm, tools, prompt });
        const exec = new AgentExecutor({ agent, tools });
        
        if (!cancelled) setExecutor(exec);
      } catch (err) {
        console.error('[usePureChatAgent] init error', err);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [personality, hederaNetwork, portfolio, returnsStats, defiData, scratchpadContext]);

  return executor;
}