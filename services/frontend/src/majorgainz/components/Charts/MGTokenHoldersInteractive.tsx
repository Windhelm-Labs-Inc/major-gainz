import React from 'react';
import { Holder, Portfolio } from '../../types';

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
  return (
    <div style={{ height: `${height}px`, padding: '16px' }}>
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
        <div style={{ fontSize: '0.75rem', color: 'var(--mg-gray-500)' }}>
          Embedded, MG-themed (Phase 4)
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
        <div style={{ color: 'var(--mg-gray-700)', fontSize: '0.9rem' }}>
          <div style={{ marginBottom: 12, fontWeight: 600 }}>Top Holders (preview)</div>
          <ul style={{ marginTop: 0 }}>
            {(holders || []).slice(0, 10).map((h, idx) => (
              <li key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'monospace' }}>{h.address}</span>
                <span>{h.amount.toLocaleString()}</span>
              </li>
            ))}
            {(!holders || holders.length === 0) && <li>No top holders loaded</li>}
          </ul>

          <div style={{ marginTop: 16, fontWeight: 600 }}>Percentiles (preview)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {percentiles && Object.keys(percentiles).slice(0, 7).map(k => (
              <div key={k} style={{
                border: '1px solid var(--mg-gray-200)',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: '0.8rem'
              }}>
                {k}: {Number(percentiles[k]).toLocaleString()}
              </div>
            ))}
            {!percentiles && <div style={{ fontSize: '0.85rem', color: 'var(--mg-gray-600)' }}>No percentile data</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MGTokenHoldersInteractive;

