export interface Holding {
  tokenId: string;   // Hedera token id or "HBAR"
  symbol: string;    // Token symbol
  raw: number | string; // Raw on-chain balance (tinybars or token units)
  decimals: number; // decimal places
  amount: number;    // Adjusted amount (human-readable)
  usd: number;       // USD valuation
  percent: number;   // Percentage of total USD value
}

export interface Portfolio {
  address: string;
  network: 'mainnet' | 'testnet';
  totalUsd: number;
  holdings: Holding[];
  fetchedAt: string;  // ISO timestamp
}

// === Enhanced DeFi Types ===

export interface TokenFilterResult {
  symbol: string;
  tokenId: string;
  isDeFi: boolean;
  confidence: number;
  reasons: string[];
  suggestedCategory?: DeFiPositionType;
  metadata?: {
    amount: number;
    usdValue: number;
    patterns: string[];
  };
}

export type DeFiPositionType = 'pool_v1' | 'pool_v2' | 'farm' | 'vault' | 'lending' | 'borrowing' | 'staking';

export interface DeFiPosition {
  id: string;                    // Unique identifier
  type: DeFiPositionType;        // Position type
  protocol: 'saucerswap' | 'bonzo'; // Protocol name
  symbol: string;                // Display name (e.g., "SAUCE-WHBAR LP")
  tokens: string[];              // Underlying token symbols
  amount: number;                // Position size
  usdValue: number;              // Total USD value
  risk?: 'low' | 'medium' | 'high'; // Risk assessment
  apy?: number;                  // Annual percentage yield
  details: any;                  // Protocol-specific details
  lastUpdated: string;           // ISO timestamp
}

export interface EnhancedPortfolio extends Portfolio {
  regularHoldings: Holding[];    // Non-DeFi tokens only
  defiPositions: DeFiPosition[]; // Converted DeFi holdings
  defiTotalUsd: number;          // Total DeFi value
  filterResults: TokenFilterResult[]; // Filtering analysis
  errors: string[];              // Processing errors
  warnings: string[];            // Processing warnings
}

export interface DeFiProcessingResult {
  regularHoldings: Holding[];
  defiTokens: Holding[];
  defiPositions: DeFiPosition[];
  overlaps: Array<{
    tokenSymbol: string;
    portfolioAmount: number;
    defiAmount: number;
  }>;
  errors: string[];
  warnings: string[];
} 