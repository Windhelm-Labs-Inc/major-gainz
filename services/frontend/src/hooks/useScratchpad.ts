import { useState, useCallback } from 'react'
import type { Holding } from '../types/portfolio'

export interface TokenAnalysisData {
  percentile_rank: number
  rank_label: string
  top_holder_balance: number
  total_holders_count?: number
  last_updated: string
}

export interface ScratchpadData {
  selectedToken?: {
    symbol: string
    tokenId: string
    balance: number
    usdValue: number
    percentOfPortfolio: number
    timestamp: string
  }
  holderAnalysis?: {
    tokenSymbol: string
    userPercentile: number
    rankLabel: string
    userBalance: number
    topHolderBalance: number
    lastUpdated: string
    distributionSummary: string
  }
  portfolioSummary?: {
    totalValue: number
    tokenCount: number
    topTokens: Array<{symbol: string, percentage: number}>
    lastRefreshed: string
  }
  userContext?: {
    address: string
    network: 'mainnet' | 'testnet'
    connectionType?: string
  }
}

export const useScratchpad = () => {
  const [scratchpad, setScratchpad] = useState<ScratchpadData>({})

  const updateSelectedToken = useCallback((token: Holding | null) => {
    setScratchpad(prev => ({
      ...prev,
      selectedToken: token ? {
        symbol: token.symbol,
        tokenId: token.tokenId,
        balance: token.amount,
        usdValue: token.usd,
        percentOfPortfolio: token.percent,
        timestamp: new Date().toISOString()
      } : undefined
    }))
  }, [])

  const updateHolderAnalysis = useCallback((
    token: Holding,
    analysisData: TokenAnalysisData
  ) => {
    const distributionSummary = `User ranks at ${analysisData.percentile_rank.toFixed(1)}% (${analysisData.rank_label}), top holder has ${(analysisData.top_holder_balance / 1e6).toFixed(2)}M ${token.symbol}`
    
    setScratchpad(prev => ({
      ...prev,
      holderAnalysis: {
        tokenSymbol: token.symbol,
        userPercentile: analysisData.percentile_rank,
        rankLabel: analysisData.rank_label,
        userBalance: token.amount,
        topHolderBalance: analysisData.top_holder_balance,
        lastUpdated: analysisData.last_updated,
        distributionSummary
      }
    }))
  }, [])

  const updatePortfolioSummary = useCallback((portfolio: any) => {
    if (!portfolio) return
    
    const topTokens = portfolio.holdings
      .filter((h: any) => h.usd > 0)
      .sort((a: any, b: any) => b.percent - a.percent)
      .slice(0, 3)
      .map((h: any) => ({
        symbol: h.symbol,
        percentage: h.percent
      }))

    setScratchpad(prev => ({
      ...prev,
      portfolioSummary: {
        totalValue: portfolio.totalUsd,
        tokenCount: portfolio.holdings.length,
        topTokens,
        lastRefreshed: new Date().toISOString()
      }
    }))
  }, [])

  const updateUserContext = useCallback((
    address: string,
    network: 'mainnet' | 'testnet',
    connectionType?: string
  ) => {
    setScratchpad(prev => ({
      ...prev,
      userContext: {
        address,
        network,
        connectionType
      }
    }))
  }, [])

  const clearScratchpad = useCallback(() => {
    setScratchpad({})
  }, [])

  const getScratchpadSummary = useCallback((): string => {
    const parts: string[] = []
    
    if (scratchpad.userContext) {
      parts.push(`User: ${scratchpad.userContext.address} on ${scratchpad.userContext.network}`)
    }
    
    if (scratchpad.portfolioSummary) {
      const { totalValue, tokenCount, topTokens } = scratchpad.portfolioSummary
      parts.push(`Portfolio: $${totalValue.toFixed(2)} across ${tokenCount} tokens. Top holdings: ${topTokens.map(t => `${t.symbol} (${t.percentage.toFixed(1)}%)`).join(', ')}`)
    }
    
    if (scratchpad.selectedToken) {
      parts.push(`Selected: ${scratchpad.selectedToken.symbol} - ${scratchpad.selectedToken.balance.toFixed(4)} tokens worth $${scratchpad.selectedToken.usdValue.toFixed(2)} (${scratchpad.selectedToken.percentOfPortfolio.toFixed(1)}% of portfolio)`)
    }
    
    if (scratchpad.holderAnalysis) {
      parts.push(`Holder Analysis: ${scratchpad.holderAnalysis.distributionSummary}`)
    }
    
    return parts.length > 0 ? parts.join('\n\n') : 'No active context'
  }, [scratchpad])

  return {
    scratchpad,
    updateSelectedToken,
    updateHolderAnalysis,
    updatePortfolioSummary,
    updateUserContext,
    clearScratchpad,
    getScratchpadSummary
  }
}