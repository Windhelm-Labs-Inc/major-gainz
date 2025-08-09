// Environment variables bundled at build time
declare const __WALLETCONNECT_PROJECT_ID__: string
declare const __HEDERA_NETWORK__: string
import { useState, useEffect } from 'react'
import MajorGainzPage from './majorgainz/MajorGainzPage'
import './App.css'

type PageType = 'major-gainz'

function App() {
  // Page navigation state
  const [currentPage, setCurrentPage] = useState<PageType>('major-gainz') // Default to Major Gainz

  // Handle page changes with browser history integration
  const handlePageChange = (page: PageType) => {
    setCurrentPage(page)
    // Update browser history
    const pageUrls = {
      'major-gainz': '/',
    }
    window.history.pushState({ page }, '', pageUrls[page])
  }

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.page) {
        setCurrentPage(event.state.page)
      } else {
        // Default fallback based on current URL
        const path = window.location.pathname
        {
          setCurrentPage('major-gainz')
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Initialize with current URL on first load
  useEffect(() => {
    const path = window.location.pathname
    let initialPage: PageType = 'major-gainz' // default
    
    if (initialPage !== currentPage) {
      setCurrentPage(initialPage)
    }
  }, [])

  // Render the appropriate page component
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'major-gainz':
        return <MajorGainzPage />
      default:
        return <MajorGainzPage />
    }
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%' }}>
      {/* Page Content */}
      <div style={{ paddingTop: currentPage !== 'major-gainz' ? '60px' : '0' }}>
        {renderCurrentPage()}
      </div>
      
      {/* Navigation toggle for Major Gainz */}
      {/* {currentPage === 'major-gainz' && (
        <button
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 25,
            background: 'var(--mg-white)',
            border: '2px solid var(--mg-gray-300)',
            borderRadius: 'var(--mg-radius)',
            padding: '8px 12px',
            cursor: 'pointer',
            boxShadow: 'var(--mg-shadow)',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'var(--mg-gray-700)',
            transition: 'all var(--mg-transition)',
          }}
          onClick={() => handlePageChange('pure-chat')}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--mg-mint-500)';
            e.currentTarget.style.background = 'var(--mg-mint-100)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--mg-gray-300)';
            e.currentTarget.style.background = 'var(--mg-white)';
          }}
        >
          ☰ Menu
        </button>
      )} */}
    </div>
  )
}

export default App