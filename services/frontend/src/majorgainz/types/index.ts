// Major Gainz Type Definitions

export interface Portfolio {
  holdings: Holding[];
  totalValue: number;
  totalUsd: number;
}

export interface Holding {
  symbol: string;
  tokenId: string;
  amount: number;
  usd: number;
  percent: number;
  price?: number;
}

export interface DefiData {
  totalValueLocked: number;
  positionCount: number;
  saucerSwap?: any;
  bonzoFinance?: any;
  [key: string]: any;
}

export interface ReturnsStats {
  symbol: string;
  returns: number;
  volatility: number;
  sharpe?: number;
  correlation?: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  components?: ComponentInstruction[];
  isProcessing?: boolean;
}

export interface ComponentInstruction {
  id: string;
  type: ComponentType;
  position: 'above' | 'inline' | 'below';
  title?: string;
  height?: number;
  props?: Record<string, any>;
}

export type ComponentType = 
  | 'portfolio-chart'
  | 'risk-scatter'
  | 'defi-heatmap'
  | 'correlation-matrix'
  | 'token-analysis'
  | 'mg-token-holders'
  | 'candlestick';

export interface ChartContext {
  portfolio?: Portfolio;
  defiData?: DefiData;
  returnsStats?: ReturnsStats[];
  userAddress?: string;
  holders?: Holder[];
  percentiles?: Record<string, number>;
  network: 'mainnet' | 'testnet';
}

export interface MGPersonality {
  name: string;
  role: string;
  traits: string[];
  greeting: string;
  systemPrompt: string;
}

export interface ScratchpadContext {
  userContext?: {
    address: string;
    network: 'mainnet' | 'testnet';
    connectionType: string;
  };
  portfolioSummary?: string;
  defiSummary?: string;
  selectedToken?: Holding;
  holderAnalysis?: any;
}

export type HederaNetwork = 'mainnet' | 'testnet';

// Error types
export interface MGError {
  message: string;
  code?: string;
  details?: any;
}

// New types for holders
export type Holder = { address: string; amount: number; usd?: number };
