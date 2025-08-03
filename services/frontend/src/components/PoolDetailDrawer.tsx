import React from 'react'

export interface PoolData {
  platform: 'SAUCERSWAP' | 'BONZO' | string
  poolId: string | number
  name: string
  apy?: number
  tvlUsd?: number
  userStakedUsd?: number
  volume24hUsd?: number
  utilisation?: number
  extra?: Record<string, any>
}

interface Props {
  pool: PoolData | null
  onClose: () => void
}

/**
 * Simple slide-in drawer from the right that shows details for a single pool.
 * Visual style mirrors the existing TokenHolderAnalysis component so that the
 * UI feels cohesive.
 */
const PoolDetailDrawer: React.FC<Props> = ({ pool, onClose }) => {
  if (!pool) return null

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: '420px',
      backgroundColor: '#ffffff',
      color: '#1f2937',
      boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
      zIndex: 1000,
      padding: '2rem',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
          {pool.name}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#6b7280'
          }}
          aria-label="Close pool details"
        >
          ×
        </button>
      </div>

      {/* Meta */}
      <div style={{ marginBottom: '1.25rem' }}>
        <span style={{
          padding: '0.25rem 0.5rem',
          backgroundColor: '#eef2ff',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#4338ca'
        }}>
          {pool.platform.toUpperCase()}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        <div style={tileStyle('#6366f1')}>
          <div style={tileHeading}>APY</div>
          <div style={tileValue}>{pool.apy !== undefined ? pool.apy.toFixed(2) + '%' : '–'}</div>
        </div>
        <div style={tileStyle('#059669')}>
          <div style={tileHeading}>TVL (USD)</div>
          <div style={tileValue}>{pool.tvlUsd ? formatUsd(pool.tvlUsd) : '–'}</div>
        </div>
        <div style={tileStyle('#d97706')}>
          <div style={tileHeading}>Your Stake</div>
          <div style={tileValue}>{pool.userStakedUsd ? formatUsd(pool.userStakedUsd) : '–'}</div>
        </div>
      </div>

      {/* Raw JSON (developer mode) */}
      {pool.extra && (
        <details style={{ marginTop: '2rem', fontSize: '0.85rem' }}>
          <summary>Raw pool payload</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{JSON.stringify(pool.extra, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}

export default PoolDetailDrawer

/* Helpers */
const tileStyle = (color: string): React.CSSProperties => ({
  backgroundColor: '#f9fafb',
  border: `1px solid ${color}`,
  borderRadius: '6px',
  padding: '1rem',
  textAlign: 'center'
})

const tileHeading: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#6b7280',
  marginBottom: '0.25rem'
}

const tileValue: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827'
}

const formatUsd = (value: number): string => {
  return '$' + value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
