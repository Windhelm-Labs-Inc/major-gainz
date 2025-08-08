import React, { useEffect, useRef } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Portfolio } from '../../types';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PortfolioChartProps {
  portfolio?: Portfolio;
  height?: number;
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({ 
  portfolio, 
  height = 400 
}) => {
  const chartRef = useRef<ChartJS<'doughnut'>>(null);

  if (!portfolio?.holdings?.length) {
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
          <div>No portfolio data available</div>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            Connect a wallet to view your holdings
          </div>
        </div>
      </div>
    );
  }

  // Resolve CSS variable (e.g., var(--mg-blue-900)) to its computed HEX/RGB value.
  const resolveCssVar = (value: string): string => {
    if (!value.startsWith('var(')) {
      return value; // already a valid color string
    }
    // Guard for non-browser environments (e.g., SSR)
    if (typeof window === 'undefined' || !document?.documentElement) {
      return value;
    }
    const cssVar = value.match(/var\((--[^)]+)\)/);
    if (cssVar?.[1]) {
      const computed = getComputedStyle(document.documentElement).getPropertyValue(cssVar[1]).trim();
      return computed || value; // fallback to original if not found
    }
    return value;
  };

  // Generate a high-contrast palette for the chart – brand colours first
  const generateColors = (count: number) => {
    // Curated palette using CSS vars so theme tweaks auto-propagate
    const baseColors = [
      'var(--mg-blue-900)',   // deep navy
      'var(--mg-mint-500)',   // mint
      'var(--mg-blue-700)',   // strong blue
      'var(--mg-mint-300)',   // light mint
      'var(--mg-blue-500)',   // medium blue
      '#0ea5e9',              // sky
      '#22c55e',              // green
      '#f59e0b',              // amber
      '#ef4444',              // red
      '#a855f7',              // purple
      '#fb7185',              // rose
      '#14b8a6',              // teal
    ];

    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
      let rawColor: string;
      if (i < baseColors.length) {
        rawColor = baseColors[i];
      } else {
        // Fallback: generate additional distinct hues
        const hue = (i * 137.508) % 360; // Golden angle approximation
        rawColor = `hsl(${hue}, 70%, 45%)`;
      }
      colors.push(resolveCssVar(rawColor));
    }
    return colors;
  };

  const sortedHoldings = [...portfolio.holdings]
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 10); // Limit to top 10 for readability

  const colors = generateColors(sortedHoldings.length);

  const chartData = {
    labels: sortedHoldings.map(h => h.symbol),
    datasets: [
      {
        data: sortedHoldings.map(h => h.usd),
        backgroundColor: colors,
        borderColor: 'var(--mg-bg)', // off-white to clearly separate slices on light UI
        borderWidth: 3,
        hoverBorderColor: 'var(--mg-bg)',
        hoverBorderWidth: 3,
        // Do not attempt to derive hoverBackgroundColor from CSS vars; keep default for reliability
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            family: 'var(--mg-font-family)',
            size: 12,
          },
          color: 'var(--mg-gray-900)', // stronger contrast for legend text
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: 'rectRounded' as const,
          generateLabels: (chart: any) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => {
                const value = data.datasets[0].data[i];
                const percent = ((value / portfolio.totalUsd) * 100).toFixed(1);
                return {
                  text: `${label} (${percent}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].borderColor,
                  lineWidth: data.datasets[0].borderWidth,
                  index: i,
                };
              });
            }
            return [];
          },
        },
      },
      tooltip: {
        backgroundColor: 'var(--mg-white)',
        titleColor: 'var(--mg-gray-900)',
        bodyColor: 'var(--mg-gray-700)',
        borderColor: 'var(--mg-gray-300)',
        borderWidth: 1,
        cornerRadius: 6,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            const holding = sortedHoldings[context.dataIndex];
            const percent = ((holding.usd / portfolio.totalUsd) * 100).toFixed(1);
            return [
              `${holding.symbol}: $${holding.usd.toLocaleString()}`,
              `${percent}% of portfolio`,
              `${holding.amount.toLocaleString()} tokens`
            ];
          },
        },
      },
    },
    cutout: '56%',
    elements: {
      arc: {
        borderJoinStyle: 'round' as const,
      },
    },
    animation: {
      animateRotate: true,
      animateScale: false,
      duration: 900,
      easing: 'easeOutCubic' as const,
    },
  };

  return (
    <div style={{ height: `${height}px`, padding: '16px' }}>
      <div style={{ 
        marginBottom: '16px', 
        textAlign: 'center',
        borderBottom: '1px solid var(--mg-gray-200)',
        paddingBottom: '12px'
      }}>
        <h3 style={{ 
          margin: '0 0 4px 0', 
          fontSize: '1rem', 
          fontWeight: '600',
          color: 'var(--mg-gray-900)'
        }}>
          Portfolio Allocation
        </h3>
        <div style={{ 
          fontSize: '0.875rem', 
          color: 'var(--mg-gray-600)'
        }}>
          Total Value: ${portfolio.totalUsd.toLocaleString()} • {portfolio.holdings.length} tokens
        </div>
      </div>
      
      <div style={{ height: `${height - 80}px` }}>
        <Doughnut ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
};

export default PortfolioChart;
