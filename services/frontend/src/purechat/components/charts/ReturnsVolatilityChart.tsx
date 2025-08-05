import React, { useState, useMemo } from 'react';
import { Scatter, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  ChartOptions,
} from 'chart.js';
import { PureChatReturnsStats } from '../../types/pureChatTypes';
import { ChartComponentProps } from '../../types/enhancedMessage';

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend, CategoryScale);

interface Props extends ChartComponentProps {
  data: PureChatReturnsStats[];
  chartType?: 'scatter' | 'timeseries' | 'histogram';
  selectedToken?: string;
  onTokenSelect?: (token: string) => void;
}

const ReturnsVolatilityChart: React.FC<Props> = ({
  data,
  title = "Returns & Volatility Analysis",
  height = 500,
  chartType = 'scatter',
  selectedToken,
  onTokenSelect,
  theme = 'light'
}) => {
  const [viewMode, setViewMode] = useState<'risk-return' | 'timeseries' | 'distribution'>('risk-return');
  const [selectedTokenLocal, setSelectedTokenLocal] = useState<string | null>(selectedToken || null);

  const colorPalette = [
    '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#84cc16', '#f97316', '#3b82f6'
  ];

  // Risk-Return Scatter Plot Data
  const riskReturnData = useMemo(() => {
    const datasets = data.map((stats, index) => {
      const isSelected = selectedTokenLocal === stats.token;
      const baseColor = colorPalette[index % colorPalette.length];
      
      return {
        label: stats.token,
        data: [{
          x: stats.stdReturn * 100, // Convert to percentage
          y: stats.meanReturn * 100, // Convert to percentage
          tokenData: stats
        }],
        backgroundColor: isSelected ? baseColor : baseColor + '80',
        borderColor: baseColor,
        borderWidth: isSelected ? 3 : 2,
        pointRadius: isSelected ? 10 : 8,
        pointHoverRadius: 12,
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff',
        showLine: false
      };
    });

    return { datasets };
  }, [data, selectedTokenLocal, colorPalette]);

  // Time Series Data
  const timeSeriesData = useMemo(() => {
    if (!selectedTokenLocal) return { datasets: [] };
    
    const tokenStats = data.find(d => d.token === selectedTokenLocal);
    if (!tokenStats) return { datasets: [] };

    const dateLabels = tokenStats.dailyReturns.map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (tokenStats.dailyReturns.length - 1 - index));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels: dateLabels,
      datasets: [{
        label: `${selectedTokenLocal} Daily Returns`,
        data: tokenStats.dailyReturns.map(r => r * 100),
        borderColor: colorPalette[0],
        backgroundColor: colorPalette[0] + '20',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2
      }]
    };
  }, [selectedTokenLocal, data, colorPalette]);

  // Risk-Return Scatter Options
  const scatterOptions: ChartOptions<'scatter'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Risk vs Return Profile',
        font: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
        color: theme === 'dark' ? '#f9fafb' : '#1f2937'
      },
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          font: { family: "'Inter', sans-serif" },
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        }
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#f9fafb' : '#1f2937',
        bodyColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        borderColor: theme === 'dark' ? '#374151' : '#d1d5db',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (context) => {
            const point = context[0].raw as any;
            return point.tokenData.token;
          },
          label: (context) => {
            const point = context.raw as any;
            return [
              `Average Return: ${point.y.toFixed(3)}% per day`,
              `Volatility: ${point.x.toFixed(3)}% per day`,
              `Sharpe Ratio: ${(point.y / point.x).toFixed(3)}`,
              `Data Points: ${point.tokenData.days} days`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Daily Volatility (%)',
          font: { family: "'Inter', sans-serif" },
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        grid: {
          color: theme === 'dark' ? '#374151' : '#e5e7eb'
        },
        ticks: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          callback: (value) => `${value}%`
        }
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Average Daily Return (%)',
          font: { family: "'Inter', sans-serif" },
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        grid: {
          color: theme === 'dark' ? '#374151' : '#e5e7eb'
        },
        ticks: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          callback: (value) => `${value}%`
        }
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const datasetIndex = elements[0].datasetIndex;
        const token = data[datasetIndex]?.token;
        if (token) {
          setSelectedTokenLocal(token);
          onTokenSelect?.(token);
        }
      }
    },
    onHover: (event, elements, chart) => {
      const canvas = event.native?.target as HTMLCanvasElement;
      if (canvas) {
        canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
    }
  };

  // Time Series Options
  const timeSeriesOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${selectedTokenLocal} - Daily Returns History`,
        font: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
        color: theme === 'dark' ? '#f9fafb' : '#1f2937'
      },
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#f9fafb' : '#1f2937',
        bodyColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        borderColor: theme === 'dark' ? '#374151' : '#d1d5db',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: (context) => `Return: ${context.parsed.y.toFixed(3)}%`
        }
      }
    },
    scales: {
      x: {
        type: 'category',
        title: {
          display: true,
          text: 'Date',
          font: { family: "'Inter', sans-serif" },
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        grid: {
          color: theme === 'dark' ? '#374151' : '#e5e7eb'
        },
        ticks: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          maxTicksLimit: 8
        }
      },
      y: {
        title: {
          display: true,
          text: 'Daily Return (%)',
          font: { family: "'Inter', sans-serif" },
          color: theme === 'dark' ? '#e5e7eb' : '#374151'
        },
        grid: {
          color: theme === 'dark' ? '#374151' : '#e5e7eb'
        },
        ticks: {
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          callback: (value) => `${value}%`
        }
      }
    }
  };

  const renderChart = () => {
    switch (viewMode) {
      case 'risk-return':
        return <Scatter data={riskReturnData} options={scatterOptions} />;
      case 'timeseries':
        return selectedTokenLocal ? (
          <Line data={timeSeriesData} options={timeSeriesOptions} />
        ) : (
          <div className="no-selection-state">
            <p>Select a token to view time series</p>
          </div>
        );
      default:
        return <Scatter data={riskReturnData} options={scatterOptions} />;
    }
  };

  const getTokenStats = (token: string) => {
    const stats = data.find(d => d.token === token);
    if (!stats) return null;
    
    const sharpeRatio = stats.meanReturn / stats.stdReturn;
    const annualizedReturn = stats.meanReturn * 365 * 100;
    const annualizedVolatility = stats.stdReturn * Math.sqrt(365) * 100;
    
    return {
      ...stats,
      sharpeRatio,
      annualizedReturn,
      annualizedVolatility
    };
  };

  return (
    <div className={`returns-volatility-chart ${theme}`}>
      {/* Chart Controls */}
      <div className="chart-controls">
        <div className="view-selector">
          <button
            className={viewMode === 'risk-return' ? 'active' : ''}
            onClick={() => setViewMode('risk-return')}
          >
            Risk vs Return
          </button>
          <button
            className={viewMode === 'timeseries' ? 'active' : ''}
            onClick={() => setViewMode('timeseries')}
          >
            Time Series
          </button>
        </div>
        
        {/* Token Selector */}
        <div className="token-selector">
          <select
            value={selectedTokenLocal || ''}
            onChange={(e) => {
              setSelectedTokenLocal(e.target.value || null);
              onTokenSelect?.(e.target.value);
            }}
          >
            <option value="">Select Token</option>
            {data.map(stats => (
              <option key={stats.token} value={stats.token}>
                {stats.token}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart Container */}
      <div className="chart-container" style={{ height: height }}>
        {renderChart()}
      </div>

      {/* Stats Panel */}
      {selectedTokenLocal && (
        <div className="stats-panel">
          {(() => {
            const stats = getTokenStats(selectedTokenLocal);
            if (!stats) return null;
            
            return (
              <div className="token-stats">
                <h4>{stats.token} Statistics</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Daily Return</span>
                    <span className="stat-value">
                      {(stats.meanReturn * 100).toFixed(3)}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Daily Volatility</span>
                    <span className="stat-value">
                      {(stats.stdReturn * 100).toFixed(3)}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Sharpe Ratio</span>
                    <span className="stat-value">
                      {stats.sharpeRatio.toFixed(3)}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Annualized Return</span>
                    <span className="stat-value">
                      {stats.annualizedReturn.toFixed(1)}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Annualized Volatility</span>
                    <span className="stat-value">
                      {stats.annualizedVolatility.toFixed(1)}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Data Points</span>
                    <span className="stat-value">
                      {stats.days} days
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Summary Insights */}
      <div className="chart-insights">
        <div className="insight-cards">
          <div className="insight-card">
            <div className="insight-title">Highest Return</div>
            <div className="insight-value">
              {(() => {
                const highest = data.reduce((max, curr) => 
                  curr.meanReturn > max.meanReturn ? curr : max
                );
                return `${highest.token}: ${(highest.meanReturn * 100).toFixed(3)}%`;
              })()}
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-title">Lowest Volatility</div>
            <div className="insight-value">
              {(() => {
                const lowest = data.reduce((min, curr) => 
                  curr.stdReturn < min.stdReturn ? curr : min
                );
                return `${lowest.token}: ${(lowest.stdReturn * 100).toFixed(3)}%`;
              })()}
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-title">Best Sharpe</div>
            <div className="insight-value">
              {(() => {
                const best = data.reduce((max, curr) => 
                  (curr.meanReturn / curr.stdReturn) > (max.meanReturn / max.stdReturn) ? curr : max
                );
                return `${best.token}: ${(best.meanReturn / best.stdReturn).toFixed(3)}`;
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnsVolatilityChart;