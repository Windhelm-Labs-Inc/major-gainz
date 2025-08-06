import React, { useState, useCallback } from 'react';
import { Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
  ChartOptions,
} from 'chart.js';
import { PureChatHolding } from '../../types/pureChatTypes';
import { ChartComponentProps } from '../../types/enhancedMessage';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface Props extends ChartComponentProps {
  data: PureChatHolding[];
  selectedTokenId?: string | null;
  onTokenSelect?: (holding: PureChatHolding) => void;
  chartType?: 'pie' | 'doughnut';
  showValues?: boolean;
  animateOnMount?: boolean;
}

const ENHANCED_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#84cc16', '#f97316', '#3b82f6',
  '#8b5a8c', '#059669', '#dc2626', '#7c3aed', '#0891b2'
];

const EnhancedPortfolioChart: React.FC<Props> = ({
  data,
  selectedTokenId,
  onTokenSelect,
  title = "Portfolio Allocation",
  height = 400,
  chartType = 'doughnut',
  showValues = true,
  animateOnMount = true,
  theme = 'light'
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const priced = data.filter(h => h.usd > 0);
  if (!priced.length) {
    return (
      <div className="chart-error-state">
        <div className="error-icon">📊</div>
        <p>No priced tokens available for visualization</p>
      </div>
    );
  }

  const unpriced = data.filter(h => h.usd === 0).map(h => h.symbol);

  const createGradient = (ctx: CanvasRenderingContext2D, color: string) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '80');
    return gradient;
  };

  const chartData = {
    labels: priced.map(h => h.symbol),
    datasets: [
      {
        data: priced.map(h => h.usd),
        backgroundColor: priced.map((_, index) => ENHANCED_COLORS[index % ENHANCED_COLORS.length]),
        borderColor: priced.map((h, index) => 
          selectedTokenId && h.symbol === selectedTokenId ? '#1f2937' : '#ffffff'
        ),
        borderWidth: priced.map((h) => 
          selectedTokenId && h.symbol === selectedTokenId ? 4 : 2
        ),
        hoverBackgroundColor: priced.map((_, index) => ENHANCED_COLORS[index % ENHANCED_COLORS.length] + 'CC'),
        hoverBorderWidth: 3,
        hoverOffset: 8,
        cutout: chartType === 'doughnut' ? '60%' : 0,
      }
    ]
  };

  const options: ChartOptions<'pie' | 'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateRotate: animateOnMount,
      duration: 1500,
      easing: 'easeInOutQuart'
    },
    plugins: {
      title: {
        display: !!title,
        text: title,
        font: {
          size: 18,
          weight: 'bold',
          family: "'Inter', 'system-ui', sans-serif"
        },
        color: theme === 'dark' ? '#f9fafb' : '#1f2937',
        padding: {
          bottom: 20
        }
      },
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          font: {
            size: 12,
            family: "'Inter', 'system-ui', sans-serif"
          },
          color: theme === 'dark' ? '#e5e7eb' : '#374151',
          generateLabels: (chart) => {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original(chart);
            
            return labels.map((label, index) => {
              const holding = priced[index];
              const isSelected = selectedTokenId && holding.symbol === selectedTokenId;
              
              return {
                ...label,
                text: `${holding.symbol} ${holding.percent.toFixed(1)}%`,
                fillStyle: isSelected ? label.fillStyle + 'FF' : label.fillStyle + 'DD',
                strokeStyle: isSelected ? '#1f2937' : label.strokeStyle,
                lineWidth: isSelected ? 3 : 1
              };
            });
          }
        },
        onHover: (event, legendItem, legend) => {
          const chart = legend.chart;
          chart.canvas.style.cursor = 'pointer';
        },
        onLeave: (event, legendItem, legend) => {
          const chart = legend.chart;
          chart.canvas.style.cursor = 'default';
        }
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        titleColor: theme === 'dark' ? '#f9fafb' : '#1f2937',
        bodyColor: theme === 'dark' ? '#e5e7eb' : '#374151',
        borderColor: theme === 'dark' ? '#374151' : '#d1d5db',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        titleFont: {
          size: 14,
          weight: 'bold',
          family: "'Inter', 'system-ui', sans-serif"
        },
        bodyFont: {
          size: 12,
          family: "'Inter', 'system-ui', sans-serif"
        },
        callbacks: {
          title: (context) => {
            const holding = priced[context[0].dataIndex];
            return `${holding.symbol}`;
          },
          label: (context) => {
            const holding = priced[context.dataIndex];
            const lines = [
              `Amount: ${holding.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
              `Value: $${holding.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              `Allocation: ${holding.percent.toFixed(2)}%`
            ];
            return lines;
          }
        }
      }
    },
    onHover: (event, elements, chart) => {
      const canvas = event.native?.target as HTMLCanvasElement;
      if (canvas) {
        canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      }
      
      if (elements.length > 0) {
        setHoveredIndex(elements[0].index);
      } else {
        setHoveredIndex(null);
      }
    },
    onClick: (event, elements, chart) => {
      if (elements.length > 0 && onTokenSelect) {
        const index = elements[0].index;
        const holding = priced[index];
        setSelectedIndex(index);
        onTokenSelect(holding);
      }
    },
    layout: {
      padding: {
        top: 20,
        bottom: 20,
        left: 20,
        right: 20
      }
    }
  };

  const ChartComponent = chartType === 'pie' ? Pie : Doughnut;

  return (
    <div className={`enhanced-portfolio-chart ${theme}`}>
      <div className="chart-container" style={{ height: height, position: 'relative' }}>
        <ChartComponent data={chartData} options={options} />
        
        {/* Center label for doughnut chart */}
        {chartType === 'doughnut' && (
          <div className="chart-center-label">
            <div className="total-value">
              ${data.reduce((sum, h) => sum + h.usd, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="total-label">Total Value</div>
          </div>
        )}
      </div>

      {/* Token Details Panel */}
      {selectedIndex !== null && (
        <div className="token-details-panel">
          <div className="details-header">
            <h4>{priced[selectedIndex].symbol}</h4>
            <button 
              onClick={() => setSelectedIndex(null)}
              className="close-btn"
            >
              ×
            </button>
          </div>
          <div className="details-content">
            <div className="detail-row">
              <span>Amount:</span>
              <span>{priced[selectedIndex].amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            </div>
            <div className="detail-row">
              <span>USD Value:</span>
              <span>${priced[selectedIndex].usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="detail-row">
              <span>Allocation:</span>
              <span>{priced[selectedIndex].percent.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Unpriced tokens notice */}
      {unpriced.length > 0 && (
        <div className="unpriced-notice">
          <div className="notice-header">
            <span className="notice-icon">ℹ️</span>
            <span>Unpriced Tokens ({unpriced.length})</span>
          </div>
          <div className="unpriced-list">
            {unpriced.join(', ')}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="quick-stats">
        <div className="stat">
          <span className="stat-value">{priced.length}</span>
          <span className="stat-label">Priced Tokens</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            ${data.reduce((sum, h) => sum + h.usd, 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </span>
          <span className="stat-label">Total Value</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {priced.length > 0 ? (priced[0].percent).toFixed(1) : 0}%
          </span>
          <span className="stat-label">Top Holding</span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedPortfolioChart;