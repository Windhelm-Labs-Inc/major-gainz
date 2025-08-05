import React, { useState, useMemo } from 'react';
import { PureChatDefiData, PureChatDefiPosition } from '../../types/pureChatTypes';
import { ChartComponentProps } from '../../types/enhancedMessage';

interface Props extends ChartComponentProps {
  data: PureChatDefiData;
  sortBy?: 'apy' | 'tvl' | 'risk';
  filterBy?: string;
  maxItems?: number;
  onPositionSelect?: (position: PureChatDefiPosition) => void;
}

interface HeatmapCell {
  position: PureChatDefiPosition;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  color: string;
  intensity: number;
}

const EnhancedDefiHeatmap: React.FC<Props> = ({
  data,
  title = "DeFi Opportunities Heatmap",
  height = 600,
  sortBy = 'apy',
  filterBy,
  maxItems = 20,
  onPositionSelect,
  theme = 'light'
}) => {
  const [selectedPosition, setSelectedPosition] = useState<PureChatDefiPosition | null>(null);
  const [viewMode, setViewMode] = useState<'heatmap' | 'grid' | 'list'>('heatmap');
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  // Extract positions from the platforms data
  const positions = useMemo(() => {
    const allPositions: PureChatDefiPosition[] = [];
    
    Object.entries(data.platforms).forEach(([platformName, platformData]) => {
      if (platformData && typeof platformData === 'object') {
        // Handle different platform data structures
        if (Array.isArray(platformData)) {
          allPositions.push(...platformData);
        } else if (platformData.positions && Array.isArray(platformData.positions)) {
          allPositions.push(...platformData.positions);
        } else if (platformData.supplied || platformData.borrowed) {
          // Handle specific platform structures like Bonzo Finance
          if (platformData.supplied) {
            const supplied = Array.isArray(platformData.supplied) ? platformData.supplied : [platformData.supplied];
            supplied.forEach((pos: any) => {
              allPositions.push({
                platform: platformName,
                protocol: platformName,
                type: 'supply',
                amount: pos.amount || 0,
                usd_value: pos.usd_value || pos.value || 0,
                token_symbol: pos.token_symbol || pos.symbol || 'Unknown',
                apy: pos.apy || pos.supply_apy || 0,
                risk_level: pos.risk_level || 'medium'
              });
            });
          }
          if (platformData.borrowed) {
            const borrowed = Array.isArray(platformData.borrowed) ? platformData.borrowed : [platformData.borrowed];
            borrowed.forEach((pos: any) => {
              allPositions.push({
                platform: platformName,
                protocol: platformName,
                type: 'borrow',
                amount: pos.amount || 0,
                usd_value: pos.usd_value || pos.value || 0,
                token_symbol: pos.token_symbol || pos.symbol || 'Unknown',
                apy: pos.apy || pos.borrow_apy || 0,
                risk_level: pos.risk_level || 'medium'
              });
            });
          }
        }
      }
    });

    return allPositions.slice(0, maxItems);
  }, [data.platforms, maxItems]);

  // Sort and filter positions
  const processedPositions = useMemo(() => {
    let filtered = positions;
    
    if (filterBy) {
      filtered = positions.filter(pos => 
        pos.platform.toLowerCase().includes(filterBy.toLowerCase()) ||
        pos.token_symbol.toLowerCase().includes(filterBy.toLowerCase()) ||
        pos.type.toLowerCase().includes(filterBy.toLowerCase())
      );
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'apy':
          return (b.apy || 0) - (a.apy || 0);
        case 'tvl':
          return b.usd_value - a.usd_value;
        case 'risk':
          const riskOrder = { 'low': 0, 'medium': 1, 'high': 2 };
          return (riskOrder[a.risk_level as keyof typeof riskOrder] || 1) - 
                 (riskOrder[b.risk_level as keyof typeof riskOrder] || 1);
        default:
          return 0;
      }
    });
  }, [positions, sortBy, filterBy]);

  // Create heatmap cells
  const heatmapCells = useMemo(() => {
    const cells: HeatmapCell[] = [];
    const gridSize = Math.ceil(Math.sqrt(processedPositions.length));
    const cellWidth = 100 / gridSize;
    const cellHeight = 100 / gridSize;

    // Find min/max values for color scaling
    const values = processedPositions.map(p => p.apy || 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue;

    processedPositions.forEach((position, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      const normalizedValue = valueRange > 0 ? (position.apy! - minValue) / valueRange : 0;
      
      // Color based on APY and risk
      const getRiskColor = (risk: string) => {
        switch (risk) {
          case 'low': return '#10b981'; // green
          case 'high': return '#ef4444'; // red
          default: return '#f59e0b'; // orange
        }
      };

      const baseColor = getRiskColor(position.risk_level || 'medium');
      const intensity = Math.max(0.3, normalizedValue);

      cells.push({
        position,
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        value: position.apy || 0,
        color: baseColor,
        intensity
      });
    });

    return cells;
  }, [processedPositions]);

  const getPositionTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'supply': return '💰';
      case 'borrow': return '📈';
      case 'stake': return '🔒';
      case 'farm': return '🌾';
      default: return '💼';
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'low': return '#10b981';
      case 'high': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  const renderHeatmap = () => (
    <div className="heatmap-container" style={{ height: height - 200 }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {heatmapCells.map((cell, index) => (
          <g key={index}>
            <rect
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
              fill={cell.color}
              fillOpacity={cell.intensity}
              stroke={theme === 'dark' ? '#374151' : '#e5e7eb'}
              strokeWidth="0.2"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredCell(cell)}
              onMouseLeave={() => setHoveredCell(null)}
              onClick={() => {
                setSelectedPosition(cell.position);
                onPositionSelect?.(cell.position);
              }}
            />
            <text
              x={cell.x + cell.width / 2}
              y={cell.y + cell.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="1.5"
              fill={theme === 'dark' ? '#f9fafb' : '#1f2937'}
              style={{ pointerEvents: 'none' }}
            >
              {getPositionTypeIcon(cell.position.type)}
            </text>
            <text
              x={cell.x + cell.width / 2}
              y={cell.y + cell.height / 2 + 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="1"
              fill={theme === 'dark' ? '#e5e7eb' : '#374151'}
              style={{ pointerEvents: 'none' }}
            >
              {cell.position.token_symbol}
            </text>
          </g>
        ))}
      </svg>

      {/* Heatmap Tooltip */}
      {hoveredCell && (
        <div className="heatmap-tooltip">
          <div className="tooltip-header">
            <span>{hoveredCell.position.platform}</span>
            <span className="risk-badge" style={{ backgroundColor: getRiskBadgeColor(hoveredCell.position.risk_level || 'medium') }}>
              {hoveredCell.position.risk_level || 'medium'}
            </span>
          </div>
          <div className="tooltip-content">
            <div>Token: {hoveredCell.position.token_symbol}</div>
            <div>Type: {hoveredCell.position.type}</div>
            <div>APY: {(hoveredCell.position.apy || 0).toFixed(2)}%</div>
            <div>Value: ${hoveredCell.position.usd_value.toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderGrid = () => (
    <div className="positions-grid">
      {processedPositions.map((position, index) => (
        <div
          key={index}
          className={`position-card ${selectedPosition === position ? 'selected' : ''}`}
          onClick={() => {
            setSelectedPosition(position);
            onPositionSelect?.(position);
          }}
        >
          <div className="card-header">
            <div className="platform-info">
              <span className="type-icon">{getPositionTypeIcon(position.type)}</span>
              <div>
                <div className="platform-name">{position.platform}</div>
                <div className="token-symbol">{position.token_symbol}</div>
              </div>
            </div>
            <div className="risk-badge" style={{ backgroundColor: getRiskBadgeColor(position.risk_level || 'medium') }}>
              {position.risk_level || 'medium'}
            </div>
          </div>
          
          <div className="card-metrics">
            <div className="metric">
              <span className="metric-label">APY</span>
              <span className="metric-value">{(position.apy || 0).toFixed(2)}%</span>
            </div>
            <div className="metric">
              <span className="metric-label">Value</span>
              <span className="metric-value">${position.usd_value.toLocaleString()}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Amount</span>
              <span className="metric-value">{position.amount.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="card-type">{position.type.toUpperCase()}</div>
        </div>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="positions-list">
      <div className="list-header">
        <div>Platform</div>
        <div>Token</div>
        <div>Type</div>
        <div>APY</div>
        <div>Value</div>
        <div>Risk</div>
      </div>
      {processedPositions.map((position, index) => (
        <div
          key={index}
          className={`list-row ${selectedPosition === position ? 'selected' : ''}`}
          onClick={() => {
            setSelectedPosition(position);
            onPositionSelect?.(position);
          }}
        >
          <div className="platform-cell">
            <span className="type-icon">{getPositionTypeIcon(position.type)}</span>
            {position.platform}
          </div>
          <div>{position.token_symbol}</div>
          <div className="type-cell">{position.type}</div>
          <div className="apy-cell">{(position.apy || 0).toFixed(2)}%</div>
          <div className="value-cell">${position.usd_value.toLocaleString()}</div>
          <div>
            <span className="risk-badge" style={{ backgroundColor: getRiskBadgeColor(position.risk_level || 'medium') }}>
              {position.risk_level || 'medium'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={`enhanced-defi-heatmap ${theme}`}>
      {/* Header with Controls */}
      <div className="heatmap-header">
        <div className="title-section">
          <h3>{title}</h3>
          <div className="summary-stats">
            <span>Total TVL: ${data.totalValueLocked.toLocaleString()}</span>
            <span>Positions: {data.positionCount}</span>
            <span>Platforms: {Object.keys(data.platforms).length}</span>
          </div>
        </div>

        <div className="controls">
          <div className="view-toggle">
            <button 
              className={viewMode === 'heatmap' ? 'active' : ''}
              onClick={() => setViewMode('heatmap')}
            >
              🔥 Heatmap
            </button>
            <button 
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              📊 Grid
            </button>
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              📋 List
            </button>
          </div>

          <select 
            value={sortBy} 
            onChange={(e) => setViewMode(e.target.value as any)}
            className="sort-selector"
          >
            <option value="apy">Sort by APY</option>
            <option value="tvl">Sort by TVL</option>
            <option value="risk">Sort by Risk</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="heatmap-content">
        {viewMode === 'heatmap' && renderHeatmap()}
        {viewMode === 'grid' && renderGrid()}
        {viewMode === 'list' && renderList()}
      </div>

      {/* Selected Position Details */}
      {selectedPosition && (
        <div className="position-details">
          <div className="details-header">
            <h4>
              <span className="type-icon">{getPositionTypeIcon(selectedPosition.type)}</span>
              {selectedPosition.platform} - {selectedPosition.token_symbol}
            </h4>
            <button onClick={() => setSelectedPosition(null)}>×</button>
          </div>
          
          <div className="details-grid">
            <div className="detail-item">
              <span>Platform:</span>
              <span>{selectedPosition.platform}</span>
            </div>
            <div className="detail-item">
              <span>Protocol:</span>
              <span>{selectedPosition.protocol}</span>
            </div>
            <div className="detail-item">
              <span>Type:</span>
              <span className="type-badge">{selectedPosition.type.toUpperCase()}</span>
            </div>
            <div className="detail-item">
              <span>Token:</span>
              <span>{selectedPosition.token_symbol}</span>
            </div>
            <div className="detail-item">
              <span>Amount:</span>
              <span>{selectedPosition.amount.toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <span>USD Value:</span>
              <span>${selectedPosition.usd_value.toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <span>APY:</span>
              <span className="apy-highlight">{(selectedPosition.apy || 0).toFixed(2)}%</span>
            </div>
            <div className="detail-item">
              <span>Risk Level:</span>
              <span 
                className="risk-badge" 
                style={{ backgroundColor: getRiskBadgeColor(selectedPosition.risk_level || 'medium') }}
              >
                {selectedPosition.risk_level || 'medium'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="heatmap-legend">
        <div className="legend-section">
          <span>Risk Levels:</span>
          <div className="risk-legend">
            <div className="legend-item">
              <div className="color-box" style={{ backgroundColor: '#10b981' }}></div>
              <span>Low Risk</span>
            </div>
            <div className="legend-item">
              <div className="color-box" style={{ backgroundColor: '#f59e0b' }}></div>
              <span>Medium Risk</span>
            </div>
            <div className="legend-item">
              <div className="color-box" style={{ backgroundColor: '#ef4444' }}></div>
              <span>High Risk</span>
            </div>
          </div>
        </div>
        
        <div className="legend-section">
          <span>Position Types:</span>
          <div className="type-legend">
            <span>💰 Supply</span>
            <span>📈 Borrow</span>
            <span>🔒 Stake</span>
            <span>🌾 Farm</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDefiHeatmap;