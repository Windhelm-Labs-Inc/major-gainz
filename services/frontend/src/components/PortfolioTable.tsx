import React from 'react'
import type { Holding } from '../types/portfolio'

interface Props {
  data: Holding[]
  selectedTokenId?: string | null
  onTokenSelect?: (holding: Holding) => void
}

const PortfolioTable: React.FC<Props> = ({ data, selectedTokenId, onTokenSelect }) => {
  const rows = [...data].sort((a, b) => b.usd - a.usd)
  if (!rows.length) return null

  const handleRowClick = (holding: Holding) => {
    if (onTokenSelect) {
      onTokenSelect(holding)
    }
  }

  return (
    <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Token</th>
          <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Amount</th>
          <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>USD</th>
          <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(h => {
          const isSelected = selectedTokenId && h.tokenId === selectedTokenId
          return (
            <tr 
              key={h.tokenId}
              onClick={() => handleRowClick(h)}
              style={{
                cursor: 'pointer',
                backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                transition: 'background-color 0.2s ease, border-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <td style={{ padding: '0.75rem 0.5rem', fontWeight: isSelected ? 'bold' : 'normal' }}>
                {h.symbol}
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>
                {h.amount.toFixed(4)}
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>
                ${h.usd.toFixed(2)}
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>
                {h.percent.toFixed(1)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default PortfolioTable 