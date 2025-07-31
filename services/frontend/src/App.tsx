// Environment variables bundled at build time
declare const __WALLETCONNECT_PROJECT_ID__: string
declare const __HEDERA_NETWORK__: string
import { useState, lazy, Suspense, useEffect, useCallback } from 'react'
import type { Portfolio, Holding } from './types/portfolio'
import NetworkSelector from './components/NetworkSelector'
import WalletConnection from './components/WalletConnection'
import AddressInput from './components/AddressInput'
import ChatWindow from './components/ChatWindow'
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
  const [defiData, setDefiData] = useState<any>(null)
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
  }

  const handleTokenSelect = (holding: Holding) => {
    console.log('[App] Token selected:', holding.symbol)
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
      const [portfolioRes, defiRes] = await Promise.all([
        fetch(`/portfolio/${selectedAddress}?network=${network}`),
        fetch(`/defi/profile/${selectedAddress}?testnet=${network === 'testnet'}`)
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
      setPortfolio(enriched)
      
      // Handle DeFi response
      if (defiRes.ok) {
        // Check if response is actually JSON
        const contentType = defiRes.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          try {
            const defiData = await defiRes.json()
            console.log('[App] DeFi data loaded:', defiData)
            setDefiData(defiData)
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
            <div style={{ 
              display: 'flex', 
              gap: '2rem', 
              alignItems: 'flex-start', 
              marginTop: '2rem',
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
          )}
        </div>

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