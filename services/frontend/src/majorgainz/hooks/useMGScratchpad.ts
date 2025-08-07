import { useState, useCallback } from 'react';
import { ScratchpadContext, Holding } from '../types';

interface ScratchpadState extends ScratchpadContext {
  notes: string;
  isModified: boolean;
}

export const useMGScratchpad = () => {
  const [state, setState] = useState<ScratchpadState>({
    userContext: undefined,
    portfolioSummary: undefined,
    defiSummary: undefined,
    selectedToken: undefined,
    holderAnalysis: undefined,
    notes: '',
    isModified: false,
  });

  const updateUserContext = useCallback((userContext: ScratchpadState['userContext']) => {
    setState(prev => ({
      ...prev,
      userContext,
      isModified: true,
    }));
  }, []);

  const updatePortfolioSummary = useCallback((summary: string) => {
    setState(prev => ({
      ...prev,
      portfolioSummary: summary,
      isModified: true,
    }));
  }, []);

  const updateDefiSummary = useCallback((summary: string) => {
    setState(prev => ({
      ...prev,
      defiSummary: summary,
      isModified: true,
    }));
  }, []);

  const selectToken = useCallback((token: Holding) => {
    setState(prev => ({
      ...prev,
      selectedToken: token,
      isModified: true,
    }));
  }, []);

  const updateHolderAnalysis = useCallback((analysis: any) => {
    setState(prev => ({
      ...prev,
      holderAnalysis: analysis,
      isModified: true,
    }));
  }, []);

  const updateNotes = useCallback((notes: string) => {
    setState(prev => ({
      ...prev,
      notes,
      isModified: true,
    }));
  }, []);

  const clearScratchpad = useCallback(() => {
    setState({
      userContext: undefined,
      portfolioSummary: undefined,
      defiSummary: undefined,
      selectedToken: undefined,
      holderAnalysis: undefined,
      notes: '',
      isModified: false,
    });
  }, []);

  const markSaved = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModified: false,
    }));
  }, []);

  const exportData = useCallback(() => {
    const exportData = {
      ...state,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `major-gainz-session-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state]);

  const importData = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          
          // Validate the data structure
          if (typeof data === 'object' && data !== null) {
            setState({
              userContext: data.userContext,
              portfolioSummary: data.portfolioSummary,
              defiSummary: data.defiSummary,
              selectedToken: data.selectedToken,
              holderAnalysis: data.holderAnalysis,
              notes: data.notes || '',
              isModified: true,
            });
            resolve();
          } else {
            reject(new Error('Invalid file format'));
          }
        } catch (error) {
          reject(new Error('Failed to parse JSON file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }, []);

  const getSummary = useCallback(() => {
    const sections = [];
    
    if (state.userContext) {
      sections.push(`Connected: ${state.userContext.address} (${state.userContext.network})`);
    }
    
    if (state.portfolioSummary) {
      sections.push(`Portfolio: ${state.portfolioSummary}`);
    }
    
    if (state.defiSummary) {
      sections.push(`DeFi: ${state.defiSummary}`);
    }
    
    if (state.selectedToken) {
      sections.push(`Focus: ${state.selectedToken.symbol} (${state.selectedToken.amount} tokens, $${state.selectedToken.usd})`);
    }
    
    if (state.notes) {
      sections.push(`Notes: ${state.notes}`);
    }
    
    return sections.join('\n');
  }, [state]);

  return {
    // State
    ...state,
    
    // Actions
    updateUserContext,
    updatePortfolioSummary,
    updateDefiSummary,
    selectToken,
    updateHolderAnalysis,
    updateNotes,
    clearScratchpad,
    markSaved,
    
    // Import/Export
    exportData,
    importData,
    
    // Helpers
    getSummary,
  };
};

export type MGScratchpadHook = ReturnType<typeof useMGScratchpad>;
