import React, { useState } from 'react'
import { ethers } from 'ethers'
import detectEthereumProvider from '@metamask/detect-provider'
// Environment variables bundled at build time
declare const __WALLETCONNECT_PROJECT_ID__: string
declare const __HEDERA_NETWORK__: string
// HashConnect is imported dynamically to avoid increasing the initial bundle size when users only use MetaMask.

// Hedera EVM chain IDs
const MAINNET_CHAIN_ID = '0x127' // 295
const TESTNET_CHAIN_ID = '0x128' // 296
const ALLOWED_CHAIN_IDS = [MAINNET_CHAIN_ID, TESTNET_CHAIN_ID]

// Determine preferred Hedera network from settings (mainnet|testnet)
interface WalletConnectionProps {
  onConnect: (walletType: string, address: string) => void
  onDisconnect: () => void
  connectedWallet: string | null
  walletAddress: string
  hederaNetwork: 'mainnet' | 'testnet'
}

const WalletConnection: React.FC<WalletConnectionProps> = ({
  onConnect,
  onDisconnect,
  connectedWallet,
  walletAddress,
  hederaNetwork
}) => {
  const [isConnecting, setIsConnecting] = useState(false)

  const PREFERRED_NETWORK = hederaNetwork
  const TARGET_CHAIN_ID = PREFERRED_NETWORK === 'mainnet' ? MAINNET_CHAIN_ID : TESTNET_CHAIN_ID

  const connectMetaMask = async () => {
    console.log('[WalletConnection] connectMetaMask start')
    setIsConnecting(true)
    try {
      const provider: any = await detectEthereumProvider({ mustBeMetaMask: true })

      if (!provider) {
        alert('MetaMask is not installed! Please install MetaMask to connect.')
        return setIsConnecting(false)
      }

      // Ensure we are on Hedera Mainnet or Testnet before requesting accounts.
      const currentChainId: string = await provider.request({ method: 'eth_chainId' })

      if (!ALLOWED_CHAIN_IDS.includes(currentChainId)) {
        try {
          // Attempt to switch to preferred Hedera network
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: TARGET_CHAIN_ID }]
          })
        } catch (switchError: any) {
          // 4902 = unrecognised chain – try to add it
          if (switchError?.code === 4902) {
            try {
              const chainConfig =
                PREFERRED_NETWORK === 'mainnet'
                  ? {
                      chainId: MAINNET_CHAIN_ID,
                      chainName: 'Hedera Mainnet',
                      nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
                      rpcUrls: ['https://mainnet.hashio.io/api'],
                      blockExplorerUrls: ['https://hashscan.io/mainnet']
                    }
                  : {
                      chainId: TESTNET_CHAIN_ID,
                      chainName: 'Hedera Testnet',
                      nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
                      rpcUrls: ['https://testnet.hashio.io/api'],
                      blockExplorerUrls: ['https://hashscan.io/testnet']
                    }
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [chainConfig]
              })
            } catch (addError) {
              console.error('Failed to add Hedera Testnet to MetaMask', addError)
              alert('Please switch your MetaMask network to Hedera Mainnet or Testnet and try again.')
              return
            }
          } else {
            alert('Please switch your MetaMask network to Hedera Mainnet or Testnet and try again.')
            return
          }
        }
      }

      // Check if we already have access to any accounts first.
      const existingAccounts: string[] = await provider.request({ method: 'eth_accounts' })

      let address: string | undefined

      if (existingAccounts.length > 0) {
        // Site is already connected – reuse the first account.
        address = existingAccounts[0]
      } else {
        try {
          // No accounts exposed yet – explicitly request access. This should trigger the MetaMask UI.
          const requestedAccounts: string[] = await provider.request({
            method: 'eth_requestAccounts',
            params: []
          })
          address = requestedAccounts[0]
        } catch (requestError: any) {
          // Handle cases where the user closes the MetaMask window or another request is already pending.
          if (requestError?.code === 4001) {
            // EIP-1193 userRejectedRequest error
            alert('You must approve the connection request in MetaMask in order to continue.')
          } else if (requestError?.code === -32002) {
            // Request already pending in MetaMask
            alert('A connection request is already pending in MetaMask. Please open MetaMask and complete the request, then try again.')
          } else {
            throw requestError
          }
          return
        }
      }

      if (!address) {
        throw new Error('Unable to determine account address.')
      }

      console.log('[WalletConnection] MetaMask address obtained', address)
      // (Optional) Create an ethers provider in case the app needs it later.
      // We don't keep a reference here, but this ensures the import isn't treeshaken away.
      void new ethers.BrowserProvider(provider)

      // At this point we have a valid address, finish the connection flow.
      // If you need the provider later, you can store it in state via a callback.
      console.log('[WalletConnection] MetaMask connection successful')
      onConnect('MetaMask', address)
    } catch (error: any) {
      console.error('[WalletConnection] Error connecting to MetaMask:', error)
      alert('Failed to connect to MetaMask. Check the console for details.')
    } finally {
      setIsConnecting(false)
    }
  }

  const connectHashPack = async () => {
    console.log('[WalletConnection] connectHashPack start')
    setIsConnecting(true)
    try {
      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore - runtime import; types may not be available
      const [{ HashConnect }, { LedgerId }] = await Promise.all([
        import('hashconnect'),
        import('@hashgraph/sdk')
      ])
      /* eslint-enable @typescript-eslint/ban-ts-comment */

      // Use bundled environment variable for project id
      const projectId = __WALLETCONNECT_PROJECT_ID__ && __WALLETCONNECT_PROJECT_ID__ !== 'YOUR_PROJECT_ID_HERE'
        ? __WALLETCONNECT_PROJECT_ID__
        : undefined

      if (!projectId) {
        alert('HashPack connection requires a WalletConnect Project ID.\nPlease configure the environment variable and rebuild the app.')
        return
      }

      const appMetadata = {
        name: 'Quick Origins POC',
        description: 'Demo dApp for Quick Origins',
        icons: ['https://www.hashpack.app/img/logo.svg'],
        url: window.location.origin
      }

      // Quick check: is there a previously saved pairing in localStorage?
      const existingAddress = (() => {
        try {
          for (const k in localStorage) {
            if (k.startsWith('hashconnect')) {
              const data = JSON.parse(localStorage.getItem(k) || 'null')
              if (data?.pairingData?.accountIds?.length) {
                return data.pairingData.accountIds[0] as string
              }
              if (data?.pairings?.length && data.pairings[0].accountIds?.length) {
                return data.pairings[0].accountIds[0] as string
              }
            }
          }
        } catch {
          /* ignore parse errors */
        }
        return null
      })()

      if (existingAddress) {
        console.log('[WalletConnection] HashPack existing pairing', existingAddress)
        onConnect('HashPack', existingAddress)
        return
      }

      // Prefer Testnet – adjust to MAINNET if required.
      const network = PREFERRED_NETWORK === 'mainnet' ? LedgerId.MAINNET : LedgerId.TESTNET

      const hashconnect = new HashConnect(network, projectId, appMetadata, false)

      // Initialisation
      await hashconnect.init()

      // If already paired before, accounts will be available immediately
      if (hashconnect.connectedAccountIds.length > 0) {
        await new Promise(res => setTimeout(res, 300))
        onConnect('HashPack', hashconnect.connectedAccountIds[0].toString())
        return
      }

      // Not yet paired - open modal and wait for pairing event
      hashconnect.openPairingModal()

      const pairingData: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('User did not approve connection in time.')), 60000)
        hashconnect.pairingEvent.on((pdata: any) => {
          clearTimeout(timeout)
          resolve(pdata)
        })
      })

      if (pairingData?.accountIds?.length) {
        console.log('[WalletConnection] HashPack paired', pairingData.accountIds[0])
        await new Promise(res => setTimeout(res, 300))
        onConnect('HashPack', pairingData.accountIds[0])
      } else {
        alert('No Hedera account returned from HashPack.')
      }
    } catch (error: any) {
      console.error('[WalletConnection] Error connecting to HashPack:', error)
      alert('Failed to connect to HashPack. See console for details.')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    console.log('[WalletConnection] Disconnect clicked')
    onDisconnect()
  }

  return (
    <div className="wallet-connection">
      {!connectedWallet ? (
        <div className="wallet-buttons">
          <button 
            onClick={connectMetaMask}
            disabled={isConnecting}
            className="metamask-btn"
          >
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
          <button 
            onClick={connectHashPack}
            disabled={isConnecting}
            className="hashpack-btn"
          >
            {isConnecting ? 'Connecting...' : 'Connect HashPack'}
          </button>
        </div>
      ) : (
        <div className="connected-wallet">
          <p className="status-connected">
            ✅ Connected to {connectedWallet}
          </p>
          <p className="wallet-address">
            Address: {walletAddress}
          </p>
          <button onClick={disconnect} className="disconnect-btn">
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}

export default WalletConnection 