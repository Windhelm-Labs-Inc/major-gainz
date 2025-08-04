export interface PureChatHolding {
  symbol: string;
  amount: number;
  usd: number;
  percent: number;
}

export interface PureChatPortfolio {
  holdings: PureChatHolding[];
  totalValue: number;
}

export interface PureChatReturnsStats {
  token: string;
  meanReturn: number;
  stdReturn: number;
  days: number;
  dailyReturns: number[];
}

export interface PureChatDefiPosition {
  platform: string;
  protocol: string;
  type: string;
  amount: number;
  usd_value: number;
  token_symbol: string;
  apy?: number;
  risk_level?: string;
}

export interface PureChatDefiData {
  platforms: Record<string, any>;
  totalValueLocked: number;
  positionCount: number;
}

export interface PureChatScratchpadData {
  selectedToken?: {
    symbol: string;
    balance: number;
    usdValue: number;
    percentage: number;
  };
  holderAnalysis?: {
    percentileRank: number;
    whaleStatus: string;
    topHoldersCount: number;
  };
  portfolioSummary?: {
    totalValue: number;
    tokenCount: number;
    topHolding: string;
  };
  defiSummary?: {
    totalValueLocked: number;
    platformCount: number;
    topPlatform: string;
  };
  userContext?: {
    address: string;
    network: string;
    connectionType: string;
  };
}