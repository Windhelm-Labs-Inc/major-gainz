import { useState, useCallback } from 'react';
import { PureChatScratchpadData } from '../types/pureChatTypes';

export default function usePureChatScratchpad() {
  const [data, setData] = useState<PureChatScratchpadData>({});

  const updateSelectedToken = useCallback((token: {
    symbol: string;
    balance: number;
    usdValue: number;
    percentage: number;
  } | undefined) => {
    setData(prev => ({ ...prev, selectedToken: token }));
  }, []);

  const updateHolderAnalysis = useCallback((analysis: {
    percentileRank: number;
    whaleStatus: string;
    topHoldersCount: number;
  } | undefined) => {
    setData(prev => ({ ...prev, holderAnalysis: analysis }));
  }, []);

  const updatePortfolioSummary = useCallback((summary: {
    totalValue: number;
    tokenCount: number;
    topHolding: string;
  } | undefined) => {
    setData(prev => ({ ...prev, portfolioSummary: summary }));
  }, []);

  const updateDefiSummary = useCallback((summary: {
    totalValueLocked: number;
    platformCount: number;
    topPlatform: string;
  } | undefined) => {
    setData(prev => ({ ...prev, defiSummary: summary }));
  }, []);

  const updateUserContext = useCallback((context: {
    address: string;
    network: string;
    connectionType: string;
  } | undefined) => {
    setData(prev => ({ ...prev, userContext: context }));
  }, []);

  const clearScratchpad = useCallback(() => {
    setData({});
  }, []);

  // Generate context string for the agent
  const scratchpadContext = (() => {
    const parts: string[] = [];
    
    if (data.selectedToken) {
      parts.push(`Selected Token: ${data.selectedToken.symbol} (${data.selectedToken.balance.toFixed(4)} tokens, $${data.selectedToken.usdValue.toFixed(2)}, ${data.selectedToken.percentage.toFixed(2)}%)`);
    }
    
    if (data.holderAnalysis) {
      parts.push(`Holder Status: ${data.holderAnalysis.percentileRank.toFixed(1)}th percentile (${data.holderAnalysis.whaleStatus})`);
    }
    
    if (data.portfolioSummary) {
      parts.push(`Portfolio: $${data.portfolioSummary.totalValue.toFixed(2)} across ${data.portfolioSummary.tokenCount} tokens, top holding: ${data.portfolioSummary.topHolding}`);
    }

    if (data.defiSummary) {
      parts.push(`DeFi: $${data.defiSummary.totalValueLocked.toFixed(2)} TVL across ${data.defiSummary.platformCount} platforms, top platform: ${data.defiSummary.topPlatform}`);
    }
    
    if (data.userContext) {
      parts.push(`Connected: ${data.userContext.address} on ${data.userContext.network} via ${data.userContext.connectionType}`);
    }

    return parts.length > 0 ? parts.join(' | ') : '';
  })();

  return {
    data,
    scratchpadContext,
    updateSelectedToken,
    updateHolderAnalysis,
    updatePortfolioSummary,
    updateDefiSummary,
    updateUserContext,
    clearScratchpad,
  };
}