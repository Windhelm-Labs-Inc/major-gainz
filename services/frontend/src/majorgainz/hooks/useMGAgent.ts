import { useState, useCallback } from 'react';
import { ChatMessage, ChartContext, MGPersonality, MGError } from '../types';

interface AgentConfig {
  personality: MGPersonality;
  context: ChartContext;
  apiBaseUrl?: string;
}

interface AgentState {
  isProcessing: boolean;
  error: MGError | null;
  sessionId: string | null;
}

const defaultPersonality: MGPersonality = {
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
};

export const useMGAgent = (config: Partial<AgentConfig> = {}) => {
  const [state, setState] = useState<AgentState>({
    isProcessing: false,
    error: null,
    sessionId: null,
  });

  const personality = config.personality || defaultPersonality;
  const context = config.context || { network: 'mainnet' as const };
  const apiBaseUrl = config.apiBaseUrl || '/api';

  const sendMessage = useCallback(async (message: string): Promise<string> => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      // Prepare the request payload
      const payload = {
        message,
        context: {
          ...context,
          sessionId: state.sessionId,
          personality: personality.name,
          systemPrompt: personality.systemPrompt,
        },
      };

      // Call the chat API
      const response = await fetch(`${apiBaseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update session ID if provided
      if (result.sessionId && result.sessionId !== state.sessionId) {
        setState(prev => ({ ...prev, sessionId: result.sessionId }));
      }

      setState(prev => ({ ...prev, isProcessing: false }));
      
      return result.response || 'Roger that. Message received and acknowledged.';

    } catch (error) {
      console.error('Agent communication error:', error);
      
      const mgError: MGError = {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'AGENT_ERROR',
        details: error,
      };

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: mgError 
      }));

      // Return fallback response
      return 'Communication error encountered. Please verify your connection and try again.';
    }
  }, [apiBaseUrl, context, personality, state.sessionId]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const resetSession = useCallback(() => {
    setState({
      isProcessing: false,
      error: null,
      sessionId: null,
    });
  }, []);

  return {
    // State
    isProcessing: state.isProcessing,
    error: state.error,
    sessionId: state.sessionId,
    personality,
    
    // Actions
    sendMessage,
    clearError,
    resetSession,
  };
};

export type MGAgentHook = ReturnType<typeof useMGAgent>;
