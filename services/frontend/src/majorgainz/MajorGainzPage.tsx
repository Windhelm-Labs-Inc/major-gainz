import React, { useState, useEffect } from 'react';
import VerticalSidebar from './components/VerticalSidebar';
import HeaderBadge from './components/HeaderBadge';
import { ChatWindow } from './components/Chat';
import QuickActions from './components/QuickActions';
import SettingsDrawer from './components/SettingsDrawer';
import TargetOverlay from './components/TargetOverlay';
import ChatComponentRegistry from './components/ChatComponentRegistry';
import { useMGAgent, useMGPortfolio, useMGScratchpad } from './hooks';
import { useMGRank } from './hooks/useMGRank';
import { ComponentInstruction, ChartContext } from './types';

// Import styles
import './styles/palette.css';
import './styles/camo.css';

const MajorGainzPage: React.FC = () => {
  const [userAddress, setUserAddress] = useState<string>('');
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTargetOverlay, setShowTargetOverlay] = useState(false);
  const [isFirstLaunch] = useState(false);

  // Initialize hooks
  const portfolio = useMGPortfolio({
    userAddress: userAddress || undefined,
    network: 'mainnet',
    autoRefresh: true,
    refreshInterval: 30000,
  });

  const scratchpad = useMGScratchpad();
  const rankInfo = useMGRank(portfolio.portfolio);

  const context: ChartContext = {
    portfolio: portfolio.portfolio || undefined,
    defiData: portfolio.defiData || undefined,
    returnsStats: portfolio.returnsStats || undefined,
    userAddress: userAddress || undefined,
    network: 'mainnet',
  };

  const agent = useMGAgent({
    context,
    rankContext: { name: rankInfo.rank, hbarAmount: rankInfo.hbarAmount },
    personality: {
      name: 'Major Gainz',
      role: 'DeFi Operations Specialist',
      traits: [
        'Direct and tactical',
        'Expert in portfolio analysis', 
        'Focused on maximizing gains',
        'Mission-oriented communication'
      ],
      greeting: 'Major Gainz reporting to duty. What is the wallet we\'re conducting a recon mission on?',
      systemPrompt: `You are Major Gainz, a military-style DeFi operations specialist. 
        You help users analyze their cryptocurrency portfolios on Hedera mainnet with tactical precision.
        
        Your communication style:
        - Direct, clear, and mission-focused
        - Use military terminology naturally (but not excessively)
        - Always stay professional and helpful
        - Focus on actionable insights
        
         Your capabilities:
        - Portfolio analysis and allocation recommendations
        - Risk assessment and correlation analysis  
        - DeFi opportunity identification
        - Token holder analysis
        - Market intelligence on Hedera ecosystem
        
         When suggesting charts or visualizations, use these formats:
        - [CHART:portfolio-chart] for portfolio allocation
        - [CHART:risk-scatter] for risk/return analysis
        - [CHART:defi-heatmap] for DeFi opportunities
        - [CHART:correlation-matrix] for asset correlations
        - [CHART:token-analysis] for holder distribution
         
        
        Always operate on mainnet data only. Never suggest testnet operations.`
    },
  });

  // Add body class for Major Gainz styling
  useEffect(() => {
    document.body.classList.add('majorgainz-active');
    return () => {
      document.body.classList.remove('majorgainz-active');
    };
  }, []);

  // Show target overlay on first launch


  // Handle address changes
  const handleAddressChange = (address: string) => {
    setUserAddress(address);
    
    // Update scratchpad context
    if (address) {
      scratchpad.updateUserContext({
        address,
        network: 'mainnet',
        connectionType: 'manual',
      });
      
      // Show target overlay for new connections
      if (!isFirstLaunch) {
        setShowTargetOverlay(true);
      }
    } else {
      scratchpad.clearScratchpad();
    }
  };

  // Wallet provider callbacks
  const handleWalletConnect = (walletType: string, address: string) => {
    setConnectedWallet(walletType);
    handleAddressChange(address);
  };

  const handleWalletDisconnect = () => {
    setConnectedWallet(null);
    handleAddressChange('');
  };

  // Handle chart component rendering
  const handleComponentRender = (instruction: ComponentInstruction) => {
    return (
      <ChatComponentRegistry
        instruction={instruction}
        context={context}
      />
    );
  };

  // Handle target overlay completion
  const handleTargetComplete = () => {
    setShowTargetOverlay(false);
  };

  const pageStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh',
    background: 'var(--mg-bg)',
    position: 'relative',
  };

  const mainContentStyle: React.CSSProperties = {
    flex: 1,
    marginLeft: 'var(--mg-sidebar-width)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'relative',
  };

  const settingsButtonStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 25,
    background: 'var(--mg-white)',
    border: '2px solid var(--mg-gray-300)',
    borderRadius: 'var(--mg-radius-pill)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--mg-shadow)',
    transition: 'all var(--mg-transition)',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    minHeight: '44px',
  };

  return (
    <div style={pageStyle}>
      {/* Vertical Sidebar */}
      <VerticalSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Area */}
      <div style={mainContentStyle} className="majorgainz-camo-mask-right">
        {/* Header Badge */}
        <HeaderBadge
          walletAddress={userAddress}
          balanceUsd={portfolio.getTotalValue()}
          isLoading={portfolio.isLoading}
          error={portfolio.error?.message}
          onClick={() => setSettingsOpen(true)}
          rankName={rankInfo.rank}
          rankIconUrl={rankInfo.iconUrl}
        />

        {/* Chat Window */}
        <ChatWindow
          context={context}
          onSendMessage={agent.sendMessage}
          onComponentRender={handleComponentRender}
          isProcessing={agent.isProcessing}
          quickActions={(send) => (
            <QuickActions
              onActionSelect={(prompt) => { void send(prompt); }}
              portfolio={portfolio.portfolio || undefined}
              defiData={portfolio.defiData || undefined}
              isLoading={agent.isProcessing || portfolio.isLoading}
            />
          )}
        />

        {/* Quick Actions */}
        {/* QuickActions moved under chat input via ChatWindow prop */}
      </div>

      {/* Settings Button */}
      <button
        style={settingsButtonStyle}
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--mg-mint-500)';
          e.currentTarget.style.background = 'var(--mg-mint-100)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--mg-gray-300)';
          e.currentTarget.style.background = 'var(--mg-white)';
        }}
      >
        MIISION PARAMETERS
      </button>

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userAddress={userAddress}
        onAddressChange={handleAddressChange}
        balanceUsd={portfolio.getTotalValue()}
        isConnecting={portfolio.isLoading}
      />

      {/* Target Overlay */}
      <TargetOverlay
        isVisible={showTargetOverlay}
        duration={2500}
        onComplete={handleTargetComplete}
      />

      {/* Error Display */}
      {(portfolio.error || agent.error) && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#fee2e2',
          color: '#dc2626',
          padding: '12px 16px',
          borderRadius: 'var(--mg-radius)',
          border: '1px solid #fecaca',
          zIndex: 30,
          fontSize: '0.875rem',
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          ⚠️ {portfolio.error?.message || agent.error?.message}
        </div>
      )}
    </div>
  );
};

export default MajorGainzPage;
