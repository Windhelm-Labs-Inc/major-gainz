import React from 'react'
import type { Holding } from '../types/portfolio'

interface Props {
  holding: Holding | null
  onClose: () => void
}

const TokenDetailsPopup: React.FC<Props> = ({ holding, onClose }) => {
  if (!holding) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={handleBackdropClick}
    >
      <div 
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px',
          width: '90%'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: '#333' }}>Token Details</h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666',
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
        
        <div style={{ color: '#333' }}>
          <div style={{ marginBottom: '1rem' }}>
            <strong style={{ fontSize: '1.2rem', color: '#2563eb' }}>{holding.symbol}</strong>
            {holding.tokenId !== 'HBAR' && (
              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                Token ID: {holding.tokenId}
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Amount:</span>
              <strong>{holding.amount.toFixed(4)} {holding.symbol}</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>USD Value:</span>
              <strong>${holding.usd.toFixed(2)}</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Portfolio %:</span>
              <strong>{holding.percent.toFixed(1)}%</strong>
            </div>
            
            {holding.usd > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Price per token:</span>
                <strong>${(holding.usd / holding.amount).toFixed(6)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TokenDetailsPopup