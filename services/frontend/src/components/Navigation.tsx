import React from 'react'

interface NavigationProps {
  currentPage: 'major-gainz' | 'pure-chat' | 'quick-origins'
  onPageChange: (page: 'major-gainz' | 'pure-chat' | 'quick-origins') => void
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onPageChange }) => {
  const buttons = [
    { id: 'major-gainz' as const, label: 'Major Gainz' },
    { id: 'pure-chat' as const, label: 'Pure-Chat' },
    { id: 'quick-origins' as const, label: 'Quick Origins' }
  ]

  return (
    <nav className="navigation-bar">
      <div className="nav-button-group">
        {buttons.map((button) => (
          <button
            key={button.id}
            className={`nav-btn ${currentPage === button.id ? 'nav-btn--active' : ''}`}
            onClick={() => onPageChange(button.id)}
            aria-pressed={currentPage === button.id}
          >
            {button.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

export default Navigation