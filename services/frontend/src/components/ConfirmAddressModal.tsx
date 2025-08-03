import React, { useEffect } from 'react'

interface Props {
  isOpen: boolean
  address: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

const ConfirmAddressModal: React.FC<Props> = ({ isOpen, address, onConfirm, onCancel, isLoading = false }) => {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onCancel, isLoading])

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem'
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          backgroundColor: '#1f2937',
          color: 'white',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid #374151'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <h3 
          id="modal-title"
          style={{ 
            margin: '0 0 1rem 0', 
            fontSize: '1.25rem', 
            fontWeight: 'bold',
            color: '#f3f4f6'
          }}
        >
          Switch Active Address
        </h3>
        
        <div id="modal-description" style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 1rem 0', color: '#d1d5db' }}>
            Set <strong style={{ color: '#60a5fa' }}>{address}</strong> as the active address and reload portfolio?
          </p>
          <p style={{ 
            margin: 0, 
            fontSize: '0.875rem', 
            color: '#9ca3af',
            fontStyle: 'italic'
          }}>
            Note: This will not connect a wallet; it only reloads data for that address.
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid #6b7280',
              backgroundColor: 'transparent',
              color: '#d1d5db',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              opacity: isLoading ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#374151'
                e.currentTarget.style.borderColor = '#9ca3af'
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderColor = '#6b7280'
              }
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isLoading ? '#6b7280' : '#3b82f6',
              color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#3b82f6'
              }
            }}
          >
            {isLoading && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            )}
            {isLoading ? 'Loading...' : 'Proceed'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default ConfirmAddressModal