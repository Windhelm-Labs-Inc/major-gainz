// === Integration Example: How to modify App.tsx ===

import React, { useState, useMemo } from 'react';
import { filterPortfolioTokens, shouldExcludeFromHolderAnalysis } from './utils/defiTokenFilter';
import DeFiFilterDemo from './components/DeFiFilterDemo';
import type { Portfolio, Holding } from './types/portfolio';

// This shows the key modifications needed in App.tsx

interface EnhancedAppProps {
  portfolio: Portfolio | null;
  selectedToken: Holding | null;
  onTokenSelect: (token: Holding) => void;
}

export const EnhancedAppExample: React.FC<EnhancedAppProps> = ({
  portfolio,
  selectedToken,
  onTokenSelect
}) => {
  const [showDeFiDemo, setShowDeFiDemo] = useState(false);

  // === KEY MODIFICATION 1: Filter portfolio tokens ===
  const filteredPortfolio = useMemo(() => {
    if (!portfolio) return null;
    
    const { regularHoldings, defiTokens, filterResults } = filterPortfolioTokens(portfolio);
    
    console.log('🔍 Portfolio filtering results:', {
      total: portfolio.holdings.length,
      regular: regularHoldings.length,
      defi: defiTokens.length,
      filtered: defiTokens.map(t => t.symbol)
    });
    
    return {
      ...portfolio,
      // Use filtered holdings for display
      holdings: regularHoldings,
      // Store original and DeFi tokens for reference
      _original: portfolio.holdings,
      _defiTokens: defiTokens,
      _filterResults: filterResults
    };
  }, [portfolio]);

  // === KEY MODIFICATION 2: Enhanced token selection handler ===
  const handleTokenSelect = (token: Holding) => {
    // Check if this token should be excluded from holder analysis
    if (shouldExcludeFromHolderAnalysis(token)) {
      console.warn('⚠️ DeFi token excluded from holder analysis:', token.symbol);
      // You could show a message to the user here
      alert(`${token.symbol} is a DeFi token and cannot be used for holder analysis. Use the DeFi positions view instead.`);
      return;
    }
    
    // Safe to proceed with regular token selection
    onTokenSelect(token);
  };

  if (!portfolio) {
    return <div>No portfolio data</div>;
  }

  return (
    <div>
      {/* === KEY MODIFICATION 3: Portfolio summary with filtering info === */}
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#f0fdf4', 
        border: '1px solid #bbf7d0',
        borderRadius: '6px',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#15803d' }}>
          📊 Enhanced Portfolio View
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
          <div>
            <strong>Total Holdings:</strong> {portfolio.holdings.length}
          </div>
          <div>
            <strong>Regular Tokens:</strong> {filteredPortfolio?.holdings.length || 0}
          </div>
          <div>
            <strong>DeFi Tokens (filtered):</strong> {filteredPortfolio?._defiTokens?.length || 0}
          </div>
        </div>
        {filteredPortfolio?._defiTokens && filteredPortfolio._defiTokens.length > 0 && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#059669' }}>
            <strong>Filtered DeFi tokens:</strong> {filteredPortfolio._defiTokens.map(t => t.symbol).join(', ')}
          </div>
        )}
      </div>

      {/* === Toggle for Demo === */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => setShowDeFiDemo(!showDeFiDemo)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showDeFiDemo ? 'Hide' : 'Show'} DeFi Filter Demo
        </button>
      </div>

      {/* === Demo Component === */}
      {showDeFiDemo && <DeFiFilterDemo portfolio={portfolio} />}

      {/* === KEY MODIFICATION 4: Use filtered holdings in components === */}
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Portfolio Chart - now uses filtered holdings */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h4>Portfolio Chart (Regular Tokens Only)</h4>
          <div style={{ 
            padding: '2rem', 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            {/* PortfolioChart would use filteredPortfolio.holdings instead of portfolio.holdings */}
            <div>Chart Component</div>
            <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.5rem' }}>
              Showing {filteredPortfolio?.holdings.length || 0} regular tokens
            </div>
          </div>
        </div>

        {/* Portfolio Table - now uses filtered holdings */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h4>Portfolio Table (Regular Tokens Only)</h4>
          <div style={{ 
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Token</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Amount</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>USD</th>
                </tr>
              </thead>
              <tbody>
                {filteredPortfolio?.holdings.map(holding => (
                  <tr 
                    key={holding.tokenId}
                    onClick={() => handleTokenSelect(holding)}
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: selectedToken?.tokenId === holding.tokenId ? '#e3f2fd' : 'white'
                    }}
                  >
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}>
                      {holding.symbol}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                      {holding.amount.toFixed(4)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>
                      ${holding.usd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* === Token Selection Info === */}
      {selectedToken && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '6px'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}>
            ✅ Selected Token: {selectedToken.symbol}
          </h4>
          <div style={{ fontSize: '0.9rem', color: '#1e40af' }}>
            This token passed DeFi filtering and is safe to use for holder analysis.
          </div>
        </div>
      )}
    </div>
  );
};

// === ACTUAL INTEGRATION INSTRUCTIONS ===

/*

To integrate this into your existing App.tsx, make these key changes:

1. IMPORT the filtering functions:
   ```typescript
   import { filterPortfolioTokens, shouldExcludeFromHolderAnalysis } from './utils/defiTokenFilter';
   ```

2. FILTER the portfolio in your portfolio loading handler:
   ```typescript
   const handleLoadPortfolio = async () => {
     // ... existing loading code ...
     
     const portfolioData: Portfolio = await portfolioRes.json();
     const enriched = await enrichMissingPrices(portfolioData);
     
     // NEW: Filter DeFi tokens
     const { regularHoldings, defiTokens, filterResults } = filterPortfolioTokens(enriched);
     
     // Store filtered portfolio
     setPortfolio({
       ...enriched,
       holdings: regularHoldings  // Use only regular tokens
     });
     
     // Optional: Store DeFi tokens separately for future DeFi position conversion
     setDefiTokens(defiTokens);
     
     console.log('Portfolio filtered:', {
       total: enriched.holdings.length,
       regular: regularHoldings.length,
       defi: defiTokens.length
     });
   };
   ```

3. ENHANCE the token selection handler:
   ```typescript
   const handleTokenSelect = (holding: Holding) => {
     // Check if token should be excluded from holder analysis
     if (shouldExcludeFromHolderAnalysis(holding)) {
       console.warn('DeFi token excluded from analysis:', holding.symbol);
       return; // Don't select DeFi tokens
     }
     
     setSelectedToken(holding);
     updateSelectedToken(holding);
   };
   ```

4. UPDATE component props to use filtered holdings:
   ```typescript
   <PortfolioChart 
     data={portfolio.holdings}  // Now contains only regular tokens
     selectedTokenId={selectedToken?.tokenId || null}
     onTokenSelect={handleTokenSelect}
   />
   
   <PortfolioTable 
     data={portfolio.holdings}  // Now contains only regular tokens
     selectedTokenId={selectedToken?.tokenId || null}
     onTokenSelect={handleTokenSelect}
   />
   ```

5. OPTIONAL: Add filtering status display:
   ```typescript
   {portfolio && (
     <div className="portfolio-status">
       Showing {portfolio.holdings.length} regular tokens 
       {defiTokens?.length > 0 && ` (${defiTokens.length} DeFi tokens filtered)`}
     </div>
   )}
   ```

BENEFITS:
• ✅ Regular tokens safe for holder analysis
• ✅ DeFi tokens properly excluded
• ✅ No backend changes needed
• ✅ Backwards compatible
• ✅ Ready for DeFi position conversion

*/