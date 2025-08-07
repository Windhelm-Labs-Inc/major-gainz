import React from 'react';
import { DefiData } from '../../types';

interface DefiHeatmapProps {
  defiData?: DefiData;
  height?: number;
}

interface HeatmapCell {
  platform: string;
  apy: number;
  tvl: number;
  risk: 'Low' | 'Medium' | 'High';
  category: string;
}

const DefiHeatmap: React.FC<DefiHeatmapProps> = ({ 
  defiData, 
  height = 400 
}) => {
  // Mock DeFi opportunities data
  const getMockData = (): HeatmapCell[] => [
    { platform: 'SaucerSwap', apy: 12.5, tvl: 2500000, risk: 'Low', category: 'DEX' },
    { platform: 'HeliSwap', apy: 15.2, tvl: 1800000, risk: 'Medium', category: 'DEX' },
    { platform: 'Bonzo Finance', apy: 8.7, tvl: 800000, risk: 'Low', category: 'Lending' },
    { platform: 'Pangolin', apy: 22.1, tvl: 450000, risk: 'High', category: 'DEX' },
    { platform: 'Hashport', apy: 6.2, tvl: 3200000, risk: 'Low', category: 'Bridge' },
    { platform: 'HSUITE', apy: 18.9, tvl: 720000, risk: 'Medium', category: 'Yield' },
    { platform: 'Stader', apy: 4.8, tvl: 5600000, risk: 'Low', category: 'Staking' },
    { platform: 'Yamato', apy: 11.3, tvl: 320000, risk: 'Medium', category: 'Lending' },
  ];

  const data = getMockData();

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'var(--mg-mint-500)';
      case 'Medium': return '#fbbf24';
      case 'High': return '#ef4444';
      default: return 'var(--mg-gray-400)';
    }
  };

  const getApyIntensity = (apy: number) => {
    const maxApy = Math.max(...data.map(d => d.apy));
    const intensity = apy / maxApy;
    return `rgba(37, 99, 235, ${0.1 + intensity * 0.8})`;
  };

  const formatTvl = (tvl: number) => {
    if (tvl >= 1000000) {
      return `$${(tvl / 1000000).toFixed(1)}M`;
    } else if (tvl >= 1000) {
      return `$${(tvl / 1000).toFixed(0)}K`;
    }
    return `$${tvl}`;
  };

  if (!data.length) {
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
          <div>No DeFi data available</div>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            DeFi opportunities will appear here
          </div>
        </div>
      </div>
    );
  }

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
          DeFi Opportunities Heatmap
        </h3>
        <div style={{ 
          fontSize: '0.875rem', 
          color: 'var(--mg-gray-600)'
        }}>
          APY opportunities across Hedera DeFi protocols
        </div>
      </div>

      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '8px',
        height: `${height - 80}px`,
        overflowY: 'auto'
      }}>
        {data.map((cell, index) => (
          <div
            key={index}
            style={{
              background: getApyIntensity(cell.apy),
              border: `2px solid ${getRiskColor(cell.risk)}`,
              borderRadius: 'var(--mg-radius-md)',
              padding: '12px',
              position: 'relative',
              cursor: 'pointer',
              transition: 'all var(--mg-transition)',
              minHeight: '100px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = 'var(--mg-shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Platform name */}
            <div style={{ 
              fontSize: '0.875rem', 
              fontWeight: '600',
              color: 'var(--mg-gray-900)',
              marginBottom: '4px'
            }}>
              {cell.platform}
            </div>
            
            {/* Category */}
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--mg-gray-600)',
              marginBottom: '8px'
            }}>
              {cell.category}
            </div>
            
            {/* APY */}
            <div style={{ 
              fontSize: '1.25rem', 
              fontWeight: '700',
              color: 'var(--mg-blue-900)',
              marginBottom: '4px'
            }}>
              {cell.apy.toFixed(1)}%
            </div>
            
            {/* TVL */}
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--mg-gray-600)',
              marginBottom: '8px'
            }}>
              TVL: {formatTvl(cell.tvl)}
            </div>
            
            {/* Risk badge */}
            <div style={{ 
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: getRiskColor(cell.risk),
              color: 'white',
              fontSize: '0.75rem',
              padding: '2px 6px',
              borderRadius: 'var(--mg-radius-sm)',
              fontWeight: '500'
            }}>
              {cell.risk}
            </div>
          </div>
        ))}
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
            width: '12px', 
            height: '12px', 
            borderRadius: '2px', 
            background: 'var(--mg-mint-500)' 
          }} />
          Low Risk
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '2px', 
            background: '#fbbf24' 
          }} />
          Medium Risk
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '2px', 
            background: '#ef4444' 
          }} />
          High Risk
        </div>
        <div style={{ marginLeft: '12px' }}>
          Color intensity = APY level
        </div>
      </div>
    </div>
  );
};

export default DefiHeatmap;
