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
        console.log('[usePureChatPortfolio] Fetching data for:', walletAddress);
        console.log('[usePureChatPortfolio] Base URL:', baseURL);
        
        // Fetch portfolio and DeFi profile in parallel
        const [portfolioResp, defiProfileResp] = await Promise.all([
          fetch(`${baseURL}/portfolio/${walletAddress}`),
          fetch(`${baseURL}/defi/profile/${walletAddress}?include_risk_analysis=false`),
        ]);

        console.log('[usePureChatPortfolio] Portfolio response status:', portfolioResp.status);
        console.log('[usePureChatPortfolio] DeFi response status:', defiProfileResp.status);

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
        if (defiProfileResp.ok) {
          try {
            const defiProfileData = await defiProfileResp.json();
            console.log('[usePureChatPortfolio] DeFi profile data:', defiProfileData);

            // Extract positions from different protocols
            const positions: any[] = [];
            let totalValueLocked = 0;

            // Process Bonzo Finance data
            if (defiProfileData.bonzo_finance) {
              const bonzo = defiProfileData.bonzo_finance;
              
              // Process supplied assets
              if (bonzo.supplied && Array.isArray(bonzo.supplied)) {
                bonzo.supplied.forEach((asset: any) => {
                  if (asset.amount > 0) {
                    positions.push({
                      platform: 'Bonzo Finance',
                      protocol: 'bonzo',
                      type: 'supply',
                      amount: asset.amount,
                      usd_value: asset.usd_value || 0,
                      token_symbol: asset.token_symbol,
                      apy: asset.supply_apy || 0,
                      risk_level: 'medium'
                    });
                    totalValueLocked += asset.usd_value || 0;
                  }
                });
              }

              // Process borrowed assets
              if (bonzo.borrowed && Array.isArray(bonzo.borrowed)) {
                bonzo.borrowed.forEach((asset: any) => {
                  if (asset.amount > 0) {
                    positions.push({
                      platform: 'Bonzo Finance',
                      protocol: 'bonzo',
                      type: 'borrow',
                      amount: asset.amount,
                      usd_value: asset.usd_value || 0,
                      token_symbol: asset.token_symbol,
                      apy: asset.borrow_apy || 0,
                      risk_level: 'high'
                    });
                  }
                });
              }
            }

            // Process SaucerSwap data
            if (defiProfileData.saucer_swap) {
              const saucer = defiProfileData.saucer_swap;

              // Process V1 pools
              if (saucer.pools_v1 && Array.isArray(saucer.pools_v1)) {
                saucer.pools_v1.forEach((pool: any) => {
                  if (pool.user_liquidity_usd > 0) {
                    positions.push({
                      platform: 'SaucerSwap V1',
                      protocol: 'saucerswap',
                      type: 'liquidity',
                      amount: pool.user_liquidity_usd,
                      usd_value: pool.user_liquidity_usd,
                      token_symbol: pool.token_a_symbol + '/' + pool.token_b_symbol,
                      apy: pool.apy || 0,
                      risk_level: 'low'
                    });
                    totalValueLocked += pool.user_liquidity_usd;
                  }
                });
              }

              // Process V2 pools
              if (saucer.pools_v2 && Array.isArray(saucer.pools_v2)) {
                saucer.pools_v2.forEach((pool: any) => {
                  if (pool.user_liquidity_usd > 0) {
                    positions.push({
                      platform: 'SaucerSwap V2',
                      protocol: 'saucerswap',
                      type: 'liquidity',
                      amount: pool.user_liquidity_usd,
                      usd_value: pool.user_liquidity_usd,
                      token_symbol: pool.token_a_symbol + '/' + pool.token_b_symbol,
                      apy: pool.apy || 0,
                      risk_level: 'low'
                    });
                    totalValueLocked += pool.user_liquidity_usd;
                  }
                });
              }

              // Process farms
              if (saucer.farms && Array.isArray(saucer.farms)) {
                saucer.farms.forEach((farm: any) => {
                  if (farm.user_staked_usd > 0) {
                    positions.push({
                      platform: 'SaucerSwap Farm',
                      protocol: 'saucerswap',
                      type: 'farm',
                      amount: farm.user_staked_usd,
                      usd_value: farm.user_staked_usd,
                      token_symbol: farm.token_symbol || 'LP',
                      apy: farm.apy || 0,
                      risk_level: 'medium'
                    });
                    totalValueLocked += farm.user_staked_usd;
                  }
                });
              }
            }

            // Create consolidated platforms data structure
            const platformsData: Record<string, any> = {};
            
            // Group positions by platform
            positions.forEach(pos => {
              if (!platformsData[pos.protocol]) {
                platformsData[pos.protocol] = [];
              }
              platformsData[pos.protocol].push(pos);
            });

            defiData = {
              platforms: platformsData,
              totalValueLocked,
              positionCount: positions.length,
            };

            console.log('[usePureChatPortfolio] Processed DeFi data:', defiData);
          } catch (defiErr) {
            console.warn('[usePureChatPortfolio] DeFi data processing failed:', defiErr);
          }
        } else {
          console.log('[usePureChatPortfolio] DeFi profile request failed:', defiProfileResp.status);
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