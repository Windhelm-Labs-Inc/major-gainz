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