import { PureChatPortfolio, PureChatDefiData, PureChatReturnsStats } from './pureChatTypes';

export interface ComponentInstruction {
  type: 'portfolio-chart' | 'defi-heatmap' | 'token-analysis' | 'returns-chart' | 'volatility-surface' | 'correlation-matrix';
  props: Record<string, any>;
  position: 'inline' | 'below' | 'above';
  id: string;
  title?: string;
  height?: number;
}

export interface EnhancedMessage {
  id: number;
  text: string;
  sender: 'user' | 'system';
  timestamp: Date;
  components?: ComponentInstruction[];
}

export interface ChartContext {
  portfolio?: PureChatPortfolio;
  defiData?: PureChatDefiData;
  returnsStats?: PureChatReturnsStats[];
  userAddress?: string;
  network?: string;
}

export interface ChartComponentProps {
  title?: string;
  height?: number;
  interactive?: boolean;
  theme?: 'light' | 'dark';
  onDataUpdate?: (data: any) => void;
  onSelection?: (selection: any) => void;
}