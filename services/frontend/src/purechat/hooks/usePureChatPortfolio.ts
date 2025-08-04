import { useState, useEffect } from 'react';
import { PureChatPortfolio, PureChatReturnsStats, PureChatDefiData } from '../types/pureChatTypes';

interface PortfolioState {
  portfolio?: PureChatPortfolio;
  returnsStats: PureChatReturnsStats[];
  defiData?: PureChatDefiData;
  loading: boolean;
  error: string | null;
}

export default function usePureChatPortfolio(walletAddress?: string) {
  const [state, setState] = useState<PortfolioState>({
    returnsStats: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!walletAddress) {
      setState({ returnsStats: [], loading: false, error: null });
      return;
    }

    let cancelled = false;

    async function fetchPortfolioData() {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
        
        // Fetch portfolio, DeFi platforms, and DeFi positions in parallel
        const [portfolioResp, defiPlatformsResp, defiPositionsResp] = await Promise.all([
          fetch(`${baseURL}/portfolio/${walletAddress}`),
          fetch(`${baseURL}/defi/platforms/${walletAddress}`),
          fetch(`${baseURL}/defi/positions/${walletAddress}`),
        ]);

        if (!portfolioResp.ok) throw new Error(`Portfolio fetch failed: ${portfolioResp.status}`);
        
        const portfolioData = await portfolioResp.json();
        
        if (cancelled) return;

        // Transform to Pure-Chat portfolio format
        const portfolio: PureChatPortfolio = {
          holdings: portfolioData.holdings.map((h: any) => ({
            symbol: h.symbol,
            amount: h.amount,
            usd: h.usd,
            percent: h.percent,
          })),
          totalValue: portfolioData.holdings.reduce((sum: number, h: any) => sum + h.usd, 0),
        };

        // Process DeFi data if available
        let defiData: PureChatDefiData | undefined;
        if (defiPlatformsResp.ok && defiPositionsResp.ok) {
          try {
            const [platformsData, positionsData] = await Promise.all([
              defiPlatformsResp.json(),
              defiPositionsResp.json(),
            ]);

            const totalValueLocked = positionsData.reduce((sum: number, pos: any) => 
              sum + (pos.usd_value || 0), 0
            );

            defiData = {
              platforms: platformsData,
              totalValueLocked,
              positionCount: positionsData.length,
            };
          } catch (defiErr) {
            console.warn('[usePureChatPortfolio] DeFi data processing failed:', defiErr);
          }
        }

        // Fetch returns stats for each token
        const symbols = [...new Set(portfolio.holdings.map(h => h.symbol))];
        const returnsStats: PureChatReturnsStats[] = [];

        for (const symbol of symbols) {
          try {
            const [meanResp, stdResp, logReturnsResp] = await Promise.all([
              fetch(`${baseURL}/ohlcv/${symbol}/mean_return?days=30`),
              fetch(`${baseURL}/ohlcv/${symbol}/return_std?days=30`),
              fetch(`${baseURL}/ohlcv/${symbol}/log_returns?days=14`),
            ]);

            if (meanResp.ok && stdResp.ok && logReturnsResp.ok) {
              const [meanData, stdData, logReturnsData] = await Promise.all([
                meanResp.json(),
                stdResp.json(),
                logReturnsResp.json(),
              ]);

              returnsStats.push({
                token: symbol,
                meanReturn: meanData.mean_return,
                stdReturn: stdData.std_return,
                days: 30,
                dailyReturns: logReturnsData.log_returns,
              });
            }
          } catch (err) {
            console.warn(`[usePureChatPortfolio] Failed to fetch stats for ${symbol}:`, err);
          }
        }

        if (!cancelled) {
          setState({
            portfolio,
            returnsStats,
            defiData,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        console.error('[usePureChatPortfolio] Error:', err);
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Portfolio fetch failed',
          }));
        }
      }
    }

    fetchPortfolioData();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  return state;
}