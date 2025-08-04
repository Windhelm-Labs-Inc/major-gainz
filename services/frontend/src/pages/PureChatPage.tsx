import React from 'react'

const PureChatPage: React.FC = () => {
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
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>💬</div>
        <h1 style={{ 
          color: '#495057',
          marginBottom: '1rem',
          fontSize: '2.5rem',
          fontWeight: '600'
        }}>
          Pure-Chat
        </h1>
        <p style={{ 
          color: '#6c757d',
          fontSize: '1.1rem',
          lineHeight: '1.6',
          marginBottom: '2rem'
        }}>
          Welcome to Pure-Chat! This page is currently under development.
        </p>
        <div style={{
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #bbdefb'
        }}>
          <p style={{ 
            margin: 0,
            color: '#1565c0',
            fontSize: '0.9rem'
          }}>
            🚧 Coming soon: A streamlined chat interface for direct AI interaction without portfolio context.
          </p>
        </div>
      </div>
    </div>
  )
}

export default PureChatPage