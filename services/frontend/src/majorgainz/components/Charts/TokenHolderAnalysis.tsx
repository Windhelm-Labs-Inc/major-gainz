import React, { useEffect, useMemo, useState } from 'react';
import { Holding } from '../../types';

interface TokenHolderAnalysisProps {
  tokenData?: Holding;
  height?: number;
  onAddressClick?: (address: string) => void;
  userAddress?: string;
}

type Percentiles = Record<string, number>; // p10, p25, p50, p75, p90, p95, p99

interface HolderEntry { address: string; balance: number }

const TokenHolderAnalysis: React.FC<TokenHolderAnalysisProps> = ({ 
  tokenData, 
  height = 420,
  onAddressClick,
  userAddress,
}) => {
  const [percentiles, setPercentiles] = useState<Percentiles | null>(null);
  const [topHolders, setTopHolders] = useState<HolderEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!tokenData?.symbol || !userAddress) return;
      setLoading(true);
      setError(null);
      try {
        const base = '/api';
        const resp = await fetch(`${base}/token_holdings/${encodeURIComponent(tokenData.symbol)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: userAddress, token_balance: String(tokenData.amount) }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        setPercentiles((data?.percentile_balances || {}) as Percentiles);
        setTopHolders(((data?.top_10_holders || []) as any[]).map((h) => ({ address: h.account_id || h.address, balance: h.balance })));
        if (typeof data?.percentile_rank === 'number') setRank(data.percentile_rank);
        if (data?.last_updated_at) setLastUpdated(data.last_updated_at);
      } catch (e) {
        setError('Failed to load holder analytics');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [tokenData?.symbol, userAddress, tokenData?.amount]);

  const bars = useMemo(() => {
    if (!percentiles || !tokenData) return [] as Array<{ label: string; value: number; isUser?: boolean }>;
    // Show highest thresholds first (p99 → p10)
    const order = ['p99','p95','p90','p75','p50','p25','p10'];
    return order.map(k => ({ label: k.toUpperCase(), value: (percentiles as any)[k] || 0 }));
  }, [percentiles, tokenData]);

  if (!tokenData) {
    return (
      <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mg-gray-600)', fontSize: '0.875rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div>Select a token to analyze holder distribution</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: `${height}px`, padding: 16, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 12, borderBottom: '1px solid var(--mg-gray-200)', paddingBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--mg-gray-900)' }}>{tokenData.symbol} Holder Analysis</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--mg-gray-600)' }}>Your balance: {tokenData.amount.toLocaleString()} {tokenData.symbol}</div>
        {typeof rank === 'number' && (
          <div style={{ fontSize: '0.8rem', color: 'var(--mg-gray-600)' }}>Percentile rank: {rank.toFixed(1)}%</div>
        )}
        {lastUpdated && (
          <div style={{ fontSize: '0.75rem', color: 'var(--mg-gray-500)' }}>Last updated: {new Date(lastUpdated).toLocaleString()}</div>
        )}
      </div>

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mg-gray-600)' }}>Loading…</div>
      )}
      {error && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>{error}</div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          {/* Percentile bars */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Distribution Thresholds</div>
            <div style={{ display: 'grid', rowGap: 8, overflow: 'auto', paddingRight: 6 }}>
              {bars.map(b => (
                <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: 'var(--mg-gray-700)', fontSize: 12 }}>{b.label}</div>
                  <div style={{ background: 'var(--mg-gray-100)', borderRadius: 6, position: 'relative', height: 12 }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${Math.min(100, Math.log10((b.value || 0) + 1) * 20)}%`,
                      background: 'var(--mg-blue-500)', borderRadius: 6
                    }} />
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>{b.value?.toLocaleString()} {tokenData.symbol}</div>
                </div>
              ))}
              {bars.length === 0 && (
                <div style={{ color: 'var(--mg-gray-600)', fontSize: '0.875rem' }}>No percentile data</div>
              )}
            </div>
          </div>

          {/* Top holders */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Top Holders</div>
            <div style={{ overflow: 'auto', paddingRight: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8 }}>
                {topHolders.map((h, idx) => (
                  <React.Fragment key={h.address}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: idx < 3 ? 'var(--mg-mint-300)' : 'var(--mg-gray-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--mg-gray-900)' }}>{idx + 1}</div>
                      <button onClick={() => onAddressClick?.(h.address)} style={{ background: 'none', border: 'none', color: 'var(--mg-blue-600)', cursor: 'pointer', padding: 0, fontFamily: 'monospace' }}>{h.address}</button>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700 }}>{h.balance.toLocaleString()} {tokenData.symbol}</div>
                  </React.Fragment>
                ))}
                {topHolders.length === 0 && <div>No holder data</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenHolderAnalysis;
