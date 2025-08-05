import React, { useMemo, useState } from 'react';
import { PureChatReturnsStats } from '../../types/pureChatTypes';
import { ChartComponentProps } from '../../types/enhancedMessage';

interface Props extends ChartComponentProps {
  data: PureChatReturnsStats[];
  onCorrelationSelect?: (token1: string, token2: string, correlation: number) => void;
}

interface CorrelationCell {
  token1: string;
  token2: string;
  correlation: number;
  x: number;
  y: number;
  size: number;
}

const CorrelationMatrix: React.FC<Props> = ({
  data,
  title = "Token Return Correlations",
  height = 500,
  onCorrelationSelect,
  theme = 'light'
}) => {
  const [hoveredCell, setHoveredCell] = useState<CorrelationCell | null>(null);
  const [selectedCell, setSelectedCell] = useState<CorrelationCell | null>(null);

  // Calculate correlation matrix
  const correlationMatrix = useMemo(() => {
    const tokens = data.map(d => d.token);
    const matrix: Record<string, Record<string, number>> = {};

    // Initialize matrix
    tokens.forEach(token1 => {
      matrix[token1] = {};
      tokens.forEach(token2 => {
        matrix[token1][token2] = 0;
      });
    });

    // Calculate correlations
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        const token1 = tokens[i];
        const token2 = tokens[j];
        
        if (i === j) {
          matrix[token1][token2] = 1; // Perfect correlation with self
        } else {
          const returns1 = data[i].dailyReturns;
          const returns2 = data[j].dailyReturns;
          
          // Calculate Pearson correlation
          const correlation = calculateCorrelation(returns1, returns2);
          matrix[token1][token2] = correlation;
        }
      }
    }

    return matrix;
  }, [data]);

  const calculateCorrelation = (x: number[], y: number[]): number => {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      numerator += deltaX * deltaY;
      sumSqX += deltaX * deltaX;
      sumSqY += deltaY * deltaY;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  };

  // Create matrix cells for visualization
  const matrixCells = useMemo(() => {
    const tokens = data.map(d => d.token);
    const cells: CorrelationCell[] = [];
    const cellSize = 100 / tokens.length;

    tokens.forEach((token1, i) => {
      tokens.forEach((token2, j) => {
        cells.push({
          token1,
          token2,
          correlation: correlationMatrix[token1][token2],
          x: j * cellSize,
          y: i * cellSize,
          size: cellSize
        });
      });
    });

    return cells;
  }, [correlationMatrix, data]);

  const getCorrelationColor = (correlation: number) => {
    // Color scale from red (negative) through white (zero) to blue (positive)
    const abs = Math.abs(correlation);
    if (correlation > 0) {
      // Positive correlation: white to blue
      const intensity = Math.round(abs * 255);
      return `rgb(${255 - intensity}, ${255 - intensity}, 255)`;
    } else {
      // Negative correlation: white to red  
      const intensity = Math.round(abs * 255);
      return `rgb(255, ${255 - intensity}, ${255 - intensity})`;
    }
  };

  const getCorrelationInterpretation = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'Very Strong';
    if (abs >= 0.6) return 'Strong';
    if (abs >= 0.4) return 'Moderate';
    if (abs >= 0.2) return 'Weak';
    return 'Very Weak';
  };

  const tokens = data.map(d => d.token);

  return (
    <div className={`correlation-matrix ${theme}`}>
      <div className="matrix-header">
        <h3>{title}</h3>
        <div className="matrix-info">
          <span>Tokens: {tokens.length}</span>
          <span>Period: {data[0]?.days || 0} days</span>
        </div>
      </div>

      <div className="matrix-container" style={{ height: height - 100 }}>
        {/* Token labels - top */}
        <div className="top-labels">
          {tokens.map((token, index) => (
            <div
              key={token}
              className="label"
              style={{
                left: `${(index * 100) / tokens.length + (50 / tokens.length)}%`,
                transform: 'translateX(-50%) rotate(-45deg)'
              }}
            >
              {token}
            </div>
          ))}
        </div>

        {/* Token labels - left */}
        <div className="left-labels">
          {tokens.map((token, index) => (
            <div
              key={token}
              className="label"
              style={{
                top: `${(index * 100) / tokens.length + (50 / tokens.length)}%`,
                transform: 'translateY(-50%)'
              }}
            >
              {token}
            </div>
          ))}
        </div>

        {/* Matrix grid */}
        <div className="matrix-grid">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            {matrixCells.map((cell, index) => (
              <g key={index}>
                <rect
                  x={cell.x}
                  y={cell.y}
                  width={cell.size}
                  height={cell.size}
                  fill={getCorrelationColor(cell.correlation)}
                  stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
                  strokeWidth="0.1"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                  onClick={() => {
                    setSelectedCell(cell);
                    onCorrelationSelect?.(cell.token1, cell.token2, cell.correlation);
                  }}
                />
                <text
                  x={cell.x + cell.size / 2}
                  y={cell.y + cell.size / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(0.8, 3 / tokens.length)}
                  fill={
                    Math.abs(cell.correlation) > 0.5 
                      ? '#ffffff' 
                      : theme === 'dark' ? '#f9fafb' : '#1f2937'
                  }
                  style={{ pointerEvents: 'none' }}
                >
                  {cell.correlation.toFixed(2)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Correlation tooltip */}
        {hoveredCell && (
          <div className="correlation-tooltip">
            <div className="tooltip-header">
              {hoveredCell.token1} vs {hoveredCell.token2}
            </div>
            <div className="tooltip-content">
              <div>Correlation: {hoveredCell.correlation.toFixed(3)}</div>
              <div>Strength: {getCorrelationInterpretation(hoveredCell.correlation)}</div>
              <div>
                Direction: {hoveredCell.correlation > 0 ? 'Positive' : 'Negative'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Color scale legend */}
      <div className="correlation-legend">
        <div className="legend-title">Correlation Strength</div>
        <div className="color-scale">
          <div className="scale-item">
            <div className="color-box" style={{ backgroundColor: 'rgb(255, 100, 100)' }}></div>
            <span>-1.0</span>
          </div>
          <div className="scale-item">
            <div className="color-box" style={{ backgroundColor: 'rgb(255, 200, 200)' }}></div>
            <span>-0.5</span>
          </div>
          <div className="scale-item">
            <div className="color-box" style={{ backgroundColor: 'rgb(255, 255, 255)' }}></div>
            <span>0.0</span>
          </div>
          <div className="scale-item">
            <div className="color-box" style={{ backgroundColor: 'rgb(200, 200, 255)' }}></div>
            <span>+0.5</span>
          </div>
          <div className="scale-item">
            <div className="color-box" style={{ backgroundColor: 'rgb(100, 100, 255)' }}></div>
            <span>+1.0</span>
          </div>
        </div>
      </div>

      {/* Correlation insights */}
      <div className="correlation-insights">
        <div className="insight-cards">
          <div className="insight-card">
            <div className="insight-title">Highest Positive</div>
            <div className="insight-value">
              {(() => {
                let maxCorr = -1;
                let maxPair = '';
                matrixCells.forEach(cell => {
                  if (cell.token1 !== cell.token2 && cell.correlation > maxCorr) {
                    maxCorr = cell.correlation;
                    maxPair = `${cell.token1}-${cell.token2}`;
                  }
                });
                return `${maxPair}: ${maxCorr.toFixed(3)}`;
              })()}
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-title">Highest Negative</div>
            <div className="insight-value">
              {(() => {
                let minCorr = 1;
                let minPair = '';
                matrixCells.forEach(cell => {
                  if (cell.token1 !== cell.token2 && cell.correlation < minCorr) {
                    minCorr = cell.correlation;
                    minPair = `${cell.token1}-${cell.token2}`;
                  }
                });
                return `${minPair}: ${minCorr.toFixed(3)}`;
              })()}
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-title">Average Correlation</div>
            <div className="insight-value">
              {(() => {
                const offDiagonal = matrixCells.filter(cell => cell.token1 !== cell.token2);
                const avg = offDiagonal.reduce((sum, cell) => sum + Math.abs(cell.correlation), 0) / offDiagonal.length;
                return avg.toFixed(3);
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Selected correlation details */}
      {selectedCell && (
        <div className="correlation-details">
          <div className="details-header">
            <h4>{selectedCell.token1} vs {selectedCell.token2}</h4>
            <button onClick={() => setSelectedCell(null)}>×</button>
          </div>
          
          <div className="details-content">
            <div className="detail-row">
              <span>Correlation Coefficient:</span>
              <span className="correlation-value">{selectedCell.correlation.toFixed(4)}</span>
            </div>
            <div className="detail-row">
              <span>Interpretation:</span>
              <span>{getCorrelationInterpretation(selectedCell.correlation)}</span>
            </div>
            <div className="detail-row">
              <span>Direction:</span>
              <span>{selectedCell.correlation > 0 ? 'Positive (move together)' : 'Negative (move opposite)'}</span>
            </div>
            <div className="detail-row">
              <span>Strength:</span>
              <span>{Math.abs(selectedCell.correlation * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="correlation-explanation">
            <p>
              {selectedCell.correlation > 0.7 
                ? "These tokens move very similarly - when one goes up, the other typically follows."
                : selectedCell.correlation < -0.7
                ? "These tokens move in opposite directions - good for diversification."
                : Math.abs(selectedCell.correlation) < 0.3
                ? "These tokens move relatively independently of each other."
                : "These tokens show some relationship but maintain significant independence."
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrelationMatrix;