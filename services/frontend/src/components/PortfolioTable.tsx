import React from 'react'
import type { Holding } from '../types/portfolio'

interface Props {
  data: Holding[]
}

const PortfolioTable: React.FC<Props> = ({ data }) => {
  const rows = [...data].sort((a, b) => b.usd - a.usd)
  if (!rows.length) return null

  return (
    <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Token</th>
          <th style={{ textAlign: 'right' }}>Amount</th>
          <th style={{ textAlign: 'right' }}>USD</th>
          <th style={{ textAlign: 'right' }}>%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(h => (
          <tr key={h.tokenId}>
            <td>{h.symbol}</td>
            <td style={{ textAlign: 'right' }}>{h.amount.toFixed(4)}</td>
            <td style={{ textAlign: 'right' }}>${h.usd.toFixed(2)}</td>
            <td style={{ textAlign: 'right' }}>{h.percent.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default PortfolioTable 