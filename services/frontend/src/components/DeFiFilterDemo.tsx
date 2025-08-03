import React, { useState } from 'react';
import { 
  filterPortfolioTokens, 
  createFilterReport, 
  getDeFiCategoryDisplayName 
} from '../utils/defiTokenFilter';
import { testPortfolio } from '../utils/mockPortfolio';
import type { Portfolio } from '../types/portfolio';

interface Props {
  portfolio?: Portfolio;
}

const DeFiFilterDemo: React.FC<Props> = ({ portfolio }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  
  // Use provided portfolio or test portfolio
  const targetPortfolio = portfolio || testPortfolio;
  
  // Run the filtering
  const { regularHoldings, defiTokens, filterResults } = filterPortfolioTokens(targetPortfolio);
  const reportData = createFilterReport(filterResults);
  
  const handleTokenClick = (symbol: string) => {
    setSelectedToken(selectedToken === symbol ? null : symbol);
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return '#22c55e'; // Green for high confidence
    if (confidence >= 0.8) return '#eab308'; // Yellow for medium confidence
    return '#ef4444'; // Red for low confidence
  };

  const getConfidenceBadge = (confidence: number): string => {
    if (confidence >= 0.9) return 'HIGH';
    if (confidence >= 0.8) return 'MED';
    return 'LOW';
  };

  return (
    <div style={{ 
      padding: '2rem', 
      backgroundColor: '#f8f9fa', 
      borderRadius: '8px',
      margin: '1rem 0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: '#1f2937' }}>
          🔍 DeFi Token Filter Demo
        </h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: showDetails ? '#dc2626' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          <button
            onClick={() => console.log('To run the console demo, please install test dependencies (`npm install --save-dev vitest @types/jest`) and uncomment the `runFilterDemo` import and usage in DeFiFilterDemo.tsx and defiTokenFilter.test.ts')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6b7280', // Grayed out
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'not-allowed'
            }}
            title="Console demo disabled - requires test runner dependencies"
          >
            Run Console Demo
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem' 
      }}>
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1rem', 
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>
            {targetPortfolio.holdings.length}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Total Tokens</div>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1rem', 
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059669' }}>
            {regularHoldings.length}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Regular Tokens</div>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1rem', 
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
            {defiTokens.length}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>DeFi Tokens</div>
        </div>
        
        <div style={{ 
          backgroundColor: 'white', 
          padding: '1rem', 
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#7c3aed' }}>
            {(reportData.statistics.averageConfidence * 100).toFixed(0)}%
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Avg Confidence</div>
        </div>
      </div>

      {/* Token Analysis Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f3f4f6', 
          borderBottom: '1px solid #e5e7eb',
          fontWeight: 'bold'
        }}>
          Token Analysis Results
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Token</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Confidence</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Category</th>
              <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>USD Value</th>
            </tr>
          </thead>
          <tbody>
            {filterResults.map((result) => (
              <React.Fragment key={result.tokenId}>
                <tr 
                  onClick={() => handleTokenClick(result.symbol)}
                  style={{ 
                    cursor: 'pointer',
                    backgroundColor: selectedToken === result.symbol ? '#eff6ff' : 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedToken !== result.symbol) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedToken !== result.symbol) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: result.isDeFi ? 'bold' : 'normal' }}>
                        {result.symbol}
                      </span>
                      {selectedToken === result.symbol && <span>👁️</span>}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ 
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      backgroundColor: result.isDeFi ? '#fef2f2' : '#f0fdf4',
                      color: result.isDeFi ? '#dc2626' : '#166534'
                    }}>
                      {result.isDeFi ? 'DeFi' : 'Regular'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        color: getConfidenceColor(result.confidence)
                      }}>
                        {getConfidenceBadge(result.confidence)}
                      </span>
                      <span style={{ fontSize: '0.9rem' }}>
                        {(result.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                    {result.suggestedCategory ? getDeFiCategoryDisplayName(result.suggestedCategory) : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                    ${result.metadata?.usdValue?.toFixed(2) || '0.00'}
                  </td>
                </tr>
                
                {/* Expanded details row */}
                {selectedToken === result.symbol && (
                  <tr>
                    <td colSpan={5} style={{ 
                      padding: '1rem', 
                      backgroundColor: '#f8fafc',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Token ID:</strong> {result.tokenId}
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Amount:</strong> {result.metadata?.amount?.toFixed(4) || '0'} tokens
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Analysis Reasons:</strong>
                          <ul style={{ margin: '0.25rem 0', paddingLeft: '1.5rem' }}>
                            {result.reasons.map((reason, idx) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                        {result.metadata?.patterns && result.metadata.patterns.length > 0 && (
                          <div>
                            <strong>Matched Patterns:</strong> {result.metadata.patterns.join(', ')}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed Report */}
      {showDetails && (
        <div style={{ 
          marginTop: '2rem',
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>Detailed Analysis Report</h4>
          <pre style={{ 
            fontSize: '0.85rem',
            lineHeight: '1.4',
            color: '#374151',
            whiteSpace: 'pre-wrap',
            margin: 0
          }}>
            {reportData.report}
          </pre>
        </div>
      )}

      {/* Usage Instructions */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '6px'
      }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}>How to Use This</h4>
        <div style={{ fontSize: '0.9rem', color: '#1e40af' }}>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            • <strong>Regular tokens</strong> are safe to use for holder analysis and portfolio tracking
          </p>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            • <strong>DeFi tokens</strong> should be converted to DeFi positions using the position converter
          </p>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            • <strong>High confidence</strong> filtering ensures accurate separation
          </p>
          <p style={{ margin: 0 }}>
            • Click the "Run Console Demo" button to see detailed console output
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeFiFilterDemo;