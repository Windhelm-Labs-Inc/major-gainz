import React from 'react'
import { Holding, Portfolio } from '../../types'

interface PortfolioTableProps {
  portfolio?: Portfolio
  height?: number
  onTokenSelect?: (symbol: string, amount?: number) => void
}

const PortfolioTable: React.FC<PortfolioTableProps> = ({ portfolio, height = 420, onTokenSelect }) => {
  const holdings: Holding[] = (portfolio?.holdings || []).slice().sort((a, b) => b.usd - a.usd)

  if (!holdings.length) {
    return (
      <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mg-gray-600)', fontSize: '0.875rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div>No holdings to display</div>
          <div style={{ fontSize: '0.75rem', marginTop: 4 }}>Connect a wallet to view your portfolio</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: `${height}px`, padding: 16, overflow: 'hidden' }}>
      <div style={{ marginBottom: 12, borderBottom: '1px solid var(--mg-gray-200)', paddingBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--mg-gray-900)' }}>Portfolio Holdings</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--mg-gray-600)' }}>
          Total Value: ${ (portfolio?.totalUsd || 0).toLocaleString() } • {holdings.length} tokens
        </div>
      </div>

      <div style={{ height: `${height - 80}px`, overflow: 'auto', paddingRight: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Token</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={{ ...th, textAlign: 'right' }}>USD</th>
              <th style={{ ...th, textAlign: 'right' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr
                key={h.tokenId + h.symbol}
                style={tr}
                onClick={() => onTokenSelect?.(h.symbol, h.amount)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--mg-gray-50)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <td style={tdLeft}><span style={{ fontWeight: 600 }}>{h.symbol}</span></td>
                <td style={tdRight}>{h.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                <td style={tdRight}>${h.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td style={tdRight}>{h.percent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--mg-gray-200)',
  fontSize: '0.8rem',
  color: 'var(--mg-gray-700)',
  position: 'sticky',
  top: 0,
  background: 'var(--mg-white)',
  zIndex: 1,
}

const tr: React.CSSProperties = {
  cursor: 'pointer',
  transition: 'background var(--mg-transition-fast)',
}

const tdLeft: React.CSSProperties = {
  padding: '10px',
  borderBottom: '1px solid var(--mg-gray-100)',
}

const tdRight: React.CSSProperties = {
  ...tdLeft,
  textAlign: 'right',
}

export default PortfolioTable


