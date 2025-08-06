// Environment variables bundled at build time
declare const __WALLETCONNECT_PROJECT_ID__: string
declare const __HEDERA_NETWORK__: string
import { useState, useEffect } from 'react'
import Navigation from './components/Navigation'
import QuickOriginsPage from './pages/QuickOriginsPage'
import PureChatPage from './pages/PureChatPage'
import MajorGainzPage from './pages/MajorGainzPage'
import './App.css'

type PageType = 'major-gainz' | 'pure-chat' | 'quick-origins'

function App() {
  // Page navigation state
  const [currentPage, setCurrentPage] = useState<PageType>('pure-chat') // Default to Pure-Chat as specified

  // Handle page changes with browser history integration
  const handlePageChange = (page: PageType) => {
    setCurrentPage(page)
    // Update browser history
    const pageUrls = {
      'major-gainz': '/major-gainz',
      'pure-chat': '/pure-chat', 
      'quick-origins': '/quick-origins'
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
        if (path.includes('major-gainz')) {
          setCurrentPage('major-gainz')
        } else if (path.includes('quick-origins')) {
          setCurrentPage('quick-origins')
        } else {
          setCurrentPage('pure-chat')
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Initialize with current URL on first load
  useEffect(() => {
    const path = window.location.pathname
    let initialPage: PageType = 'pure-chat' // default
    
    if (path.includes('major-gainz')) {
      initialPage = 'major-gainz'
    } else if (path.includes('quick-origins')) {
      initialPage = 'quick-origins'
    }
    
    if (initialPage !== currentPage) {
      setCurrentPage(initialPage)
    }
  }, [])

  // Render the appropriate page component
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'major-gainz':
        return <MajorGainzPage />
      case 'pure-chat':
        return <PureChatPage />
      case 'quick-origins':
        return <QuickOriginsPage />
      default:
        return <PureChatPage />
    }
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%' }}>
      {/* Navigation Bar */}
      <Navigation currentPage={currentPage} onPageChange={handlePageChange} />
      
      {/* Page Content */}
      <div style={{ paddingTop: '60px' }}> {/* Add padding to account for fixed navigation */}
        {renderCurrentPage()}
      </div>
    </div>
  )
}

export default App