import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Holding } from '../../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TokenHolderAnalysisProps {
  tokenData?: Holding;
  height?: number;
}

interface HolderSegment {
  range: string;
  holderCount: number;
  totalAmount: number;
  percentage: number;
}

const TokenHolderAnalysis: React.FC<TokenHolderAnalysisProps> = ({ 
  tokenData, 
  height = 400 
}) => {
  if (!tokenData) {
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
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
          <div>No token data available</div>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            Select a token to analyze holder distribution
          </div>
        </div>
      </div>
    );
  }

  // Generate mock holder distribution data
  const generateHolderData = (): HolderSegment[] => {
    const segments = [
      { range: '1-10', holderCount: 2847, totalAmount: 15420, percentage: 2.3 },
      { range: '10-100', holderCount: 1593, totalAmount: 67890, percentage: 10.1 },
      { range: '100-1K', holderCount: 876, totalAmount: 234560, percentage: 34.9 },
      { range: '1K-10K', holderCount: 324, totalAmount: 1456700, percentage: 21.7 },
      { range: '10K-100K', holderCount: 89, totalAmount: 3456780, percentage: 51.5 },
      { range: '100K+', holderCount: 12, totalAmount: 8976540, percentage: 13.4 },
    ];
    
    return segments;
  };

  const holderData = generateHolderData();

  const chartData = {
    labels: holderData.map(segment => segment.range),
    datasets: [
      {
        label: 'Number of Holders',
        data: holderData.map(segment => segment.holderCount),
        backgroundColor: 'var(--mg-blue-500)',
        borderColor: 'var(--mg-blue-700)',
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        label: 'Total Token Amount',
        data: holderData.map(segment => segment.totalAmount),
        backgroundColor: 'var(--mg-mint-500)',
        borderColor: 'var(--mg-mint-300)',
        borderWidth: 1,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${tokenData.symbol} Token Holder Distribution`,
        font: {
          family: 'var(--mg-font-family)',
          size: 16,
          weight: 600,
        },
        color: 'var(--mg-gray-900)',
      },
      legend: {
        position: 'top' as const,
        labels: {
          font: {
            family: 'var(--mg-font-family)',
            size: 12,
          },
          color: 'var(--mg-gray-700)',
        },
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
            const segment = holderData[context[0].dataIndex];
            return `${segment.range} ${tokenData.symbol} holders`;
          },
          label: function(context: any) {
            const segment = holderData[context.dataIndex];
            if (context.datasetIndex === 0) {
              return `Holders: ${segment.holderCount.toLocaleString()}`;
            } else {
              return [
                `Total Amount: ${segment.totalAmount.toLocaleString()} ${tokenData.symbol}`,
                `% of Supply: ${segment.percentage}%`
              ];
            }
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: `Token Holdings Range (${tokenData.symbol})`,
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
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Number of Holders',
          font: {
            family: 'var(--mg-font-family)',
            size: 12,
            weight: 500,
          },
          color: 'var(--mg-blue-700)',
        },
        grid: {
          color: 'var(--mg-gray-200)',
        },
        ticks: {
          color: 'var(--mg-blue-700)',
          font: {
            family: 'var(--mg-font-family)',
            size: 11,
          },
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Token Amount',
          font: {
            family: 'var(--mg-font-family)',
            size: 12,
            weight: 500,
          },
          color: 'var(--mg-mint-500)',
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: 'var(--mg-mint-500)',
          font: {
            family: 'var(--mg-font-family)',
            size: 11,
          },
          callback: function(value: any) {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(0) + 'K';
            }
            return value;
          },
        },
      },
    },
    animation: {
      duration: 1000,
    },
  };

  return (
    <div style={{ height: `${height}px`, padding: '16px' }}>
      <div style={{ height: `${height - 32}px` }}>
        <Bar data={chartData} options={options} />
      </div>
      
      {/* Summary stats */}
      <div style={{ 
        marginTop: '12px', 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px',
        fontSize: '0.75rem'
      }}>
        <div style={{ 
          textAlign: 'center',
          padding: '8px',
          background: 'var(--mg-blue-100)',
          borderRadius: 'var(--mg-radius)',
          color: 'var(--mg-blue-900)'
        }}>
          <div style={{ fontWeight: '600' }}>
            {holderData.reduce((sum, s) => sum + s.holderCount, 0).toLocaleString()}
          </div>
          <div>Total Holders</div>
        </div>
        
        <div style={{ 
          textAlign: 'center',
          padding: '8px',
          background: 'var(--mg-mint-100)',
          borderRadius: 'var(--mg-radius)',
          color: 'var(--mg-gray-900)'
        }}>
          <div style={{ fontWeight: '600' }}>
            {((holderData[holderData.length - 1]?.percentage || 0)).toFixed(1)}%
          </div>
          <div>Top Holders</div>
        </div>
        
        <div style={{ 
          textAlign: 'center',
          padding: '8px',
          background: 'var(--mg-gray-100)',
          borderRadius: 'var(--mg-radius)',
          color: 'var(--mg-gray-900)'
        }}>
          <div style={{ fontWeight: '600' }}>
            ${tokenData.usd.toLocaleString()}
          </div>
          <div>Your Value</div>
        </div>
      </div>
    </div>
  );
};

export default TokenHolderAnalysis;
