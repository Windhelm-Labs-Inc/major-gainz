import React, { useMemo, useState } from 'react'
import PoolDetailDrawer, { PoolData } from './PoolDetailDrawer'

interface Props {
  pools: PoolData[]
  initiallyOpen?: boolean
}

/**
 * Renders two heat-maps: one for APY (yield) and one for the user's current
 * stake in USD. Each cell is clickable and opens a side drawer with more
 * details about the pool.
 */
const DefiHeatmaps: React.FC<Props> = ({ pools, initiallyOpen = false }) => {
  const [open, setOpen] = useState(initiallyOpen)
  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null)

  const yieldDataset = useMemo(() => pools.filter(p => p.apy !== undefined && p.apy !== null), [pools])
  const stakeDataset = useMemo(() => pools.filter(p => p.userStakedUsd && p.userStakedUsd > 0), [pools])

  const maxApy = Math.max(...yieldDataset.map(p => p.apy || 0), 0)
  const maxStake = Math.max(...stakeDataset.map(p => p.userStakedUsd || 0), 0)

  const colorFor = (value: number, max: number) => {
    if (max === 0) return '#e5e7eb' // gray fallback
    const ratio = value / max
    // simple blue-green gradient
    const r = Math.round(59 + (34 - 59) * ratio) // 0x3b (59) to 0x22 (34)
    const g = Math.round(130 + (197 - 130) * ratio) // 0x82 (130) to 0xc5 (197)
    const b = Math.round(246 + (62 - 246) * ratio) // 0xf6 (246) to 0x3e (62)
    return `rgb(${r},${g},${b})`
  }

  if (!pools || pools.length === 0) return null

  return (
    <div style={{ margin: '2rem 0' }}>
      {/* Header / toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>DeFi Pools</h3>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          {open ? 'Minimise' : 'Show'}
        </button>
      </div>

      {open && (
        <>
          {/* Yield Heat-map */}
          {yieldDataset.length > 0 && (
            <Heatmap
              title="Pool APY (Yield)"
              data={yieldDataset}
              valueSelector={p => p.apy || 0}
              max={maxApy}
              colorFor={colorFor}
              onTileClick={setSelectedPool}
            />
          )}

          {/* Holdings heat-map */}
          {stakeDataset.length > 0 && (
            <Heatmap
              title="Your Stake in Pools"
              data={stakeDataset}
              valueSelector={p => p.userStakedUsd || 0}
              max={maxStake}
              colorFor={colorFor}
              onTileClick={setSelectedPool}
              formatValue={v => '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            />
          )}
        </>
      )}

      {/* Drawer */}
      <PoolDetailDrawer pool={selectedPool} onClose={() => setSelectedPool(null)} />
    </div>
  )
}

export default DefiHeatmaps

/* Internal, simple CSS grid heat-map */
interface HeatmapProps {
  title: string
  data: PoolData[]
  valueSelector: (p: PoolData) => number
  max: number
  colorFor: (value: number, max: number) => string
  onTileClick: (p: PoolData) => void
  formatValue?: (v: number) => string
}

const Heatmap: React.FC<HeatmapProps> = ({ title, data, valueSelector, max, colorFor, onTileClick, formatValue }) => {
  const columns = Math.min(data.length, 6)
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h4 style={{ marginBottom: '0.75rem' }}>{title}</h4>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(110px, 1fr))`,
        gap: '6px'
      }}>
        {data.map(pool => {
          const value = valueSelector(pool)
          const bg = colorFor(value, max)
          return (
            <div
              key={pool.poolId}
              onClick={() => onTileClick(pool)}
              title={`${pool.name} – ${formatValue ? formatValue(value) : value.toFixed(2)}`}
              style={{
                height: '90px',
                backgroundColor: bg,
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                textAlign: 'center'
              }}
            >
              <div style={{ marginBottom: '0.25rem' }}>{pool.name}</div>
              <div style={{ fontSize: '0.75rem' }}>
                {formatValue ? formatValue(value) : value.toFixed(2)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
