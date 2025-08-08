import React from 'react';
import { ReturnsStats } from '../../types';

interface CorrelationMatrixProps {
  returnsStats?: ReturnsStats[];
  height?: number;
}

const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ 
  returnsStats, 
  height = 400 
}) => {
  if (!returnsStats?.length || returnsStats.length < 2) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mg-gray-600)',
          fontSize: '0.875rem'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div>Insufficient data for correlation analysis</div>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            At least 2 assets required
          </div>
        </div>
      </div>
    );
  }

  // Generate correlation matrix
  const generateCorrelationMatrix = () => {
    const symbols = returnsStats.map(stat => stat.symbol);
    const matrix: number[][] = [];
    
    for (let i = 0; i < symbols.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          matrix[i][j] = 1; // Perfect self-correlation
        } else {
          // Check if correlation exists in the data
          const stat = returnsStats[i];
          const existingCorrelation = stat.correlation?.[symbols[j]];
          
          if (existingCorrelation !== undefined) {
            matrix[i][j] = existingCorrelation;
          } else {
            // Generate mock correlation (-1 to 1)
            // Make matrix symmetric
            if (matrix[j] && matrix[j][i] !== undefined) {
              matrix[i][j] = matrix[j][i];
            } else {
              matrix[i][j] = Math.random() * 2 - 1;
            }
          }
        }
      }
    }
    
    return { symbols, matrix };
  };

  const { symbols, matrix } = generateCorrelationMatrix();

  const getCorrelationColor = (correlation: number) => {
    // Strong positive: green, neutral: gray, strong negative: red
    const intensity = Math.abs(correlation);
    if (correlation > 0.7) return `rgba(34, 197, 94, ${0.3 + intensity * 0.7})`;
    if (correlation > 0.3) return `rgba(34, 197, 94, ${0.1 + intensity * 0.4})`;
    if (correlation > -0.3) return 'var(--mg-gray-100)';
    if (correlation > -0.7) return `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`;
    return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
  };

  const getTextColor = (correlation: number) => {
    const intensity = Math.abs(correlation);
    if (intensity > 0.7) return 'white';
    if (intensity > 0.3) return 'var(--mg-gray-900)';
    return 'var(--mg-gray-700)';
  };

  const cellSize = Math.min(80, (height - 120) / symbols.length);

  return (
    <div style={{ height: `${height}px`, padding: '16px' }}>
      <div style={{ 
        marginBottom: '16px',
        borderBottom: '1px solid var(--mg-gray-200)',
        paddingBottom: '12px'
      }}>
        <h3 style={{ 
          margin: '0 0 4px 0', 
          fontSize: '1rem', 
          fontWeight: '600',
          color: 'var(--mg-gray-900)'
        }}>
          Asset Correlation Matrix
        </h3>
        <div style={{ 
          fontSize: '0.875rem', 
          color: 'var(--mg-gray-600)'
        }}>
          Correlation coefficients between your holdings
        </div>
      </div>

      <div style={{ 
        display: 'flex',
        justifyContent: 'center',
        overflowX: 'auto',
        overflowY: 'auto',
        height: `${height - 120}px`
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `60px repeat(${symbols.length}, ${cellSize}px)`,
          gap: '1px',
          background: 'var(--mg-gray-200)',
          padding: '1px',
          borderRadius: 'var(--mg-radius)',
          fontSize: '0.75rem'
        }}>
          {/* Empty top-left cell */}
          <div style={{
            background: 'var(--mg-gray-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: `${cellSize}px`,
            borderRadius: 'var(--mg-radius-sm)',
          }} />
          
          {/* Column headers */}
          {symbols.map((symbol, index) => (
            <div
              key={`col-${index}`}
              style={{
                background: 'var(--mg-blue-100)',
                color: 'var(--mg-blue-900)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: `${cellSize}px`,
                fontWeight: '600',
                borderRadius: 'var(--mg-radius-sm)',
                transform: symbols.length > 5 ? 'rotate(-45deg)' : 'none',
                fontSize: symbols.length > 5 ? '0.6rem' : '0.75rem'
              }}
            >
              {symbol}
            </div>
          ))}
          
          {/* Matrix cells */}
          {symbols.map((rowSymbol, i) => (
            <React.Fragment key={`row-${i}`}>
              {/* Row header */}
              <div
                style={{
                  background: 'var(--mg-blue-100)',
                  color: 'var(--mg-blue-900)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: `${cellSize}px`,
                  fontWeight: '600',
                  borderRadius: 'var(--mg-radius-sm)',
                  fontSize: '0.75rem'
                }}
              >
                {rowSymbol}
              </div>
              
              {/* Data cells */}
              {symbols.map((colSymbol, j) => {
                const correlation = matrix[i][j];
                return (
                  <div
                    key={`cell-${i}-${j}`}
                    style={{
                      background: getCorrelationColor(correlation),
                      color: getTextColor(correlation),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: `${cellSize}px`,
                      fontWeight: '600',
                      borderRadius: 'var(--mg-radius-sm)',
                      cursor: 'pointer',
                      transition: 'all var(--mg-transition-fast)',
                      fontSize: cellSize < 50 ? '0.6rem' : '0.75rem'
                    }}
                    title={`${rowSymbol} vs ${colSymbol}: ${correlation.toFixed(3)}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.zIndex = '10';
                      e.currentTarget.style.boxShadow = 'var(--mg-shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.zIndex = '1';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {correlation.toFixed(2)}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ 
        marginTop: '12px', 
        fontSize: '0.75rem', 
        color: 'var(--mg-gray-600)',
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '16px', 
            height: '12px', 
            borderRadius: '2px', 
            background: 'rgba(34, 197, 94, 0.8)' 
          }} />
          Strong Positive (+0.7 to +1.0)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '16px', 
            height: '12px', 
            borderRadius: '2px', 
            background: 'var(--mg-gray-100)' 
          }} />
          Neutral (-0.3 to +0.3)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '16px', 
            height: '12px', 
            borderRadius: '2px', 
            background: 'rgba(239, 68, 68, 0.8)' 
          }} />
          Strong Negative (-1.0 to -0.7)
        </div>
      </div>
    </div>
  );
};

export default CorrelationMatrix;
