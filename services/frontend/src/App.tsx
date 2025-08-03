// Environment variables bundled at build time
declare const __WALLETCONNECT_PROJECT_ID__: string
declare const __HEDERA_NETWORK__: string
import { useState, lazy, Suspense, useEffect, useCallback, useMemo } from 'react'
import type { Portfolio, Holding } from './types/portfolio'
import { filterPortfolioTokens, shouldExcludeFromHolderAnalysis } from './utils/defiTokenFilter'
import NetworkSelector from './components/NetworkSelector'
import WalletConnection from './components/WalletConnection'
import AddressInput from './components/AddressInput'
import ChatWindow from './components/ChatWindow'
import DefiHeatmaps from './components/DefiHeatmaps'
import type { PoolData } from './components/PoolDetailDrawer'
import AddressDisplay from './components/AddressDisplay'
import TokenHolderAnalysis from './components/TokenHolderAnalysis'
import JsonExplorer from './components/JsonExplorer'
import { useScratchpad } from './hooks/useScratchpad'
import './App.css'

function App() {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null)
  const defaultNet = __HEDERA_NETWORK__ === 'testnet' ? 'testnet' : 'mainnet'
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(defaultNet)
  const handleNetworkChange = (net: 'mainnet' | 'testnet') => {
    console.log('[App] Network changed:', net)
    setNetwork(net)
  }
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [manualAddress, setManualAddress] = useState<string>('')
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false)
  const [selectedToken, setSelectedToken] = useState<Holding | null>(null)
  const [defiTokens, setDefiTokens] = useState<Holding[]>([])
  const [saucerPools, setSaucerPools] = useState<any[]>([])
  const [bonzoPools, setBonzoPools] = useState<any[]>([])
  const [filterResults, setFilterResults] = useState<any[]>([])
  const [defiData, setDefiData] = useState<any>(null)
  const [defiValidationExpanded, setDefiValidationExpanded] = useState(false)
  const [defiProtocolsExpanded, setDefiProtocolsExpanded] = useState(false)
  const [isLoadingDefi, setIsLoadingDefi] = useState(false)
  const [defiPanelWidth, setDefiPanelWidth] = useState(400)

  // Scratchpad integration
  const {
    updateSelectedToken,
    updateHolderAnalysis,
    updatePortfolioSummary,
    updateUserContext,
    getScratchpadSummary
  } = useScratchpad()

  const PortfolioChart = lazy(() => import('./components/PortfolioChart'))

  // Build flat pool dataset for heat-map visualisations
  const poolData: PoolData[] = useMemo(() => {
    const all: PoolData[] = []

    // Helper to safely push if value present
    const push = (platform: 'SAUCERSWAP' | 'BONZO', raw: any, name: string) => {
      // For SaucerSwap, use underlyingValueUSD for V1 positions, and avoid it for global pools
      // For Bonzo, use usd_value from individual positions
      let userStakedValue = undefined
      if (platform === 'SAUCERSWAP') {
        // Only use underlyingValueUSD if it's a user position (has sharePercentage or user-specific data)
        if (raw?.sharePercentage !== undefined || raw?.lpTokenBalance !== undefined) {
          userStakedValue = raw?.underlyingValueUSD
        }
      } else if (platform === 'BONZO') {
        userStakedValue = raw?.usd_value
      }

      all.push({
        platform,
        poolId: (raw?.poolId ?? raw?.id ?? raw?.address ?? name) as string,
        name,
        apy: raw?.apy ?? raw?.apr ?? raw?.rewardApy ?? raw?.supply_apy ?? raw?.variable_borrow_apy ?? undefined,
        tvlUsd: raw?.tvl_usd ?? raw?.liquidityUSD ?? raw?.total_supply_usd ?? raw?.available_liquidity_usd ?? undefined,
        userStakedUsd: userStakedValue,
        extra: raw
      })
    }

    // SaucerSwap pools - both user positions and all available pools
    if (defiData?.saucer_swap) {
      const ss = defiData.saucer_swap
      
      // V1 positions - these have user stake data
      ;(ss.pools_v1 || []).forEach((p: any) => {
        const tokenA = p.tokenA || p.token0 || 'Token A'
        const tokenB = p.tokenB || p.token1 || 'Token B'
        push('SAUCERSWAP', p, `${tokenA}/${tokenB} V1`)
      })
      
      // V2 positions - these have user stake data  
      ;(ss.pools_v2 || []).forEach((p: any) => {
        const tokenA = p.token0 || p.tokenA || 'Token 0'
        const tokenB = p.token1 || p.tokenB || 'Token 1'
        const feeTier = p.feeTier ? ` (${p.feeTier/10000}%)` : ''
        push('SAUCERSWAP', p, `${tokenA}/${tokenB} V2${feeTier}`)
      })
      
      // Farm positions - these have user stake data
      ;(ss.farms || []).forEach((p: any) => {
        const farmName = p.pair || p.name || `Farm ${p.farmId || p.poolId || ''}`
        push('SAUCERSWAP', p, `🚜 ${farmName}`)
      })
      
      // Vault positions - these have user stake data
      ;(ss.vaults || []).forEach((p: any) => {
        const vaultName = p.vault || p.name || 'Vault'
        push('SAUCERSWAP', p, `🏦 ${vaultName}`)
      })
    }

    // Add all available SaucerSwap pools (not just user positions)
    if (defiData?.filtered_saucerswap_pools) {
      const allPools = defiData.filtered_saucerswap_pools
      
      // V1 pools
      ;(allPools.v1 || []).forEach((pool: any) => {
        const tokenA = pool.tokenA?.symbol || 'TokenA'
        const tokenB = pool.tokenB?.symbol || 'TokenB'
        const poolId = `all-v1-${pool.id}`
        
        // Skip if we already have this as a user position
        const alreadyExists = all.some(p => p.poolId === pool.id?.toString())
        if (!alreadyExists) {
          push('SAUCERSWAP', { ...pool, poolId }, `${tokenA}/${tokenB} V1`)
        }
      })
      
      // V2 pools
      ;(allPools.v2 || []).forEach((pool: any) => {
        const tokenA = pool.tokenA?.symbol || pool.token0?.symbol || 'TokenA'
        const tokenB = pool.tokenB?.symbol || pool.token1?.symbol || 'TokenB'
        const fee = pool.fee ? ` (${(pool.fee/10000).toFixed(2)}%)` : ''
        const poolId = `all-v2-${pool.id}`
        
        // Skip if we already have this as a user position
        const alreadyExists = all.some(p => p.poolId === pool.id?.toString())
        if (!alreadyExists) {
          push('SAUCERSWAP', { ...pool, poolId }, `${tokenA}/${tokenB} V2${fee}`)
        }
      })
      
      // Farms
      ;(allPools.farms || []).forEach((farm: any) => {
        const farmId = `all-farm-${farm.id}`
        
        // Skip if we already have this as a user position
        const alreadyExists = all.some(p => p.poolId === farm.id?.toString())
        if (!alreadyExists) {
          const name = farm.name || `Farm ${farm.id}`
          push('SAUCERSWAP', { ...farm, poolId: farmId }, `🚜 ${name}`)
        }
      })
    }

    // Bonzo pools (markets) - user positions
    const bonzo = defiData?.bonzo_finance
    if (bonzo) {
      const toArr = (v: any): any[] => Array.isArray(v) ? v : v ? Object.values(v) : []
      
      // Supplied assets
      toArr(bonzo.supplied).forEach((m: any) => {
        const symbol = m.symbol ?? m.token_symbol ?? 'Unknown'
        const amount = m.amount ? ` (${parseFloat(m.amount).toFixed(2)})` : ''
        push('BONZO', m, `💰 Supply ${symbol}${amount}`)
      })
      
      // Borrowed assets  
      toArr(bonzo.borrowed).forEach((m: any) => {
        const symbol = m.symbol ?? m.token_symbol ?? 'Unknown'
        const amount = m.amount ? ` (${parseFloat(m.amount).toFixed(2)})` : ''
        push('BONZO', m, `🏦 Borrow ${symbol}${amount}`)
      })
    }

    // Add all available Bonzo markets (not just user positions)
    if (defiData?.all_bonzo_pools) {
      ;(defiData.all_bonzo_pools || []).forEach((market: any) => {
        const symbol = market.symbol || market.name || 'Unknown'
        const marketId = `all-bonzo-${symbol}`
        
        // Skip if we already have this as a user position
        const alreadyExists = all.some(p => 
          p.extra?.symbol === symbol || p.name.includes(symbol)
        )
        
        if (!alreadyExists) {
          // Show as available market with APY info
          const supplyApy = market.supply_apy ? ` ${market.supply_apy.toFixed(2)}%` : ''
          push('BONZO', { ...market, poolId: marketId }, `📊 ${symbol} Market${supplyApy}`)
        }
      })
    }

    return all
  }, [defiData])

  const handleWalletConnect = (walletType: string, address: string) => {
    console.log('[App] Wallet connected:', walletType, address)
    setConnectedWallet(walletType)
    setWalletAddress(address)
    setManualAddress(address)
    // Update scratchpad with connection info
    updateUserContext(address, network, walletType)
  }

  const handleWalletDisconnect = () => {
    console.log('[App] Wallet disconnected')
    setConnectedWallet(null)
    setWalletAddress('')
  }

  const handleAddressInput = (address: string) => {
    console.log('[App] Manual address input:', address)
    setManualAddress(address)
  }

  const handleSelectAddress = () => {
    const addressToSelect = walletAddress || manualAddress
    console.log('[App] Selected address:', addressToSelect)
    setSelectedAddress(addressToSelect)
    // Update scratchpad with user context
    updateUserContext(addressToSelect, network, connectedWallet || 'manual')
    // reset portfolio and defi data when address changes
    setPortfolio(null)
    setDefiData(null)
    setDefiTokens([])
    setFilterResults([])
    setSaucerPools([])
    setBonzoPools([])
  }

  const handleTokenSelect = (holding: Holding) => {
    console.log('[App] Token selected:', holding.symbol)
    
    // Check if this is a DeFi token that should be excluded from holder analysis
    if (shouldExcludeFromHolderAnalysis(holding)) {
      console.warn('[App] DeFi token excluded from holder analysis:', holding.symbol)
      alert(`${holding.symbol} is a DeFi token and cannot be used for holder analysis. DeFi tokens are displayed separately below.`)
      return
    }
    
    setSelectedToken(holding)
    // Update scratchpad with selected token
    updateSelectedToken(holding)
  }

  const handleCloseAnalysis = () => {
    setSelectedToken(null)
    updateSelectedToken(null)
  }

  // Memoize the analysis update callback to prevent infinite loops
  const handleAnalysisUpdate = useCallback((analysisData: any) => {
    if (selectedToken) {
      updateHolderAnalysis(selectedToken, analysisData)
    }
  }, [selectedToken]) // Remove updateHolderAnalysis from dependencies since it's stable from the hook

  const handleLoadPortfolio = async () => {
    console.log('[App] Loading portfolio for', selectedAddress, 'on', network)
    if (!selectedAddress) {
      alert('Please select an address first')
      return
    }
    setIsLoadingPortfolio(true)
    setIsLoadingDefi(true)
    
    try {
      // Load portfolio and DeFi data in parallel
      const [portfolioRes, defiRes, saucerPoolsRes, bonzoPoolsRes] = await Promise.all([
        fetch(`/portfolio/${selectedAddress}?network=${network}`),
        fetch(`/defi/profile/${selectedAddress}?testnet=${network === 'testnet'}`),
        fetch(`/defi/pools/saucerswap?version=all&testnet=${network === 'testnet'}`),
        fetch(`/defi/pools/bonzo`)
      ])
      
      // Handle portfolio response
      if (!portfolioRes.ok) {
        const txt = await portfolioRes.text()
        console.error('[App] Portfolio backend error body', txt)
        throw new Error(`Portfolio: ${txt}`)
      }
      const portfolioData: Portfolio = await portfolioRes.json()
      console.log('[App] Portfolio loaded:', portfolioData)
      // Post-process to fetch missing prices
      const enriched = await enrichMissingPrices(portfolioData)
      
      // Apply DeFi filtering to separate regular tokens from DeFi tokens
      const { regularHoldings, defiTokens, filterResults } = filterPortfolioTokens(enriched)
      
      console.log('[App] Portfolio filtering results:', {
        total: enriched.holdings.length,
        regular: regularHoldings.length,
        defi: defiTokens.length,
        filtered: defiTokens.map(t => t.symbol)
      })
      
      // Update portfolio to show only regular holdings
      const filteredPortfolio = {
        ...enriched,
        holdings: regularHoldings,
        totalUsd: regularHoldings.reduce((sum, h) => sum + h.usd, 0)
      }
      
      // Recalculate percentages for regular holdings only
      filteredPortfolio.holdings = filteredPortfolio.holdings.map(h => ({
        ...h,
        percent: filteredPortfolio.totalUsd ? (100 * h.usd / filteredPortfolio.totalUsd) : 0
      }))
      
      setPortfolio(filteredPortfolio)
      setDefiTokens(defiTokens)
      setFilterResults(filterResults)
      
      // Handle DeFi response
      if (defiRes.ok) {
        // Check if response is actually JSON
        const contentType = defiRes.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          try {
            const defiData = await defiRes.json()
            console.log('[App] DeFi data loaded:', defiData)
            console.log('[App] DeFi saucer_swap:', defiData.saucer_swap)
            console.log('[App] DeFi bonzo_finance:', defiData.bonzo_finance)
            
            // Log detailed structure
            if (defiData.saucer_swap) {
              console.log('[App] SaucerSwap pools_v2:', defiData.saucer_swap.pools_v2)
              console.log('[App] SaucerSwap pools_v1:', defiData.saucer_swap.pools_v1)
              console.log('[App] SaucerSwap farms:', defiData.saucer_swap.farms)
              console.log('[App] SaucerSwap vaults:', defiData.saucer_swap.vaults)
            }
            if (defiData.bonzo_finance) {
              console.log('[App] Bonzo supplied:', defiData.bonzo_finance.supplied)
              console.log('[App] Bonzo borrowed:', defiData.bonzo_finance.borrowed)
              console.log('[App] Bonzo health_factor:', defiData.bonzo_finance.health_factor)
            }
            
            let merged = defiData
            // pools might be fetched slightly later; they will be injected after pool fetches
            setDefiData(merged)
          } catch (jsonError) {
            console.error('[App] DeFi response parse error:', jsonError)
            const responseText = await defiRes.text()
            console.warn('[App] DeFi response was not valid JSON:', responseText.substring(0, 200))
            setDefiData({ error: 'Invalid JSON response', message: 'DeFi API returned non-JSON data' })
          }
        } else {
          const responseText = await defiRes.text()
          console.warn('[App] DeFi API returned non-JSON content:', responseText.substring(0, 200))
          setDefiData({ error: 'Non-JSON response', message: 'DeFi API returned HTML instead of JSON', content: responseText.substring(0, 500) })
        }
              } else {
          const defiError = await defiRes.text()
          console.warn('[App] DeFi fetch failed with status:', defiRes.status, defiError)
          setDefiData({ error: defiError, message: `DeFi API error (${defiRes.status})` })
        }

        // Handle pools responses
        if (saucerPoolsRes.ok) {
          try {
            const poolsData = await saucerPoolsRes.json()
            console.log('[App] SaucerSwap pools loaded:', poolsData)
            const sp = poolsData.pools || []
            setSaucerPools(sp)
            setDefiData((prev: any) => ({ ...(prev||{}), filtered_saucerswap_pools: sp }))
          } catch (err) {
            console.error('[App] SaucerSwap pools parse error', err)
          }
        } else {
          console.warn('[App] SaucerSwap pools request failed', saucerPoolsRes.status)
        }

        if (bonzoPoolsRes.ok) {
          try {
            const bpools = await bonzoPoolsRes.json()
            console.log('[App] Bonzo pools loaded:', bpools)
            const bp = bpools.pools || []
            setBonzoPools(bp)
            setDefiData((prev: any) => ({ ...(prev||{}), all_bonzo_pools: bp }))
          } catch (err) {
            console.error('[App] Bonzo pools parse error', err)
          }
        } else {
          console.warn('[App] Bonzo pools request failed', bonzoPoolsRes.status)
        }
      
    } catch (err: any) {
      console.error('Portfolio/DeFi fetch failed', err)
      alert('Failed to load portfolio')
    } finally {
      setIsLoadingPortfolio(false)
      setIsLoadingDefi(false)
    }
  }

  // ------------------ Price enrichment ------------------
  const COINGECKO_IDS: Record<string, string> = {
    HBAR: 'hedera-hashgraph',
    USDC: 'usd-coin',
    USDT: 'tether',
    PACK: 'xpack',
    SAUCE: 'saucerswap',
    DOVU: 'dovu-2',
    KARATE: 'karate-combat',
    JAM: 'jam',
    HGG: 'hedera-guild-game',
    HST: 'headstarter'
  }

  const enrichMissingPrices = async (p: Portfolio): Promise<Portfolio> => {
    const missingSyms = p.holdings.filter(h => h.usd === 0).map(h => h.symbol).filter(Boolean)
    const ids = missingSyms.map(s => COINGECKO_IDS[s]).filter(Boolean)
    if (!ids.length) return p
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
      const resp = await fetch(url)
      const priceData = await resp.json()
      let totalUsd = 0
      const newHoldings = p.holdings.map(h => {
        if (h.usd === 0) {
          const id = COINGECKO_IDS[h.symbol]
          const price = priceData?.[id]?.usd ?? 0
          if (price) {
            const usd = h.amount * price
            return { ...h, usd }
          }
        }
        return h
      })
      newHoldings.forEach(h => { totalUsd += h.usd })
      // recompute percents
      const finalHoldings = newHoldings.map(h => ({ ...h, percent: totalUsd ? (100 * h.usd / totalUsd) : 0 }))
      return { ...p, holdings: finalHoldings, totalUsd }
    } catch (e) {
      console.error('[App] Price enrichment failed', e)
      return p
    }
  }

  // Update scratchpad when portfolio changes
  useEffect(() => {
    if (portfolio) {
      console.log('[App] Portfolio state updated', portfolio)
      updatePortfolioSummary(portfolio)
    }
  }, [portfolio]) // Remove updatePortfolioSummary from dependencies

  // Update scratchpad when network changes
  useEffect(() => {
    if (selectedAddress) {
      updateUserContext(selectedAddress, network, connectedWallet || 'manual')
    }
  }, [network, selectedAddress, connectedWallet]) // Remove updateUserContext from dependencies

  return (
    <div style={{ 
      minHeight: '100vh',
      position: 'relative'
    }}>
      {/* Token Holder Analysis Sidebar */}
      {selectedToken && (
        <TokenHolderAnalysis 
          selectedToken={selectedToken}
          userAddress={selectedAddress}
          onClose={handleCloseAnalysis}
          onAnalysisUpdate={handleAnalysisUpdate}
        />
      )}

      {/* DeFi JSON Explorer Sidebar */}
      <JsonExplorer 
        data={defiData} 
        isLoading={isLoadingDefi}
        onWidthChange={setDefiPanelWidth}
      />

      {/* Main Content */}
      <div className="container" style={{ 
        marginLeft: selectedToken ? '400px' : '0',
        marginRight: `${defiPanelWidth}px`, // Dynamic space for resizable DeFi panel
        transition: 'margin-left 0.3s ease, margin-right 0.1s ease',
        maxWidth: selectedToken ? `calc(100vw - ${400 + defiPanelWidth}px)` : `calc(100vw - ${defiPanelWidth}px)`
      }}>
        {/* Header Section - Always Centered */}
        <div className="header" style={{
          textAlign: 'center',
          width: '100%',
          padding: '0 20px'
        }}>
          <h1>Quick Origins</h1>
          <p className="subtitle">
            AI-Powered Portfolio Intelligence for Hedera Network
          </p>
        </div>
        
        {/* Wallet & Portfolio Section */}
        <div className="wallet-section">
          <NetworkSelector value={network} onChange={handleNetworkChange} />
          
          <h2>Wallet Connection</h2>
          <WalletConnection 
            onConnect={handleWalletConnect}
            onDisconnect={handleWalletDisconnect}
            connectedWallet={connectedWallet}
            walletAddress={walletAddress}
            hederaNetwork={network}
          />
          
          <AddressInput 
            onAddressChange={handleAddressInput}
            address={manualAddress}
          />
          
          <button onClick={handleSelectAddress} className="select-address-btn">
            Select Current Address
          </button>
          
          <AddressDisplay address={selectedAddress} />

          <button 
            onClick={handleLoadPortfolio} 
            disabled={isLoadingPortfolio || !selectedAddress} 
            className="select-address-btn"
            style={{ marginTop: '1rem' }}
          >
            {isLoadingPortfolio ? (
              <span className="loading">Loading Portfolio</span>
            ) : (
              'Load Portfolio'
            )}
          </button>

          {portfolio && portfolio.holdings.length > 0 && (
            <>
              {/* Portfolio Status */}
              <div style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #e9ecef',
                textAlign: 'center'
              }}>
                <span style={{ 
                  fontSize: '0.9rem',
                  color: '#495057'
                }}>
                  📊 Showing {portfolio.holdings.length} regular tokens
                  {defiTokens.length > 0 && (
                    <span style={{ color: '#6c757d' }}>
                      {' '} • {defiTokens.length} DeFi tokens filtered out
                    </span>
                  )}
                  {' '} • Total value: ${portfolio.totalUsd.toFixed(2)}
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '2rem', 
                alignItems: 'flex-start', 
                marginTop: '1.5rem',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
              <Suspense fallback={<div className="loading">Rendering chart</div>}>
                <PortfolioChart 
                  data={portfolio.holdings} 
                  selectedTokenId={selectedToken?.tokenId || null}
                  onTokenSelect={handleTokenSelect}
                />
              </Suspense>
              <Suspense fallback={<div className="loading">Loading table</div>}>
                {(() => {
                  const Table = lazy(() => import('./components/PortfolioTable'))
                  return <Table 
                    data={portfolio.holdings} 
                    selectedTokenId={selectedToken?.tokenId || null}
                    onTokenSelect={handleTokenSelect}
                  />
                })()}
              </Suspense>
              </div>
            </>
          )}
        </div>

        {/* DeFi Holdings Section */}
        {(defiTokens.length > 0 || defiData) && (
          <div className="defi-section" style={{ 
            marginTop: '3rem',
            padding: '2rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h2 style={{ 
              color: '#495057',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🏛️ DeFi Holdings
              {defiTokens.length > 0 && (
                <span style={{ 
                  fontSize: '0.8rem',
                  fontWeight: 'normal',
                  color: '#6c757d',
                  backgroundColor: '#e9ecef',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '12px'
                }}>
                  {defiTokens.length} tokens filtered
                </span>
              )}
            </h2>

            {/* Temporary DeFi Validation Panel */}
            {defiTokens.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <div 
                  onClick={() => setDefiValidationExpanded(!defiValidationExpanded)}
                  style={{ 
                    cursor: 'pointer',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#e9ecef',
                    borderRadius: '6px',
                    border: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: defiValidationExpanded ? '1rem' : '0'
                  }}
                >
                  <h4 style={{ 
                    margin: 0,
                    color: '#495057',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    🔍 Token Filter Results
                    <span style={{ 
                      fontSize: '0.75rem',
                      fontWeight: 'normal',
                      color: '#6c757d',
                      backgroundColor: '#f8f9fa',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '10px'
                    }}>
                      {defiTokens.length} filtered
                    </span>
                  </h4>
                  <span style={{ 
                    fontSize: '1.2rem',
                    color: '#6c757d',
                    transform: defiValidationExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ▼
                  </span>
                </div>
                
                {defiValidationExpanded && (
                  <>
                    <p style={{ 
                      color: '#6c757d', 
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                      padding: '0 1rem'
                    }}>
                      These tokens were identified as DeFi positions and are excluded from regular token analysis.
                    </p>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '0.75rem',
                      marginBottom: '1rem'
                    }}>
                      {defiTokens.map((token, index) => {
                        const analysis = filterResults.find(r => r.symbol === token.symbol)
                        return (
                          <div key={`${token.tokenId}-${index}`} style={{
                            padding: '0.75rem',
                            backgroundColor: 'white',
                            borderRadius: '4px',
                            border: '1px solid #dee2e6',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.4rem'
                            }}>
                              <h5 style={{ 
                                margin: 0,
                                color: '#212529',
                                fontSize: '0.95rem',
                                fontWeight: '600'
                              }}>
                                {token.symbol}
                              </h5>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.3rem',
                                borderRadius: '6px',
                                backgroundColor: analysis?.confidence && analysis.confidence > 0.9 
                                  ? '#d4edda' : analysis?.confidence && analysis.confidence > 0.8 
                                  ? '#fff3cd' : '#f8d7da',
                                color: analysis?.confidence && analysis.confidence > 0.9 
                                  ? '#155724' : analysis?.confidence && analysis.confidence > 0.8 
                                  ? '#856404' : '#721c24',
                                border: `1px solid ${analysis?.confidence && analysis.confidence > 0.9 
                                  ? '#c3e6cb' : analysis?.confidence && analysis.confidence > 0.8 
                                  ? '#ffeaa7' : '#f5c6cb'}`
                              }}>
                                {analysis?.confidence ? `${(analysis.confidence * 100).toFixed(0)}%` : 'N/A'}
                              </span>
                            </div>
                            
                            <div style={{ 
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.4rem'
                            }}>
                              <span style={{ 
                                fontSize: '0.8rem',
                                color: '#495057'
                              }}>
                                {token.amount.toLocaleString()}
                              </span>
                              <span style={{ 
                                fontSize: '0.8rem',
                                color: '#28a745',
                                fontWeight: '600'
                              }}>
                                ${token.usd.toFixed(2)}
                              </span>
                            </div>
                            
                            {analysis && (
                              <div style={{ 
                                fontSize: '0.7rem',
                                color: '#6c757d',
                                paddingTop: '0.4rem',
                                borderTop: '1px solid #e9ecef'
                              }}>
                                <div>
                                  <strong>{analysis.suggestedCategory || 'Unknown'}</strong> • {analysis.reasons?.[0] || 'DeFi token detected'}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    
                    <div style={{ 
                      padding: '0.75rem',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '4px',
                      border: '1px solid #bbdefb'
                    }}>
                      <p style={{ 
                        margin: 0,
                        fontSize: '0.8rem',
                        color: '#1565c0'
                      }}>
                        💡 DeFi tokens are excluded from token holder analysis to ensure accurate results.
                      </p>
                    </div>

                    {/* Platform Pools Overview */}
                    {(saucerPools.length > 0 || bonzoPools.length > 0) && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <h6 style={{ color: '#495057', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                          🌐 Platform Pools Overview
                        </h6>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          {/* SaucerSwap Pools */}
                          {saucerPools.length > 0 && (
                            <div style={{ flex: '1 1 260px' }}>
                              <h6 style={{ color: '#0056b3', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                                SaucerSwap ({saucerPools.length})
                              </h6>
                              <div style={{ maxHeight: '110px', overflowY: 'auto', fontSize: '0.75rem', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: 'white' }}>
                                {saucerPools.slice(0,50).map((p:any, idx:number)=> (
                                  <div key={`svp-${idx}`} style={{ display:'flex', justifyContent:'space-between', padding:'0.25rem 0.5rem', borderBottom:'1px dashed #f1f3f5' }}>
                                    <span>{p.token0_symbol}-{p.token1_symbol}</span>
                                    <span>{p.apr ? `${parseFloat(p.apr).toFixed(2)}%` : '-'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Bonzo Pools */}
                          {bonzoPools.length > 0 && (
                            <div style={{ flex: '1 1 200px' }}>
                              <h6 style={{ color: '#8e24aa', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                                Bonzo ({bonzoPools.length})
                              </h6>
                              <div style={{ maxHeight: '110px', overflowY: 'auto', fontSize: '0.75rem', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: 'white' }}>
                                {bonzoPools.slice(0,50).map((p:any, idx:number)=> (
                                  <div key={`bp-${idx}`} style={{ display:'flex', justifyContent:'space-between', padding:'0.25rem 0.5rem', borderBottom:'1px dashed #f1f3f5' }}>
                                    <span>{p.symbol}</span>
                                    <span>{p.supply_apy ? `${parseFloat(p.supply_apy).toFixed(2)}%` : '-'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Protocol-Specific DeFi Positions */}
            {defiData && (
              <div style={{ marginTop: defiTokens.length > 0 ? '2rem' : '0' }}>
                <div 
                  onClick={() => setDefiProtocolsExpanded(!defiProtocolsExpanded)}
                  style={{ 
                    cursor: 'pointer',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#e9ecef',
                    borderRadius: '6px',
                    border: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: defiProtocolsExpanded ? '1rem' : '0'
                  }}
                >
                  <h4 style={{ 
                    margin: 0,
                    color: '#495057',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    🔗 Live DeFi Positions
                    {defiData.error && (
                      <span style={{ 
                        fontSize: '0.75rem',
                        fontWeight: 'normal',
                        color: '#dc3545',
                        backgroundColor: '#f8d7da',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '10px'
                      }}>
                        Error
                      </span>
                    )}
                    {!defiData.error && (defiData.saucer_swap || defiData.bonzo_finance) && (
                      <span style={{ 
                        fontSize: '0.75rem',
                        fontWeight: 'normal',
                        color: '#28a745',
                        backgroundColor: '#d4edda',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '10px'
                      }}>
                        Active
                      </span>
                    )}
                  </h4>
                  <span style={{ 
                    fontSize: '1.2rem',
                    color: '#6c757d',
                    transform: defiProtocolsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ▼
                  </span>
                </div>
                
                {defiProtocolsExpanded && !defiData.error && (
                  <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {/* Debug DeFi Data Structure */}
                    <div style={{ 
                      marginBottom: '1.5rem',
                      padding: '0.75rem',
                      backgroundColor: '#fff3e0',
                      borderRadius: '4px',
                      border: '1px solid #ffcc02'
                    }}>
                      <h5 style={{ 
                        margin: '0 0 0.5rem 0',
                        color: '#f57c00',
                        fontSize: '0.9rem'
                      }}>
                        🔧 Debug: DeFi Data Structure
                      </h5>
                      <div style={{ 
                        fontSize: '0.75rem',
                        color: '#ef6c00',
                        fontFamily: 'monospace',
                        backgroundColor: 'white',
                        padding: '0.5rem',
                        borderRadius: '3px',
                        border: '1px solid #ffb74d',
                        maxHeight: '150px',
                        overflow: 'auto'
                      }}>
                        {(() => {
                        const cleaned = { ...defiData } as any
                        // remove huge arrays for preview

                        const pretty = JSON.stringify(cleaned, null, 2)
                        return <pre>{pretty.length>4000? pretty.slice(0,4000)+"\n... truncated": pretty}</pre>
                      })()}
                      </div>
                    </div>

                    {/* SaucerSwap Section */}
                {defiData.saucer_swap && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ 
                      color: '#0056b3',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      🌊 SaucerSwap
                    </h4>
                    
                    {/* Pools V2 */}
                    {defiData.saucer_swap.pools_v2 && defiData.saucer_swap.pools_v2.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h6 style={{ color: '#495057', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liquidity Pools V2</h6>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '0.75rem'
                        }}>
                          {defiData.saucer_swap.pools_v2.map((pool: any, index: number) => (
                            <div key={`pool-v2-${index}`} style={{
                              padding: '0.75rem',
                              backgroundColor: 'white',
                              borderRadius: '4px',
                              border: '1px solid #dee2e6',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}>
                              <div style={{ 
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.5rem'
                              }}>
                                <h6 style={{ 
                                  margin: 0,
                                  color: '#212529',
                                  fontSize: '0.9rem',
                                  fontWeight: '600'
                                }}>
                                  {pool.token0_symbol}-{pool.token1_symbol}
                                </h6>
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '0.15rem 0.3rem',
                                  backgroundColor: '#e3f2fd',
                                  color: '#1976d2',
                                  borderRadius: '8px',
                                  border: '1px solid #bbdefb'
                                }}>
                                  V2
                                </span>
                              </div>
                              
                              <div style={{ 
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '0.5rem'
                              }}>
                                <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                                  {pool.token0_symbol}: {pool.token0_balance ? parseFloat(pool.token0_balance).toLocaleString() : '0'}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                                  {pool.token1_symbol}: {pool.token1_balance ? parseFloat(pool.token1_balance).toLocaleString() : '0'}
                                </span>
                              </div>
                              
                              {pool.total_value_usd && (
                                <div style={{ 
                                  fontSize: '0.8rem',
                                  color: '#28a745',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  padding: '0.4rem',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '3px'
                                }}>
                                  ${parseFloat(pool.total_value_usd).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pools V1 */}
                    {defiData.saucer_swap.pools_v1 && defiData.saucer_swap.pools_v1.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ color: '#495057', marginBottom: '0.75rem' }}>Liquidity Pools V1</h5>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                          gap: '1rem'
                        }}>
                          {defiData.saucer_swap.pools_v1.map((pool: any, index: number) => (
                            <div key={`pool-v1-${index}`} style={{
                              padding: '1rem',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #dee2e6',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{ 
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.75rem'
                              }}>
                                <h6 style={{ 
                                  margin: 0,
                                  color: '#212529',
                                  fontSize: '1rem',
                                  fontWeight: '600'
                                }}>
                                  {pool.token0_symbol}-{pool.token1_symbol}
                                </h6>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.5rem',
                                  backgroundColor: '#fff3e0',
                                  color: '#f57c00',
                                  borderRadius: '12px',
                                  border: '1px solid #ffcc02'
                                }}>
                                  V1 Pool
                                </span>
                              </div>
                              
                              <div style={{ 
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '0.5rem',
                                marginBottom: '0.75rem'
                              }}>
                                <div>
                                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                    {pool.token0_symbol}
                                  </div>
                                  <div style={{ 
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    color: '#495057'
                                  }}>
                                    {pool.token0_balance ? parseFloat(pool.token0_balance).toLocaleString() : '0'}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                    {pool.token1_symbol}
                                  </div>
                                  <div style={{ 
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    color: '#495057'
                                  }}>
                                    {pool.token1_balance ? parseFloat(pool.token1_balance).toLocaleString() : '0'}
                                  </div>
                                </div>
                              </div>
                              
                              {pool.total_value_usd && (
                                <div style={{ 
                                  fontSize: '0.9rem',
                                  color: '#28a745',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  padding: '0.5rem',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '4px'
                                }}>
                                  ${parseFloat(pool.total_value_usd).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Farms */}
                    {defiData.saucer_swap.farms && defiData.saucer_swap.farms.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ color: '#495057', marginBottom: '0.75rem' }}>Yield Farms</h5>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                          gap: '1rem'
                        }}>
                          {defiData.saucer_swap.farms.map((farm: any, index: number) => (
                            <div key={`farm-${index}`} style={{
                              padding: '1rem',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #dee2e6',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{ 
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.75rem'
                              }}>
                                <h6 style={{ 
                                  margin: 0,
                                  color: '#212529',
                                  fontSize: '1rem',
                                  fontWeight: '600'
                                }}>
                                  {farm.name || 'Farm Position'}
                                </h6>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.5rem',
                                  backgroundColor: '#f3e5f5',
                                  color: '#7b1fa2',
                                  borderRadius: '12px',
                                  border: '1px solid #ce93d8'
                                }}>
                                  Farm
                                </span>
                              </div>
                              
                              {farm.staked_amount && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                    Staked Amount
                                  </div>
                                  <div style={{ 
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    color: '#495057'
                                  }}>
                                    {parseFloat(farm.staked_amount).toLocaleString()}
                                  </div>
                                </div>
                              )}
                              
                              {farm.rewards_pending && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                    Pending Rewards
                                  </div>
                                  <div style={{ 
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    color: '#ff9800'
                                  }}>
                                    {parseFloat(farm.rewards_pending).toLocaleString()}
                                  </div>
                                </div>
                              )}
                              
                              {farm.total_value_usd && (
                                <div style={{ 
                                  fontSize: '0.9rem',
                                  color: '#28a745',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  padding: '0.5rem',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '4px'
                                }}>
                                  ${parseFloat(farm.total_value_usd).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vaults */}
                    {defiData.saucer_swap.vaults && defiData.saucer_swap.vaults.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ color: '#495057', marginBottom: '0.75rem' }}>Vaults</h5>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                          gap: '1rem'
                        }}>
                          {defiData.saucer_swap.vaults.map((vault: any, index: number) => (
                            <div key={`vault-${index}`} style={{
                              padding: '1rem',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #dee2e6',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{ 
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.75rem'
                              }}>
                                <h6 style={{ 
                                  margin: 0,
                                  color: '#212529',
                                  fontSize: '1rem',
                                  fontWeight: '600'
                                }}>
                                  {vault.name || 'Vault Position'}
                                </h6>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.5rem',
                                  backgroundColor: '#e8f5e8',
                                  color: '#2e7d32',
                                  borderRadius: '12px',
                                  border: '1px solid #a5d6a7'
                                }}>
                                  Vault
                                </span>
                              </div>
                              
                              {vault.deposited_amount && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                    Deposited Amount
                                  </div>
                                  <div style={{ 
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    color: '#495057'
                                  }}>
                                    {parseFloat(vault.deposited_amount).toLocaleString()}
                                  </div>
                                </div>
                              )}
                              
                              {vault.total_value_usd && (
                                <div style={{ 
                                  fontSize: '0.9rem',
                                  color: '#28a745',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  padding: '0.5rem',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '4px'
                                }}>
                                  ${parseFloat(vault.total_value_usd).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bonzo Finance Section */}
                {defiData.bonzo_finance && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ 
                      color: '#8e24aa',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      🏦 Bonzo Finance
                    </h4>
                    
                    {/* Health Factor */}
                    {defiData.bonzo_finance.health_factor && (
                      <div style={{ 
                        marginBottom: '1.5rem',
                        padding: '1rem',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '2px solid #e1bee7',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '0.25rem' }}>
                          Health Factor
                        </div>
                        <div style={{ 
                          fontSize: '1.5rem',
                          fontWeight: '700',
                          color: defiData.bonzo_finance.health_factor > 2 ? '#28a745' : 
                                defiData.bonzo_finance.health_factor > 1.5 ? '#ffc107' : '#dc3545'
                        }}>
                          {parseFloat(defiData.bonzo_finance.health_factor).toFixed(2)}
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem',
                          color: defiData.bonzo_finance.health_factor > 2 ? '#155724' : 
                                defiData.bonzo_finance.health_factor > 1.5 ? '#856404' : '#721c24'
                        }}>
                          {defiData.bonzo_finance.health_factor > 2 ? 'Healthy' : 
                           defiData.bonzo_finance.health_factor > 1.5 ? 'Moderate Risk' : 'High Risk'}
                        </div>
                      </div>
                    )}

                    {/* Supplied Assets */}
                    {defiData.bonzo_finance.supplied && defiData.bonzo_finance.supplied.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ color: '#495057', marginBottom: '0.75rem' }}>Supplied Assets</h5>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                          gap: '1rem'
                        }}>
                          {defiData.bonzo_finance.supplied.map((asset: any, index: number) => (
                            <div key={`supplied-${index}`} style={{
                              padding: '1rem',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #dee2e6',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{ 
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.75rem'
                              }}>
                                <h6 style={{ 
                                  margin: 0,
                                  color: '#212529',
                                  fontSize: '1rem',
                                  fontWeight: '600'
                                }}>
                                  {asset.symbol || asset.token_symbol}
                                </h6>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.5rem',
                                  backgroundColor: '#e8f5e8',
                                  color: '#2e7d32',
                                  borderRadius: '12px',
                                  border: '1px solid #a5d6a7'
                                }}>
                                  Supplied
                                </span>
                              </div>
                              
                              <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                  Amount
                                </div>
                                <div style={{ 
                                  fontSize: '0.9rem',
                                  fontWeight: '500',
                                  color: '#495057'
                                }}>
                                  {asset.amount !== undefined ? parseFloat(asset.amount).toLocaleString() : (asset.balance ? parseFloat(asset.balance).toLocaleString() : '0')}
                                </div>
                              </div>
                              
                              {asset.apy && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                    Supply APY
                                  </div>
                                  <div style={{ 
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    color: '#28a745'
                                  }}>
                                    {parseFloat(asset.apy).toFixed(2)}%
                                  </div>
                                </div>
                              )}
                              
                              {asset.value_usd && (
                                <div style={{ 
                                  fontSize: '0.9rem',
                                  color: '#28a745',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  padding: '0.5rem',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '4px'
                                }}>
                                  ${parseFloat(asset.value_usd).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Borrowed Assets */}
                    {defiData.bonzo_finance.borrowed && defiData.bonzo_finance.borrowed.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h5 style={{ color: '#495057', marginBottom: '0.75rem' }}>Borrowed Assets</h5>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                          gap: '1rem'
                        }}>
                          {defiData.bonzo_finance.borrowed.map((asset: any, index: number) => (
                            <div key={`borrowed-${index}`} style={{
                              padding: '1rem',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #dee2e6',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{ 
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.75rem'
                              }}>
                                <h6 style={{ 
                                  margin: 0,
                                  color: '#212529',
                                  fontSize: '1rem',
                                  fontWeight: '600'
                                }}>
                                  {asset.symbol || asset.token_symbol}
                                </h6>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.5rem',
                                  backgroundColor: '#ffebee',
                                  color: '#c62828',
                                  borderRadius: '12px',
                                  border: '1px solid #ef9a9a'
                                }}>
                                  Borrowed
                                </span>
                              </div>
                              
                              <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                  Amount
                                </div>
                                <div style={{ 
                                  fontSize: '0.9rem',
                                  fontWeight: '500',
                                  color: '#495057'
                                }}>
                                  {asset.amount !== undefined ? parseFloat(asset.amount).toLocaleString() : (asset.balance ? parseFloat(asset.balance).toLocaleString() : '0')}
                                </div>
                              </div>
                              
                              {asset.apy && (
                                <div style={{ marginBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                    Borrow APY
                                  </div>
                                  <div style={{ 
                                    fontSize: '0.9rem',
                                    fontWeight: '500',
                                    color: '#dc3545'
                                  }}>
                                    {parseFloat(asset.apy).toFixed(2)}%
                                  </div>
                                </div>
                              )}
                              
                              {asset.value_usd && (
                                <div style={{ 
                                  fontSize: '0.9rem',
                                  color: '#dc3545',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  padding: '0.5rem',
                                  backgroundColor: '#f8f9fa',
                                  borderRadius: '4px'
                                }}>
                                  -${parseFloat(asset.value_usd).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                    {/* No DeFi Positions Found */}
                    {!defiData.saucer_swap && !defiData.bonzo_finance && (
                      <div style={{ 
                        textAlign: 'center',
                        padding: '1.5rem',
                        color: '#6c757d',
                        backgroundColor: 'white',
                        borderRadius: '6px',
                        border: '1px solid #dee2e6'
                      }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
                        <h5 style={{ color: '#495057', marginBottom: '0.5rem', fontSize: '1rem' }}>No Active DeFi Positions</h5>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>
                          No positions found on SaucerSwap or Bonzo Finance for this address.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* DeFi Data Error */}
                {defiProtocolsExpanded && defiData.error && (
                  <div style={{ 
                    padding: '0.75rem',
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '4px'
                  }}>
                    <h5 style={{ color: '#856404', marginBottom: '0.5rem', fontSize: '0.9rem' }}>⚠️ DeFi Data Unavailable</h5>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#856404' }}>
                      {defiData.message || 'Unable to fetch DeFi protocol data'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* New DeFi Heatmaps */}
        {poolData.length > 0 && (
          <DefiHeatmaps pools={poolData} initiallyOpen={false} />
        )}

        {/* AI Chat Section */}
        <div className="chat-section">
          <div className="chat-header">
            <h2 className="chat-title">AI Portfolio Assistant</h2>
            <p className="chat-subtitle">
              Get intelligent insights about your portfolio with advanced financial analysis
            </p>
          </div>
          <ChatWindow 
            selectedAddress={selectedAddress} 
            hederaNetwork={network} 
            portfolio={portfolio || undefined}
            scratchpadContext={getScratchpadSummary()}
          />
        </div>
      </div>
    </div>
  )
}

export default App 