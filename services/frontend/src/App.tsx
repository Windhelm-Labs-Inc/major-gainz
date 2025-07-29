// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – json import
import settingsJson from '../appSettings.json'
import { useState, lazy, Suspense, useEffect } from 'react'
import type { Portfolio, Holding } from './types/portfolio'
import NetworkSelector from './components/NetworkSelector'
import WalletConnection from './components/WalletConnection'
import AddressInput from './components/AddressInput'
import ChatWindow from './components/ChatWindow'
import AddressDisplay from './components/AddressDisplay'
import TokenHolderAnalysis from './components/TokenHolderAnalysis'
import './App.css'

function App() {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null)
  const defaultNet = (settingsJson as any).HEDERA_NETWORK === 'testnet' ? 'testnet' : 'mainnet'
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

  const PortfolioChart = lazy(() => import('./components/PortfolioChart'))

  const handleWalletConnect = (walletType: string, address: string) => {
    console.log('[App] Wallet connected:', walletType, address)
    setConnectedWallet(walletType)
    setWalletAddress(address)
    setManualAddress(address)
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
    // reset portfolio when address changes
    setPortfolio(null)
  }

  const handleTokenSelect = (holding: Holding) => {
    console.log('[App] Token selected:', holding.symbol)
    setSelectedToken(holding)
  }

  const handleCloseAnalysis = () => {
    setSelectedToken(null)
  }

  const handleLoadPortfolio = async () => {
    console.log('[App] Loading portfolio for', selectedAddress, 'on', network)
    if (!selectedAddress) {
      alert('Please select an address first')
      return
    }
    setIsLoadingPortfolio(true)
    try {
      const res = await fetch(`/portfolio/${selectedAddress}?network=${network}`)
      if (!res.ok) {
        const txt = await res.text()
        console.error('[App] Backend error body', txt)
        throw new Error(txt)
      }
      const data: Portfolio = await res.json()
      console.log('[App] Portfolio loaded:', data)
      // Post-process to fetch missing prices
      const enriched = await enrichMissingPrices(data)
      setPortfolio(enriched)
    } catch (err: any) {
      console.error('Portfolio fetch failed', err)
      alert('Failed to load portfolio')
    } finally {
      setIsLoadingPortfolio(false)
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

  // Observe portfolio changes
  useEffect(() => {
    if (portfolio) {
      console.log('[App] Portfolio state updated', portfolio)
    }
  }, [portfolio])

  return (
    <div className="container" style={{ 
      display: 'flex',
      minHeight: '100vh',
      paddingLeft: selectedToken ? '400px' : '0',
      transition: 'padding-left 0.3s ease'
    }}>
      {/* Token Holder Analysis Sidebar */}
      {selectedToken && (
        <TokenHolderAnalysis 
          selectedToken={selectedToken}
          userAddress={selectedAddress}
          onClose={handleCloseAnalysis}
        />
      )}

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        {/* Header Section */}
        <div className="header">
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
          <ChatWindow selectedAddress={selectedAddress} hederaNetwork={network} portfolio={portfolio || undefined} />
        </div>
      </div>
    </div>
  )
}

export default App 