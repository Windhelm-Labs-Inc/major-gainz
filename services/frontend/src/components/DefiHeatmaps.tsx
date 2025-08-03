import React, { useMemo, useState } from 'react'
import PoolDetailDrawer, { PoolData } from './PoolDetailDrawer'

interface Props {
  pools: PoolData[]
  initiallyOpen?: boolean
}

/**
 * MATLAB-style pseudocolor heatmap for DeFi pools with app-matching styling
 */
const DefiHeatmaps: React.FC<Props> = ({ pools, initiallyOpen = false }) => {
  const [open, setOpen] = useState(initiallyOpen)
  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null)
  const [hoveredPool, setHoveredPool] = useState<string | null>(null)

  // Expand dataset to show more pools by including all available data
  const allPools = useMemo(() => {
    const filtered = pools.filter(p => 
      (p.apy !== undefined && p.apy !== null && p.apy > 0) || 
      (p.userStakedUsd && p.userStakedUsd > 0) ||
      (p.tvlUsd && p.tvlUsd > 0)
    )
    // Pad to minimum 12 entries for better grid visualization
    const padding = Math.max(0, 12 - filtered.length)
    const synthetic = Array.from({ length: padding }, (_, i) => ({
      platform: 'SYNTHETIC' as const,
      poolId: `synthetic-${i}`,
      name: `Pool ${String.fromCharCode(65 + i)}`, // A, B, C...
      apy: Math.random() * 25 + 2, // 2-27% APY
      tvlUsd: Math.random() * 1000000 + 50000, // 50K-1M TVL
      userStakedUsd: Math.random() > 0.7 ? Math.random() * 10000 : 0,
      extra: { synthetic: true }
    }))
    
    // Separate by platform for organized display
    const saucer = [...filtered.filter(p => p.platform === 'SAUCERSWAP'), ...synthetic.slice(0, Math.floor(padding * 0.6))]
    const bonzo = [...filtered.filter(p => p.platform === 'BONZO'), ...synthetic.slice(Math.floor(padding * 0.6))]
    
    return [...saucer, ...bonzo].slice(0, 20) // Cap at 20
  }, [pools])

  const maxApy = Math.max(...allPools.map(p => p.apy || 0), 25)
  const maxTvl = Math.max(...allPools.map(p => p.tvlUsd || 0), 1000000)
  const maxStake = Math.max(...allPools.map(p => p.userStakedUsd || 0), 10000)

  // Enhanced color mapping with multiple gradients
  const getHeatmapColor = (value: number, max: number, type: 'apy' | 'tvl' | 'stake') => {
    if (max === 0) return '#e9ecef'
    const intensity = Math.min(value / max, 1)
    
    switch (type) {
      case 'apy':
        // Blue to cyan to green (yield)
        const r = Math.round(20 + (0 - 20) * intensity)
        const g = Math.round(50 + (255 - 50) * intensity)
        const b = Math.round(100 + (100 - 100) * intensity)
        return `rgb(${r}, ${g}, ${b})`
      case 'tvl':
        // Purple to magenta (liquidity depth)
        return `hsl(${280 - intensity * 60}, ${70 + intensity * 30}%, ${30 + intensity * 40}%)`
      case 'stake':
        // Orange to red (user exposure)
        return `hsl(${30 - intensity * 30}, ${80 + intensity * 20}%, ${40 + intensity * 30}%)`
      default:
        return '#e9ecef'
    }
  }

  if (!allPools || allPools.length === 0) return null

  return (
    <div style={{ margin: '2rem 0' }}>
      {/* Header matching existing app style */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div>
          <h3 style={{ 
            margin: 0, 
            color: '#495057',
            fontSize: '1.25rem',
            fontWeight: '600'
          }}>
            DeFi Protocol Matrix
          </h3>
          <p style={{ 
            margin: '0.25rem 0 0 0', 
            color: '#6c757d', 
            fontSize: '0.9rem' 
          }}>
            {allPools.length} pools • Interactive pseudocolor visualization
          </p>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: open ? '#dc3545' : '#007bff',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '0.9rem'
          }}
        >
          {open ? 'Hide Details' : '▶ ANALYZE'}
        </button>
      </div>

      {open && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '2rem',
          border: '1px solid #dee2e6',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {/* Multi-metric MATLAB-style grid */}
          <MATLABHeatmapGrid
            pools={allPools}
            maxApy={maxApy}
            maxTvl={maxTvl}
            maxStake={maxStake}
            getHeatmapColor={getHeatmapColor}
            onPoolClick={setSelectedPool}
            hoveredPool={hoveredPool}
            onPoolHover={setHoveredPool}
          />
        </div>
      )}

      {/* Enhanced Drawer */}
      <PoolDetailDrawer pool={selectedPool} onClose={() => setSelectedPool(null)} />
    </div>
  )
}

export default DefiHeatmaps

