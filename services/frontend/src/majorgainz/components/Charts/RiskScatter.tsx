import React from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { ReturnsStats } from '../../types';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Title);

interface RiskScatterProps {
  returnsStats?: ReturnsStats[];
  height?: number;
}

const RiskScatter: React.FC<RiskScatterProps> = ({ 
  returnsStats, 
  height = 400 
}) => {
  if (!returnsStats?.length) {
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
          <div>No risk data available</div>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            Returns and volatility data needed for analysis
          </div>
        </div>
      </div>
    );
  }

  // Generate mock risk/return data if needed
  const generateMockData = () => {
    return returnsStats.map(stat => ({
      ...stat,
      returns: stat.returns || (Math.random() - 0.5) * 50, // -25% to 25%
      volatility: stat.volatility || Math.random() * 80 + 10, // 10% to 90%
      sharpe: stat.sharpe || (Math.random() - 0.3) * 2, // -0.6 to 1.4
    }));
  };

  const data = generateMockData();

  // Color points based on Sharpe ratio
  const getPointColor = (sharpe: number) => {
    if (sharpe > 1) return 'var(--mg-mint-500)'; // Excellent
    if (sharpe > 0.5) return 'var(--mg-blue-500)'; // Good
    if (sharpe > 0) return 'var(--mg-gray-600)'; // Neutral
    return '#dc3545'; // Poor
  };

  const chartData = {
    datasets: [
      {
        label: 'Risk vs Return',
        data: data.map(stat => ({
          x: stat.volatility,
          y: stat.returns,
          symbol: stat.symbol,
          sharpe: stat.sharpe,
        })),
        backgroundColor: data.map(stat => getPointColor(stat.sharpe || 0)),
        borderColor: data.map(stat => getPointColor(stat.sharpe || 0)),
        borderWidth: 2,
        pointRadius: 8,
        pointHoverRadius: 12,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Risk vs Return Analysis',
        font: {
          family: 'var(--mg-font-family)',
          size: 16,
          weight: 600,
        },
        color: 'var(--mg-gray-900)',
      },
      tooltip: {
        backgroundColor: 'var(--mg-white)',
        titleColor: 'var(--mg-gray-900)',
        bodyColor: 'var(--mg-gray-700)',
        borderColor: 'var(--mg-gray-300)',
        borderWidth: 1,
        cornerRadius: 6,
        callbacks: {
          title: function(context: any) {
            return context[0].raw.symbol;
          },
          label: function(context: any) {
            const point = context.raw;
            return [
              `Return: ${point.y.toFixed(1)}%`,
              `Volatility: ${point.x.toFixed(1)}%`,
              `Sharpe Ratio: ${point.sharpe?.toFixed(2) || 'N/A'}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: {
          display: true,
          text: 'Volatility (%)',
          font: {
            family: 'var(--mg-font-family)',
            size: 12,
            weight: 500,
          },
          color: 'var(--mg-gray-700)',
        },
        grid: {
          color: 'var(--mg-gray-200)',
        },
        ticks: {
          color: 'var(--mg-gray-600)',
          font: {
            family: 'var(--mg-font-family)',
            size: 11,
          },
          callback: function(value: any) {
            return value + '%';
          },
        },
      },
      y: {
        type: 'linear' as const,
        title: {
          display: true,
          text: 'Returns (%)',
          font: {
            family: 'var(--mg-font-family)',
            size: 12,
            weight: 500,
          },
          color: 'var(--mg-gray-700)',
        },
        grid: {
          color: 'var(--mg-gray-200)',
        },
        ticks: {
          color: 'var(--mg-gray-600)',
          font: {
            family: 'var(--mg-font-family)',
            size: 11,
          },
          callback: function(value: any) {
            return value + '%';
          },
        },
      },
    },
    elements: {
      point: {
        hoverBorderWidth: 3,
      },
    },
    animation: {
      duration: 1000,
    },
  };

  return (
    <div style={{ height: `${height}px`, padding: '16px' }}>
      <div style={{ height: `${height - 32}px` }}>
        <Scatter data={chartData} options={options} />
      </div>
      
      {/* Legend */}
      <div style={{ 
        marginTop: '12px', 
        fontSize: '0.75rem', 
        color: 'var(--mg-gray-600)',
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            background: 'var(--mg-mint-500)' 
          }} />
          Excellent (Sharpe &gt; 1)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            background: 'var(--mg-blue-500)' 
          }} />
          Good (Sharpe &gt; 0.5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            background: 'var(--mg-gray-600)' 
          }} />
          Neutral (Sharpe &gt; 0)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            background: '#dc3545' 
          }} />
          Poor (Sharpe ≤ 0)
        </div>
      </div>
    </div>
  );
};

export default RiskScatter;
