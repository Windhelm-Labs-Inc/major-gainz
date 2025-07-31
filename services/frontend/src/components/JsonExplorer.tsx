import React, { useState, useRef, useCallback } from 'react'

interface JsonExplorerProps {
  data: any
  isLoading?: boolean
  onWidthChange?: (width: number) => void
}

const JsonExplorer: React.FC<JsonExplorerProps> = ({ data, isLoading, onWidthChange }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['root']))
  const [width, setWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(250, Math.min(800, window.innerWidth - e.clientX))
      setWidth(newWidth)
      if (onWidthChange) {
        onWidthChange(newWidth)
      }
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onWidthChange])

  const renderValue = (value: any, path: string): React.ReactNode => {
    if (value === null) {
      return <span style={{ color: '#888', fontStyle: 'italic' }}>null</span>
    }
    if (value === undefined) {
      return <span style={{ color: '#888', fontStyle: 'italic' }}>undefined</span>
    }
    if (typeof value === 'boolean') {
      return <span style={{ color: '#0066cc', fontWeight: 'bold' }}>{value.toString()}</span>
    }
    if (typeof value === 'number') {
      return <span style={{ color: '#cc6600' }}>{value}</span>
    }
    if (typeof value === 'string') {
      return <span style={{ color: '#009900' }}>"{value}"</span>
    }
    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path)
      return (
        <div>
          <span 
            style={{ cursor: 'pointer', color: '#666', userSelect: 'none' }}
            onClick={() => toggleExpanded(path)}
          >
            {isExpanded ? '▼' : '▶'} Array[{value.length}]
          </span>
          {isExpanded && (
            <div style={{ marginLeft: '20px', borderLeft: '1px solid #ddd', paddingLeft: '10px' }}>
              {value.map((item, index) => (
                <div key={index} style={{ margin: '5px 0' }}>
                  <span style={{ color: '#666', marginRight: '10px' }}>
                    [{index}]:
                  </span>
                  {renderValue(item, `${path}[${index}]`)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value)
      const isExpanded = expandedPaths.has(path)
      return (
        <div>
          <span 
            style={{ cursor: 'pointer', color: '#666', userSelect: 'none' }}
            onClick={() => toggleExpanded(path)}
          >
            {isExpanded ? '▼' : '▶'} Object{keys.length > 0 ? ` {${keys.length} keys}` : ' {}'}
          </span>
          {isExpanded && keys.length > 0 && (
            <div style={{ marginLeft: '20px', borderLeft: '1px solid #ddd', paddingLeft: '10px' }}>
              {keys.map(objKey => (
                <div key={objKey} style={{ margin: '5px 0' }}>
                  <span style={{ color: '#0066cc', fontWeight: 'bold', marginRight: '10px' }}>
                    {objKey}:
                  </span>
                  {renderValue(value[objKey], `${path}.${objKey}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    return <span>{String(value)}</span>
  }

  const baseStyle: React.CSSProperties = {
    width: `${width}px`,
    height: '100vh',
    backgroundColor: '#f8f9fa',
    borderLeft: '1px solid #ddd',
    padding: '20px',
    paddingLeft: '30px', // Leave space for resize handle
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '14px',
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: 1000,
    userSelect: isResizing ? 'none' : 'auto',
    transition: isResizing ? 'none' : 'width 0.1s ease'
  }

  if (isLoading) {
    return (
      <div style={baseStyle}>
        {/* Resize Handle */}
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '10px',
            height: '100%',
            cursor: 'col-resize',
            backgroundColor: 'transparent',
            borderRight: '3px solid #007bff',
            opacity: isResizing ? 1 : 0.3,
            transition: 'opacity 0.2s ease',
            zIndex: 1001
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.opacity = '0.7'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.opacity = '0.3'
            }
          }}
        />
        
        <h3 style={{ 
          color: '#dc3545', 
          marginTop: 0, 
          marginBottom: '20px',
          textAlign: 'center',
          borderBottom: '2px solid #dc3545',
          paddingBottom: '10px'
        }}>
          TEMPORARY DEFI VALIDATION PANEL
        </h3>
        <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
          Loading DeFi data...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={baseStyle}>
        {/* Resize Handle */}
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '10px',
            height: '100%',
            cursor: 'col-resize',
            backgroundColor: 'transparent',
            borderRight: '3px solid #007bff',
            opacity: isResizing ? 1 : 0.3,
            transition: 'opacity 0.2s ease',
            zIndex: 1001
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.opacity = '0.7'
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.opacity = '0.3'
            }
          }}
        />
        
        <h3 style={{ 
          color: '#dc3545', 
          marginTop: 0, 
          marginBottom: '20px',
          textAlign: 'center',
          borderBottom: '2px solid #dc3545',
          paddingBottom: '10px'
        }}>
          TEMPORARY DEFI VALIDATION PANEL
        </h3>
        <div style={{ textAlign: 'center', color: '#666', marginTop: '50px' }}>
          No DeFi data available.<br/>
          Click "Load Portfolio" to fetch data.
        </div>
      </div>
    )
  }

  return (
    <div style={baseStyle}>
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '10px',
          height: '100%',
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          borderRight: '3px solid #007bff',
          opacity: isResizing ? 1 : 0.3,
          transition: 'opacity 0.2s ease',
          zIndex: 1001
        }}
        onMouseEnter={(e) => {
          if (!isResizing) {
            e.currentTarget.style.opacity = '0.7'
          }
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.opacity = '0.3'
          }
        }}
      />
      
      <h3 style={{ 
        color: '#dc3545', 
        marginTop: 0, 
        marginBottom: '20px',
        textAlign: 'center',
        borderBottom: '2px solid #dc3545',
        paddingBottom: '10px'
      }}>
        TEMPORARY DEFI VALIDATION PANEL
      </h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Expand All:</strong>
        <button 
          style={{ marginLeft: '10px', marginRight: '5px', padding: '2px 6px', fontSize: '12px' }}
          onClick={() => {
            const allPaths = new Set<string>()
            const collectPaths = (obj: any, path: string) => {
              allPaths.add(path)
              if (obj && typeof obj === 'object') {
                if (Array.isArray(obj)) {
                  obj.forEach((item, index) => collectPaths(item, `${path}[${index}]`))
                } else {
                  Object.keys(obj).forEach(key => collectPaths(obj[key], `${path}.${key}`))
                }
              }
            }
            collectPaths(data, 'root')
            setExpandedPaths(allPaths)
          }}
        >
          All
        </button>
        <button 
          style={{ padding: '2px 6px', fontSize: '12px' }}
          onClick={() => setExpandedPaths(new Set(['root']))}
        >
          Collapse
        </button>
      </div>

      <div>
        {renderValue(data, 'root')}
      </div>
    </div>
  )
}

export default JsonExplorer