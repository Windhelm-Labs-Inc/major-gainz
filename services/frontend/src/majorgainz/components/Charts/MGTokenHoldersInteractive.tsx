import React, { useMemo, useState } from 'react';
import { Holder, Portfolio } from '../../types';
import { buildBins, getTopHolders, toCumulativeDistribution, formatAmount } from '../../utils/tokenHoldersTransforms';

interface MGTokenHoldersInteractiveProps {
  holders?: Holder[];
  percentiles?: Record<string, number>;
  portfolio?: Portfolio;
  symbol?: string;
  height?: number;
}

const MGTokenHoldersInteractive: React.FC<MGTokenHoldersInteractiveProps> = ({
  holders,
  percentiles,
  symbol,
  height = 560,
}) => {
  const [view, setView] = useState<'top' | 'distribution' | 'cumulative'>('top');
  const top = useMemo(() => getTopHolders(holders || [], 10), [holders]);
  const bins = useMemo(() => buildBins(holders || [], 'log10', 12), [holders]);
  const cumul = useMemo(() => toCumulativeDistribution(holders || []), [holders]);

  return (
    <div style={{ height: `${height}px`, padding: '16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid var(--mg-gray-200)',
        paddingBottom: 12,
        marginBottom: 12
      }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--mg-gray-900)' }}>Token Holders</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--mg-gray-600)' }}>{symbol || 'Select a token'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['top','distribution','cumulative'] as const).map(k => (
            <button
              key={k}
              onClick={() => setView(k)}
              style={{
                background: view === k ? 'var(--mg-mint-500)' : 'var(--mg-gray-100)',
                color: view === k ? 'var(--mg-white)' : 'var(--mg-gray-800)',
                border: '1px solid var(--mg-gray-300)',
                borderRadius: 999,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >{k === 'top' ? 'Top Holders' : k === 'distribution' ? 'Distribution' : 'Cumulative'}</button>
          ))}
        </div>
      </div>

      {!holders && !percentiles && (
        <div style={{
          height: height - 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mg-gray-600)'
        }}>
          No holders data yet. Ask the agent to fetch holders for a token, or click a token in your portfolio.
        </div>
      )}

      {(holders || percentiles) && (
        <div style={{ color: 'var(--mg-gray-700)', fontSize: '0.9rem', flex: 1, minHeight: 0 }}>
          {/* Scrollable content area */}
          <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
            {view === 'top' && (
              <div>
                <div style={{ marginBottom: 12, fontWeight: 600 }}>Top 10 Holders</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8 }}>
                  {top.map((h, idx) => (
                    <React.Fragment key={h.address}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: idx < 3 ? 'var(--mg-mint-300)' : 'var(--mg-gray-300)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: 'var(--mg-gray-900)'
                        }}>{idx + 1}</div>
                        <span style={{ fontFamily: 'monospace' }}>{h.address}</span>
                      </div>
                      <div style={{ fontWeight: 700 }}>{formatAmount(h.amount)}</div>
                    </React.Fragment>
                  ))}
                  {top.length === 0 && <div>No top holders</div>}
                </div>
              </div>
            )}

            {view === 'distribution' && (
              <div>
                <div style={{ marginBottom: 12, fontWeight: 600 }}>Distribution (log bins)</div>
                <div style={{ display: 'grid', rowGap: 8 }}>
                  {bins.map((b, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 80px', alignItems: 'center', gap: 8 }}>
                      <div style={{ color: 'var(--mg-gray-700)', fontSize: 12 }}>{b.rangeLabel}</div>
                      <div style={{ background: 'var(--mg-mint-100)', borderRadius: 6, position: 'relative', height: 12 }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${Math.min(100, (b.count / Math.max(1, holders?.length || 1)) * 100)}%`,
                          background: 'var(--mg-mint-500)', borderRadius: 6
                        }} />
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 600 }}>{b.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'cumulative' && (
              <div>
                <div style={{ marginBottom: 12, fontWeight: 600 }}>Cumulative Coverage</div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', rowGap: 8 }}>
                  {cumul.slice(0, 100).map((c, i) => (
                    <React.Fragment key={c.address + i}>
                      <div style={{ color: 'var(--mg-gray-700)', fontSize: 12 }}>#{c.rank}</div>
                      <div style={{ background: 'var(--mg-blue-100)', borderRadius: 6, position: 'relative', height: 12 }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${Math.min(100, c.percent)}%`,
                          background: 'var(--mg-blue-500)', borderRadius: 6
                        }} />
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 600 }}>{c.percent.toFixed(1)}%</div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MGTokenHoldersInteractive;

