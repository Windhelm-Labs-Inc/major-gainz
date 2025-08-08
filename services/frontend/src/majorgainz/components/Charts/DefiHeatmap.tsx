import React, { useEffect, useMemo, useState } from 'react';
import { DefiData } from '../../types';

interface DefiHeatmapProps {
  defiData?: DefiData;
  height?: number;
}

interface HeatmapCell {
  platform: string;
  apy: number;
  tvl: number;
  risk: 'Low' | 'Medium' | 'High';
  category: string;
  name?: string;
}

const DefiHeatmap: React.FC<DefiHeatmapProps> = ({ 
  defiData, 
  height = 400 
}) => {
  const [positionCells, setPositionCells] = useState<HeatmapCell[]>([]);
  const [opportunityCells, setOpportunityCells] = useState<HeatmapCell[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Transform live DeFi positions (SaucerSwap / Bonzo) into heatmap cells
  useEffect(() => {
    try {
      if (!defiData) {
        setPositionCells([]);
        setOpportunityCells([]);
        return;
      }

      const d: any = defiData as any;
      const saucer = d.saucerSwap || d.saucer_swap || {};
      const bonzo = d.bonzoFinance || d.bonzo_finance || {};
      const pools = d.pools || undefined; // optional global pools summary for better APY/TVL baselines

      type Acc = { apySum: number; apyCount: number; tvlSum: number };
      const buckets: Record<string, Acc & { platform: string; category: string } > = {};

      const normalizeApy = (val: number | undefined): number | undefined => {
        if (val === undefined || isNaN(val as any)) return undefined;
        // If provided as decimal (e.g., 0.032 => 3.2%), convert to percent
        if (val > 0 && val <= 1) return val * 100;
        return val;
      };

      const pickApy = (obj: any): number | undefined => {
        const raw = num(obj?.apy) ?? num(obj?.apr) ?? num(obj?.rewardApy) ?? num(obj?.supply_apy) ?? num(obj?.variable_borrow_apy) ?? num(obj?.borrow_apy);
        return normalizeApy(raw);
      };

      const pickTvl = (obj: any): number | undefined => {
        return num(obj?.tvl_usd) ?? num(obj?.liquidityUSD) ?? num(obj?.liquidity_usd) ?? num(obj?.available_liquidity_usd) ?? num(obj?.total_supply_usd) ?? num(obj?.total_borrow_usd);
      };

      const addSample = (key: string, platform: string, category: string, apy?: number, tvl?: number) => {
        if (!buckets[key]) {
          buckets[key] = { platform, category, apySum: 0, apyCount: 0, tvlSum: 0 };
        }
        if (typeof apy === 'number' && !isNaN(apy)) {
          buckets[key].apySum += apy;
          buckets[key].apyCount += 1;
        }
        if (typeof tvl === 'number' && !isNaN(tvl)) {
          buckets[key].tvlSum += tvl;
        }
      };

      const num = (v: any): number | undefined => {
        const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : undefined);
        return typeof n === 'number' && isFinite(n) ? n : undefined;
      };

      // SaucerSwap: pools_v1, pools_v2 → DEX Liquidity; farms → Farms; vaults → Vaults
      // Build simple lookup maps from global pools
      const v1Pools: any[] = pools?.saucerswap?.v1 || [];
      const v2Pools: any[] = pools?.saucerswap?.v2 || [];
      const farmPools: any[] = pools?.saucerswap?.farms || [];
      const v1ById: Record<string, any> = {};
      v1Pools.forEach((p: any) => { if (p?.id != null) v1ById[String(p.id)] = p; });
      const farmById: Record<string, any> = {};
      farmPools.forEach((p: any) => { if (p?.id != null) farmById[String(p.id)] = p; });

      const findV2ByPair = (tokenA?: string, tokenB?: string) => {
        if (!tokenA || !tokenB) return undefined;
        return v2Pools.find((pool: any) => {
          const a = pool.tokenA?.symbol || pool.token0?.symbol;
          const b = pool.tokenB?.symbol || pool.token1?.symbol;
          return (a === tokenA && b === tokenB) || (a === tokenB && b === tokenA);
        });
      };

      const processSaucerList = (list: any[] | undefined, platform: string, category: string) => {
        (list || []).forEach((p: any) => {
          let apy = pickApy(p);
          // Check global pool refs for APY/TVL if missing on position
          let tvl = pickTvl(p);

          // Try by poolId (V1 / farms)
          const poolId = p.poolId != null ? String(p.poolId) : (p.id != null ? String(p.id) : undefined);
          if ((!apy || !tvl) && poolId) {
            const v1 = v1ById[poolId];
            const farm = farmById[poolId];
            const ref = v1 || farm;
            if (ref) {
              apy = apy ?? pickApy(ref);
              tvl = tvl ?? pickTvl(ref);
            }
          }

          // Try by farmId explicitly
          if ((!apy || !tvl) && p.farmId != null) {
            const ref = farmById[String(p.farmId)];
            if (ref) {
              apy = apy ?? pickApy(ref);
              tvl = tvl ?? pickTvl(ref);
            }
          }

          // Try by token pair (V2)
          if ((!apy || !tvl) && pools?.saucerswap) {
            const tokenA = (p.tokenA?.symbol || p.token0?.symbol);
            const tokenB = (p.tokenB?.symbol || p.token1?.symbol);
            const found = findV2ByPair(tokenA, tokenB);
            if (found) {
              apy = apy ?? pickApy(found);
              tvl = tvl ?? pickTvl(found);
            }
          }

          // Fallback to user's USD stake for tvl
          if (tvl === undefined) tvl = num(p.underlyingValueUSD);

          addSample(`${platform}:${category}`, platform, category, apy, tvl);
        });
      };

      processSaucerList(saucer.pools_v1, 'SaucerSwap', 'DEX Liquidity');
      processSaucerList(saucer.pools_v2, 'SaucerSwap', 'DEX Liquidity');
      processSaucerList(saucer.farms, 'SaucerSwap', 'Farms');
      processSaucerList(saucer.vaults, 'SaucerSwap', 'Vaults');

      // Bonzo Finance: supplied → Lending - Supply; borrowed → Lending - Borrow
      const processBonzoList = (list: any[] | undefined, category: string) => {
        (list || []).forEach((m: any) => {
          let apy = pickApy(m);
          if (apy === undefined && pools?.bonzo) {
            const symbol = m.symbol || m.token_symbol || m.name;
            const found = (pools.bonzo || []).find((pool: any) => pool.symbol === symbol || pool.name === symbol);
            apy = pickApy(found);
          }
          let tvl = pickTvl(m);
          if (tvl === undefined && pools?.bonzo) {
            const symbol = m.symbol || m.token_symbol || m.name;
            const found = (pools.bonzo || []).find((pool: any) => pool.symbol === symbol || pool.name === symbol);
            tvl = pickTvl(found);
          }
          addSample('Bonzo Finance:' + category, 'Bonzo Finance', category, apy, tvl);
        });
      };

      processBonzoList(bonzo.supplied, 'Lending - Supply');
      processBonzoList(bonzo.borrowed, 'Lending - Borrow');

      // Convert buckets to HeatmapCell[] and assign a coarse risk based on APY level
      const posCells: HeatmapCell[] = Object.values(buckets).map((b) => {
        const avgApy = b.apyCount > 0 ? (b.apySum / b.apyCount) : 0;
        let risk: HeatmapCell['risk'] = 'Medium';
        if (avgApy >= 30) risk = 'High';
        else if (avgApy <= 10) risk = 'Low';
        return {
          platform: b.platform,
          category: b.category,
          apy: avgApy,
          tvl: b.tvlSum,
          risk,
        };
      }).filter(c => !isNaN(c.apy) && !isNaN(c.tvl));

      setPositionCells(posCells);
      setError(null);

      // Build global opportunities (top 30, not filtered by user's positions)
      const opps: HeatmapCell[] = [];
      if (pools) {
        const pushOpp = (platform: string, category: string, arr: any[], getName: (x: any) => string) => {
          (arr || []).forEach((p: any) => {
            const apy = pickApy(p);
            const tvl = pickTvl(p);
            if (apy !== undefined && tvl !== undefined) {
              let risk: HeatmapCell['risk'] = 'Medium';
              if (apy >= 30) risk = 'High';
              else if (apy <= 10) risk = 'Low';
              opps.push({ platform, category, apy, tvl, risk, name: getName(p) });
            }
          });
        };

        // SaucerSwap v1
        pushOpp('SaucerSwap', 'DEX Liquidity', pools.saucerswap?.v1 || [], (p) => `${p.tokenA?.symbol || p.token0?.symbol}/${p.tokenB?.symbol || p.token1?.symbol} V1`);
        // SaucerSwap v2
        pushOpp('SaucerSwap', 'DEX Liquidity', pools.saucerswap?.v2 || [], (p) => {
          const fee = p.fee ? ` (${(p.fee/10000).toFixed(2)}%)` : '';
          return `${p.tokenA?.symbol || p.token0?.symbol}/${p.tokenB?.symbol || p.token1?.symbol}${fee}`;
        });
        // SaucerSwap farms
        pushOpp('SaucerSwap', 'Farms', pools.saucerswap?.farms || [], (f) => f.name || `Farm ${f.id}`);
        // Bonzo markets
        pushOpp('Bonzo Finance', 'Lending - Supply', pools.bonzo || [], (m) => m.symbol || m.name || 'Market');

        // Rank and limit
        opps.sort((a, b) => (b.apy - a.apy) || (b.tvl - a.tvl));
        setOpportunityCells(opps.slice(0, 30));
      } else {
        setOpportunityCells([]);
      }
    } catch (e: any) {
      setPositionCells([]);
      setOpportunityCells([]);
      setError('Failed to load DeFi data');
    }
  }, [defiData]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'var(--mg-mint-500)';
      case 'Medium': return '#fbbf24';
      case 'High': return '#ef4444';
      default: return 'var(--mg-gray-400)';
    }
  };

  const getApyIntensity = (apy: number, sample: HeatmapCell[]) => {
    const maxApy = Math.max(0, ...sample.map(d => d.apy));
    if (maxApy <= 0) return 'rgba(37, 99, 235, 0.15)';
    const intensity = Math.max(0, Math.min(1, apy / maxApy));
    return `rgba(37, 99, 235, ${0.1 + intensity * 0.8})`;
  };

  const formatTvl = (tvl: number) => {
    if (tvl >= 1000000) {
      return `$${(tvl / 1000000).toFixed(1)}M`;
    } else if (tvl >= 1000) {
      return `$${(tvl / 1000).toFixed(0)}K`;
    }
    return `$${tvl}`;
  };

  if (!!error) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mg-gray-600)',
          fontSize: '0.875rem'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div>DeFi opportunities unavailable</div>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  // Shared UI helpers
  const sectionHeader = (title: string, subtitle?: string) => (
    <div style={{ marginBottom: '12px', borderBottom: '1px solid var(--mg-gray-200)', paddingBottom: '8px' }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '600', color: 'var(--mg-gray-900)' }}>{title}</h3>
      {subtitle && (
        <div style={{ fontSize: '0.875rem', color: 'var(--mg-gray-600)' }}>{subtitle}</div>
      )}
    </div>
  );

  const renderGrid = (data: HeatmapCell[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
      {data.map((cell, index) => (
        <div
          key={index}
          style={{
            background: getApyIntensity(cell.apy, data),
            border: `2px solid ${getRiskColor(cell.risk)}`,
            borderRadius: 'var(--mg-radius-md)',
            padding: '12px',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all var(--mg-transition)',
            minHeight: '100px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = 'var(--mg-shadow-md)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--mg-gray-900)', marginBottom: '4px' }}>
            {cell.platform}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--mg-gray-600)', marginBottom: '8px' }}>
            {cell.name || cell.category}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--mg-blue-900)', marginBottom: '4px' }}>
            {cell.apy.toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--mg-gray-600)', marginBottom: '8px' }}>
            TVL: {formatTvl(cell.tvl)}
          </div>
          <div style={{ position: 'absolute', top: '8px', right: '8px', background: getRiskColor(cell.risk), color: 'white', fontSize: '0.75rem', padding: '2px 6px', borderRadius: 'var(--mg-radius-sm)', fontWeight: '500' }}>
            {cell.risk}
          </div>
        </div>
      ))}
    </div>
  );

  const legend = (
    <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--mg-gray-600)', display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--mg-mint-500)' }} />
        Low Risk
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#fbbf24' }} />
        Medium Risk
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#ef4444' }} />
        High Risk
      </div>
      <div style={{ marginLeft: '12px' }}>
        Color intensity = APY level
      </div>
    </div>
  );

  const sectionHeight = Math.max(160, Math.floor((height - 50) / 2));

  return (
    <div style={{ height: `${height}px`, padding: '16px', overflow: 'hidden' }}>
      {sectionHeader('Current DeFi Positions', 'Aggregated by platform and category from your live positions')}
      <div style={{ height: `${sectionHeight}px`, overflowY: 'auto', marginBottom: '12px', paddingRight: '8px' }}>
        {positionCells.length ? renderGrid(positionCells) : (
          <div style={{ color: 'var(--mg-gray-600)', fontSize: '0.875rem', textAlign: 'center', padding: '12px' }}>
            No current DeFi positions detected
          </div>
        )}
      </div>

      {sectionHeader('DeFi Opportunities', 'Top 30 APY opportunities across Hedera DeFi protocols')}
      <div style={{ height: `${sectionHeight}px`, overflowY: 'auto', paddingRight: '8px' }}>
        {opportunityCells.length ? renderGrid(opportunityCells) : (
          <div style={{ color: 'var(--mg-gray-600)', fontSize: '0.875rem', textAlign: 'center', padding: '12px' }}>
            No global opportunities available
          </div>
        )}
      </div>

      {legend}
    </div>
  );
};

export default DefiHeatmap;
