declare module 'hashconnect' {
  // Minimal stub typings – use `any` to avoid type errors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const HashConnect: any;
}

declare module '@hashgraph/sdk' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const LedgerId: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const AccountId: any;
  export const Client: any;
  export const PrivateKey: any;
}

declare module 'hedera-agent-kit' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const HederaLangchainToolkit: any;
}

declare module '@langchain/openai' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ChatOpenAI: any;
}

declare module '@langchain/core/prompts' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ChatPromptTemplate: any;
}

declare module 'langchain/agents' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const AgentExecutor: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const createToolCallingAgent: any;
}

declare module 'hedera-agent-kit' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const PrivateKey: any;
  export const LedgerId: any;
} 