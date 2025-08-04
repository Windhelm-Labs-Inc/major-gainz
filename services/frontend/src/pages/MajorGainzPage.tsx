import React from 'react'

const MajorGainzPage: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)', // Account for navigation height
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '600px',
        padding: '3rem 2rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        border: '2px solid #e9ecef',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📈</div>
        <h1 style={{ 
          color: '#495057',
          marginBottom: '1rem',
          fontSize: '2.5rem',
          fontWeight: '600'
        }}>
          Major Gainz
        </h1>
        <p style={{ 
          color: '#6c757d',
          fontSize: '1.1rem',
          lineHeight: '1.6',
          marginBottom: '2rem'
        }}>
          Welcome to Major Gainz! This page is currently under development.
        </p>
        <div style={{
          padding: '1rem',
          backgroundColor: '#e8f5e8',
          borderRadius: '8px',
          border: '1px solid #a5d6a7'
        }}>
          <p style={{ 
            margin: 0,
            color: '#2e7d32',
            fontSize: '0.9rem'
          }}>
            🚀 Coming soon: Advanced trading insights, market analysis, and profit optimization tools.
          </p>
        </div>
      </div>
    </div>
  )
}

export default MajorGainzPage