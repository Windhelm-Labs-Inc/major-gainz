import React, { useState, useEffect } from 'react'
import type { Holding } from '../types/portfolio'
import type { TokenAnalysisData } from '../hooks/useScratchpad'

interface Props {
  selectedToken: Holding | null
  userAddress: string
  onClose: () => void
  onAnalysisUpdate?: (analysisData: TokenAnalysisData) => void
}

interface TokenHolderData {
  token_name: string
  token_id: string
  last_updated_at: string
  address: string
  token_balance: number
  percentile_rank: number
  percentile_balances: Record<string, number>
  top_10_holders: Array<{
    account_id: string
    balance: number
  }>
}

const TokenHolderAnalysis: React.FC<Props> = ({ selectedToken, userAddress, onClose, onAnalysisUpdate }) => {
  const [holderData, setHolderData] = useState<TokenHolderData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedToken && userAddress) {
      fetchHolderData()
    }
  }, [selectedToken, userAddress])

  // Notify parent when holder data is loaded
  useEffect(() => {
    if (holderData && selectedToken && onAnalysisUpdate) {
      const analysisData: TokenAnalysisData = {
        percentile_rank: holderData.percentile_rank,
        rank_label: getRankLabel(holderData.percentile_rank),
        top_holder_balance: holderData.top_10_holders[0]?.balance || 0,
        last_updated: holderData.last_updated_at
      }
      onAnalysisUpdate(analysisData)
    }
  }, [holderData, selectedToken]) // Removed onAnalysisUpdate from dependencies

  const fetchHolderData = async () => {
    if (!selectedToken || !userAddress) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/token_holdings/${selectedToken.symbol}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: userAddress,
          token_balance: selectedToken.amount.toString()
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch holder data')
      }
      
      const data: TokenHolderData = await response.json()
      setHolderData(data)
    } catch (err) {
      console.error('Error fetching holder data:', err)
      setError('Failed to load holder analysis')
    } finally {
      setIsLoading(false)
    }
  }

  const formatBalance = (balance: number, symbol: string) => {
    if (balance >= 1e9) {
      return `${(balance / 1e9).toFixed(2)}B ${symbol}`
    } else if (balance >= 1e6) {
      return `${(balance / 1e6).toFixed(2)}M ${symbol}`
    } else if (balance >= 1e3) {
      return `${(balance / 1e3).toFixed(2)}K ${symbol}`
    }
    // For smaller amounts, show appropriate decimal places based on the value
    if (balance >= 1) {
      return `${balance.toFixed(2)} ${symbol}`
    }
    return `${balance.toFixed(4)} ${symbol}`
  }

  const formatAccountId = (accountId: string) => {
    return accountId
  }

  const getRankColor = (percentile: number) => {
    if (percentile >= 95) return '#10b981' // Green for top 5%
    if (percentile >= 80) return '#3b82f6' // Blue for top 20%
    if (percentile >= 50) return '#f59e0b' // Orange for top 50%
    return '#6b7280' // Gray for bottom 50%
  }

  const getRankLabel = (percentile: number) => {
    if (percentile >= 99) return 'Whale 🐋'
    if (percentile >= 95) return 'Large Holder 🦈'
    if (percentile >= 80) return 'Significant Holder 🐟'
    if (percentile >= 50) return 'Regular Holder 🐠'
    return 'Small Holder 🦐'
  }

  const createDistributionBars = () => {
    if (!holderData) return []
    
    const percentiles = [10, 25, 50, 75, 90, 95, 99]
    return percentiles.map(p => {
      const key = `p${p}`
      const balance = holderData.percentile_balances[key]
      const userRank = holderData.percentile_rank
      const isUserLevel = Math.abs(userRank - p) < 5
      
      return {
        percentile: p,
        balance,
        height: Math.log10(balance + 1) * 10,
        isUserLevel,
        description: `${p}th percentile: ${formatBalance(balance, selectedToken?.symbol || '')}`
      }
    })
  }

  if (!selectedToken) return null

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: '400px',
      backgroundColor: '#1f2937',
      color: 'white',
      boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
      zIndex: 1000,
      padding: '2rem',
      overflowY: 'auto',
      background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#f3f4f6' }}>
          Holder Analysis
        </h2>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>
      </div>

      {/* Token Info */}
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#60a5fa' }}>{selectedToken.symbol}</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#9ca3af' }}>
          {selectedToken.tokenId}
        </p>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p>Loading holder analysis...</p>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '1rem',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {holderData && !isLoading && (
        <div>
          {/* User Rank Section */}
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            border: `2px solid ${getRankColor(holderData.percentile_rank)}`
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '3rem',
                fontWeight: 'bold',
                color: getRankColor(holderData.percentile_rank),
                marginBottom: '0.5rem'
              }}>
                {holderData.percentile_rank.toFixed(1)}%
              </div>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 'bold',
                color: getRankColor(holderData.percentile_rank),
                marginBottom: '0.5rem'
              }}>
                {getRankLabel(holderData.percentile_rank)}
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#9ca3af' }}>
                You hold more than {holderData.percentile_rank.toFixed(1)}% of all holders
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#9ca3af' }}>
                Balance: {formatBalance(selectedToken.amount, selectedToken.symbol)}
              </p>
            </div>
          </div>

          {/* Distribution Visualization */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#e5e7eb' }}>Cumulative Distribution</h4>
            <div style={{
              display: 'flex',
              alignItems: 'end',
              height: '120px',
              gap: '4px',
              padding: '1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              position: 'relative'
            }}>
              {createDistributionBars().map((bar, _idx) => (
                <div 
                  key={bar.percentile} 
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                  title={bar.description}
                >
                  <div 
                    style={{
                      width: '100%',
                      height: `${Math.min(bar.height, 100)}px`,
                      backgroundColor: bar.isUserLevel ? getRankColor(holderData.percentile_rank) : '#4b5563',
                      borderRadius: '2px 2px 0 0',
                      marginBottom: '4px',
                      transition: 'all 0.3s ease',
                      border: bar.isUserLevel ? `2px solid ${getRankColor(holderData.percentile_rank)}` : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = bar.isUserLevel ? getRankColor(holderData.percentile_rank) : '#6b7280'
                      e.currentTarget.style.transform = 'scaleY(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = bar.isUserLevel ? getRankColor(holderData.percentile_rank) : '#4b5563'
                      e.currentTarget.style.transform = 'scaleY(1)'
                    }}
                  />
                  <div style={{
                    fontSize: '0.7rem',
                    color: bar.isUserLevel ? getRankColor(holderData.percentile_rank) : '#9ca3af',
                    fontWeight: bar.isUserLevel ? 'bold' : 'normal'
                  }}>
                    {bar.percentile}%
                  </div>
                  {bar.isUserLevel && (
                    <div style={{
                      position: 'absolute',
                      bottom: '110px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: getRankColor(holderData.percentile_rank),
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      zIndex: 10
                    }}>
                      YOU
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
              Hover over bars to see balance thresholds • Your position highlighted
            </p>
          </div>

          {/* Top 10 Holders */}
          <div>
            <h4 style={{ margin: '0 0 1rem 0', color: '#e5e7eb' }}>Top 10 Holders</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {holderData.top_10_holders.map((holder, idx) => (
                <div key={holder.account_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: idx < 3 ? 'rgba(251, 191, 36, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                  marginBottom: '0.5rem',
                  border: idx < 3 ? '1px solid rgba(251, 191, 36, 0.3)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: idx < 3 ? '#fbbf24' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      color: '#1f2937'
                    }}>
                      {idx + 1}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      {formatAccountId(holder.account_id)}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                    {formatBalance(holder.balance, selectedToken.symbol)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Last Updated */}
          <div style={{
            marginTop: '2rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: '#9ca3af',
            textAlign: 'center'
          }}>
            Last updated: {new Date(holderData.last_updated_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenHolderAnalysis