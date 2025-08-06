import { useEffect, useState } from 'react';

export type HederaNetwork = 'mainnet' | 'testnet';

/**
 * React hook that returns a LangChain AgentExecutor configured for the given
 * network and personality.  A new executor is built automatically whenever
 * either dependency changes.
 */
export default function usePureChatAgent(personality: string, hederaNetwork: HederaNetwork) {
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
        // @ts-ignore – some packages ship only CJS
        const { ChatPromptTemplate } = await import('@langchain/core/prompts');
        // @ts-ignore – types lagging
        const { AgentExecutor, createToolCallingAgent } = await import('langchain/agents');

        if (typeof window !== 'undefined') {
          // Some Node-centric libs expect global to exist
          // @ts-ignore
          window.global ??= window;
        }

        const client =
          hederaNetwork === 'mainnet'
            ? Client.forMainnet().setLedgerId(LedgerId.MAINNET)
            : Client.forTestnet().setLedgerId(LedgerId.TESTNET);

        /* ----------------------------------------------------- */
        /* Build tools                                           */
        /* ----------------------------------------------------- */
        const toolkit = new HederaLangchainToolkit({ client, configuration: { tools: [] } });
        const tools = toolkit.getTools();

        /* ----------------------------------------------------- */
        /* Prompt construction                                   */
        /* ----------------------------------------------------- */
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', `Personality Prompt:\n${personality}`],
          ['placeholder', '{chat_history}'],
          ['human', '{input}'],
          ['placeholder', '{agent_scratchpad}'],
        ]);

        /* ----------------------------------------------------- */
        /* Model configuration                                    */
        /* ----------------------------------------------------- */
        let basePath = import.meta.env.VITE_API_BASE || '/api';
    if (!/^https?:\/\//.test(basePath)) {
      basePath = `${window.location.origin}${basePath.startsWith('/') ? '' : '/'}${basePath}`;
    }
    const baseURL = `${basePath}/v1`;
        const llm = new ChatOpenAI({
          modelName: 'gpt-4o',
          temperature: 0.7,
          configuration: { baseURL },
          openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
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
  }, [personality, hederaNetwork]);

  return executor;
}