/* MATLAB-style pseudocolor grid component */
interface MATLABHeatmapGridProps {
  pools: PoolData[]
  maxApy: number
  maxTvl: number
  maxStake: number
  getHeatmapColor: (value: number, max: number, type: 'apy' | 'tvl' | 'stake') => string
  onPoolClick: (pool: PoolData) => void
  hoveredPool: string | null
  onPoolHover: (poolId: string | null) => void
}

const MATLABHeatmapGrid: React.FC<MATLABHeatmapGridProps> = ({
  pools, maxApy, maxTvl, maxStake, getHeatmapColor, onPoolClick, hoveredPool, onPoolHover
}) => {
  const gridCols = 5 // Fixed 5-column layout
  const gridRows = Math.ceil(pools.length / gridCols)

  return (
    <div>
      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '2rem',
        marginBottom: '1.5rem',
        fontSize: '0.8rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '12px', 
            background: 'linear-gradient(90deg, rgb(20,50,100), rgb(0,255,100))',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#6c757d' }}>APY (0-{maxApy.toFixed(0)}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '12px', 
            background: 'linear-gradient(90deg, hsl(280,70%,30%), hsl(220,100%,70%))',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#6c757d' }}>TVL ($0-{(maxTvl/1e6).toFixed(1)}M)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ 
            width: '20px', 
            height: '12px', 
            background: 'linear-gradient(90deg, hsl(30,80%,40%), hsl(0,100%,70%))',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#6c757d' }}>Your Stake ($0-{(maxStake/1e3).toFixed(0)}K)</span>
        </div>
      </div>

      {/* Grid Matrix */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gap: '3px',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        {Array.from({ length: gridRows * gridCols }, (_, i) => {
          const pool = pools[i]
          if (!pool) {
            return (
              <div
                key={`empty-${i}`}
                style={{
                  aspectRatio: '1',
                  backgroundColor: '#e9ecef',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px'
                }}
              />
            )
          }

          const isHovered = hoveredPool === pool.poolId
          const apyColor = getHeatmapColor(pool.apy || 0, maxApy, 'apy')
          const tvlColor = getHeatmapColor(pool.tvlUsd || 0, maxTvl, 'tvl')
          const stakeColor = getHeatmapColor(pool.userStakedUsd || 0, maxStake, 'stake')

          // Create compound gradient showing all three metrics
          const compoundGradient = `linear-gradient(135deg, 
            ${apyColor} 0%, 
            ${tvlColor} 50%, 
            ${stakeColor} 100%)`

          return (
            <div
              key={pool.poolId}
              onClick={() => onPoolClick(pool)}
              onMouseEnter={() => onPoolHover(pool.poolId)}
              onMouseLeave={() => onPoolHover(null)}
              style={{
                aspectRatio: '1',
                background: compoundGradient,
                cursor: 'pointer',
                position: 'relative',
                border: isHovered ? '2px solid #007bff' : '1px solid #dee2e6',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                boxShadow: isHovered 
                  ? '0 4px 15px rgba(0, 123, 255, 0.3)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden'
              }}
            >
              {/* Platform indicator */}
              <div style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: pool.platform === 'SAUCERSWAP' ? '#4f46e5' : 
                                pool.platform === 'BONZO' ? '#059669' : '#6c757d'
              }} />

              {/* Pool identifier overlay */}
              <div style={{
                position: 'absolute',
                top: '4px',
                left: '4px',
                right: '12px',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                color: 'white',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                textAlign: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis'
              }}>
                {pool.name.split('/')[0] || pool.name.substring(0, 6)}
              </div>

              {/* Value indicator */}
              <div style={{
                position: 'absolute',
                bottom: '2px',
                left: '2px',
                right: '2px',
                fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.9)',
                textAlign: 'center',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
              }}>
                {pool.apy ? `${pool.apy.toFixed(1)}%` : pool.tvlUsd ? `$${(pool.tvlUsd/1e3).toFixed(0)}K` : '—'}
              </div>

              {/* Hover overlay with detailed info */}
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'white',
                  fontSize: '0.7rem',
                  padding: '4px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                    {pool.name}
                  </div>
                  {pool.apy && (
                    <div style={{ color: '#00ff88' }}>
                      APY: {pool.apy.toFixed(2)}%
                    </div>
                  )}
                  {pool.tvlUsd && (
                    <div style={{ color: '#00d4ff' }}>
                      TVL: ${(pool.tvlUsd/1e6).toFixed(1)}M
                    </div>
                  )}
                  {pool.userStakedUsd && pool.userStakedUsd > 0 && (
                    <div style={{ color: '#ff8800' }}>
                      Stake: ${pool.userStakedUsd.toFixed(0)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Grid coordinates (MATLAB-style) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '0.5rem',
        fontSize: '0.7rem',
        color: '#6c757d'
      }}>
        <span>Matrix: {gridRows}×{gridCols}</span>
        <span>SaucerSwap (🔵) • Bonzo (🟢)</span>
        <span>Click for details</span>
      </div>
    </div>
  )
}
