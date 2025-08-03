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

  // State for controls
  const [poolCount, setPoolCount] = useState(30)
  const [sortBy, setSortBy] = useState<'apy' | 'tvl' | 'volume'>('apy')

  // Separate allocated and unallocated pools - NO SYNTHETIC DATA
  const { allocatedPools, unallocatedPools } = useMemo(() => {
    // Keep only pools with meaningful data
    const realPools = pools
    
    // Separate allocated vs unallocated
    const allocated = realPools.filter(p => (p.userStakedUsd || 0) > 0)
    const unallocated = realPools.filter(p => (p.userStakedUsd || 0) === 0)
    
    // Sort allocated by stake amount (highest first)
    allocated.sort((a, b) => (b.userStakedUsd || 0) - (a.userStakedUsd || 0))
    
    // Sort unallocated by user preference
    unallocated.sort((a, b) => {
      switch (sortBy) {
        case 'apy':
          return (b.apy || 0) - (a.apy || 0)
        case 'tvl':
          return (b.tvlUsd || 0) - (a.tvlUsd || 0)
        case 'volume':
          // Use TVL as proxy for volume if no volume data
          return (b.tvlUsd || 0) - (a.tvlUsd || 0)
        default:
          return 0
      }
    })
    
    return {
      allocatedPools: allocated,
      unallocatedPools: unallocated.slice(0, Math.max(poolCount - allocated.length, 0))
    }
  }, [pools, poolCount, sortBy])

  const allPools = [...allocatedPools, ...unallocatedPools]

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
            {allocatedPools.length} allocated • {unallocatedPools.length} available • Interactive visualization
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
          {/* Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: '500', color: '#495057' }}>
                Pool Count:
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={poolCount}
                onChange={(e) => setPoolCount(Number(e.target.value))}
                style={{ width: '150px' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#6c757d', minWidth: '3rem' }}>
                {poolCount}
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: '500', color: '#495057' }}>
                Sort Available Pools:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'apy' | 'tvl' | 'volume')}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '4px',
                  border: '1px solid #ced4da',
                  fontSize: '0.9rem'
                }}
              >
                <option value="apy">Highest APY</option>
                <option value="tvl">Highest TVL</option>
                <option value="volume">Highest Volume</option>
              </select>
            </div>
          </div>

          {/* Allocated Pools Section */}
          {allocatedPools.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ 
                margin: '0 0 1rem 0', 
                color: '#495057', 
                fontSize: '1.1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                💰 Your Positions ({allocatedPools.length})
              </h4>
              <MATLABHeatmapGrid
                pools={allocatedPools}
                maxApy={maxApy}
                maxTvl={maxTvl}
                maxStake={maxStake}
                getHeatmapColor={getHeatmapColor}
                onPoolClick={setSelectedPool}
                hoveredPool={hoveredPool}
                onPoolHover={setHoveredPool}
                isAllocatedSection={true}
              />
            </div>
          )}

          {/* Available Pools Section */}
          {unallocatedPools.length > 0 && (
            <div>
              <h4 style={{ 
                margin: '0 0 1rem 0', 
                color: '#495057', 
                fontSize: '1.1rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📊 Available Opportunities ({unallocatedPools.length})
              </h4>
              <MATLABHeatmapGrid
                pools={unallocatedPools}
                maxApy={maxApy}
                maxTvl={maxTvl}
                maxStake={maxStake}
                getHeatmapColor={getHeatmapColor}
                onPoolClick={setSelectedPool}
                hoveredPool={hoveredPool}
                onPoolHover={setHoveredPool}
                isAllocatedSection={false}
              />
            </div>
          )}
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
  isAllocatedSection: boolean
}

const MATLABHeatmapGrid: React.FC<MATLABHeatmapGridProps> = ({
  pools, maxApy, maxTvl, maxStake, getHeatmapColor, onPoolClick, hoveredPool, onPoolHover, isAllocatedSection
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
              onMouseEnter={() => onPoolHover(String(pool.poolId))}
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

              {/* Allocation indicator */}
              {isAllocatedSection && (
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#fbbf24',
                  border: '1px solid white'
                }} />
              )}

              {/* APY badge */}
              {pool.apy !== undefined && (
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  right: '12px',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '1px 4px',
                  borderRadius: '4px',
                  fontSize: '0.55rem',
                  color: 'white',
                  fontWeight: 600
                }}>
                  {pool.apy.toFixed(1)}%
                </div>
              )}

              {/* TVL badge */}
              {pool.tvlUsd !== undefined && (
                <div style={{
                  position: 'absolute',
                  bottom: '18px',
                  left: '2px',
                  backgroundColor: 'rgba(255,255,255,0.85)',
                  padding: '1px 4px',
                  borderRadius: '4px',
                  fontSize: '0.55rem',
                  color: '#343a40',
                  fontWeight: 600
                }}>
                  ${ (pool.tvlUsd/1e6).toFixed(1)}M
                </div>
              )}

              {/* Risk bar */}
              {(() => {
                // utilisation from Bonzo or computed if available
                const util = (pool as any).utilization_rate ?? (pool as any).utilisation_rate ?? (pool as any).utilisation ?? undefined
                if(util === undefined) return null
                const pct = Math.min(util, 1) * 100
                const color = util > 0.9 ? '#dc3545' : util > 0.7 ? '#ffb703' : '#28a745'
                return (
                  <div style={{ position:'absolute', bottom:0, left:0, height:'3px', width:`${pct}%`, backgroundColor: color }} />
                )
              })()}

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
        <span>
          SaucerSwap (🔵) • Bonzo (🟢)
          {isAllocatedSection && ' • Your Position (🟡)'}
        </span>
        <span>Click for details</span>
      </div>
    </div>
  )
}
