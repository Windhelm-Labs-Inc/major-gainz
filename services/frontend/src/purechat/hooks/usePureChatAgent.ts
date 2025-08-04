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
          // @ts-ignore
          window.process ??= { env: {}, platform: 'browser', version: '18.0.0', versions: { node: '18.0.0' } };
          // @ts-ignore
          window.process.env.OPENAI_API_KEY = FAKE_OPENAI_KEY;
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

        const prompt = ChatPromptTemplate.fromMessages([
          [
            'system',
            `${personality}\n\n` +
            `Current snapshot memory:\n${scratchpadContext || 'No active context'}\n\n` +
            `Current portfolio (USD terms):\nTOKEN\tAMOUNT\tUSD\t%\n${portfolioTable || 'N/A'}\n` +
            `Summary: ${portfolioSummary}\n\n` +
            `DeFi Holdings:\n${defiSummary}\n\n` +
            `Returns Statistics (30-day averages):\n${returnsStatsSummary}\n\n` +
            `IMPORTANT: Daily returns data provided via get_returns_stats tool contains LOG RETURNS (natural logarithm), not simple returns. ` +
            `Each token has 14 days of daily log returns available for detailed analysis.\n\n` +
            `Use this portfolio, DeFi, and returns data to provide informed financial analysis and recommendations.`,
          ],
          ['placeholder', '{chat_history}'],
          ['human', '{input}'],
          ['placeholder', '{agent_scratchpad}'],
        ]);

        const baseURL = `${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/v1`;
        const llm = new ChatOpenAI({
          modelName: 'gpt-4o',
          temperature: 0.7,
          configuration: { baseURL },
          openAIApiKey: FAKE_OPENAI_KEY,
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