import { useState, useEffect, useCallback } from 'react';
import { Portfolio, Holding, DefiData, ReturnsStats, HederaNetwork, MGError } from '../types';

interface PortfolioConfig {
  userAddress?: string;
  network: HederaNetwork;
  apiBaseUrl?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface PortfolioState {
  portfolio: Portfolio | null;
  defiData: DefiData | null;
  returnsStats: ReturnsStats[] | null;
  isLoading: boolean;
  error: MGError | null;
  lastUpdated: Date | null;
}

export const useMGPortfolio = (config: PortfolioConfig) => {
  const [state, setState] = useState<PortfolioState>({
    portfolio: null,
    defiData: null,
    returnsStats: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  const { 
    userAddress, 
    network = 'mainnet',
    apiBaseUrl = '/api',
    autoRefresh = false,
    refreshInterval = 30000 // 30 seconds
  } = config;

  const fetchPortfolioData = useCallback(async () => {
    // Always fetch global pools summary for opportunities, even without a user address
    const fetchPoolsSummary = async () => {
      try {
        const poolsRes = await fetch(
          `${apiBaseUrl}/defi/pools/summary?testnet=${network === 'testnet'}`
        );
        if (poolsRes.ok) {
          return await poolsRes.json();
        }
      } catch (e) {
        console.warn('Pools summary fetch failed', e);
      }
      return null;
    };

    if (!userAddress) {
      const poolsSummary = await fetchPoolsSummary();
      setState(prev => ({
        ...prev,
        portfolio: null,
        defiData: poolsSummary?.pools ? ({ pools: poolsSummary.pools } as any) : null,
        returnsStats: null,
        error: null,
        isLoading: false,
        lastUpdated: new Date(),
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch portfolio holdings
      const portfolioResponse = await fetch(
        `${apiBaseUrl}/portfolio/${userAddress}?network=${network}`
      );
      
      if (!portfolioResponse.ok) {
        throw new Error(`Portfolio fetch failed: ${portfolioResponse.status}`);
      }

      const portfolioData = await portfolioResponse.json();

      // Fetch DeFi data (user positions)
      const defiResponse = await fetch(
        `${apiBaseUrl}/defi/positions/${userAddress}?network=${network}`
      );
      
      let defiPositions: any = null;
      if (defiResponse.ok) {
        defiPositions = await defiResponse.json();
      }

      // Fetch returns statistics
      const returnsResponse = await fetch(
        `${apiBaseUrl}/analytics/returns/${userAddress}?network=${network}`
      );
      
      let returnsStats = null;
      if (returnsResponse.ok) {
        returnsStats = await returnsResponse.json();
      }

      // Fetch DeFi global pools summary for APY/TVL intel (used by heatmap)
      const poolsSummary: any = await fetchPoolsSummary();

      // Transform portfolio data
      const portfolio: Portfolio = {
        holdings: portfolioData.holdings || [],
        totalValue: portfolioData.totalValue || 0,
        totalUsd: portfolioData.totalUsd || 0,
      };

      // Build fallback returns/volatility if analytics endpoint is unavailable
      const fallbackReturnsStats = (() => {
        try {
          const holdings = (portfolioData.holdings || []) as Array<{ symbol?: string }>;
          if (!Array.isArray(returnsStats) || returnsStats.length === 0) {
            return holdings
              .filter(h => !!h.symbol)
              .map(h => ({
                symbol: h.symbol as string,
                // Use zeros so the chart component's mock generator will provide sensible demo values
                returns: 0,
                volatility: 0,
              }));
          }
        } catch {
          // ignore fallback errors; will use whatever we have
        }
        return returnsStats;
      })();

      setState(prev => ({
        ...prev,
        portfolio,
        defiData: {
          ...(defiPositions || {}),
          // Attach global pools snapshot for heatmap APY/TVL rendering
          ...(poolsSummary?.pools ? { pools: poolsSummary.pools } : {}),
        } as any,
        returnsStats: (fallbackReturnsStats as any) || returnsStats,
        isLoading: false,
        lastUpdated: new Date(),
      }));

    } catch (error) {
      console.error('Portfolio fetch error:', error);
      
      const mgError: MGError = {
        message: error instanceof Error ? error.message : 'Failed to fetch portfolio data',
        code: 'PORTFOLIO_FETCH_ERROR',
        details: error,
      };

      setState(prev => ({
        ...prev,
        error: mgError,
        isLoading: false,
      }));
    }
  }, [userAddress, network, apiBaseUrl]);

  // Initial fetch
  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !userAddress) return;

    const interval = setInterval(fetchPortfolioData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, userAddress, refreshInterval, fetchPortfolioData]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const refreshData = useCallback(() => {
    return fetchPortfolioData();
  }, [fetchPortfolioData]);

  // Helper functions
  const getTopHoldings = useCallback((limit: number = 5) => {
    if (!state.portfolio?.holdings) return [];
    return [...state.portfolio.holdings]
      .sort((a, b) => b.usd - a.usd)
      .slice(0, limit);
  }, [state.portfolio]);

  const getTotalValue = useCallback(() => {
    return state.portfolio?.totalUsd || 0;
  }, [state.portfolio]);

  const getHoldingBySymbol = useCallback((symbol: string) => {
    return state.portfolio?.holdings?.find(h => h.symbol === symbol);
  }, [state.portfolio]);

  const getPortfolioSummary = useCallback(() => {
    if (!state.portfolio) return null;

    const { holdings, totalUsd } = state.portfolio;
    const holdingCount = holdings.length;
    const topHolding = holdings[0];
    const defiPositions = state.defiData?.positionCount || 0;

    return {
      totalValue: totalUsd,
      holdingCount,
      topHolding: topHolding?.symbol,
      topHoldingPercent: topHolding ? (topHolding.usd / totalUsd) * 100 : 0,
      defiPositions,
      lastUpdated: state.lastUpdated,
    };
  }, [state.portfolio, state.defiData, state.lastUpdated]);

  return {
    // Data
    portfolio: state.portfolio,
    defiData: state.defiData,
    returnsStats: state.returnsStats,
    
    // State
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    
    // Actions
    refreshData,
    clearError,
    
    // Helpers
    getTopHoldings,
    getTotalValue,
    getHoldingBySymbol,
    getPortfolioSummary,
  };
};

export type MGPortfolioHook = ReturnType<typeof useMGPortfolio>;
