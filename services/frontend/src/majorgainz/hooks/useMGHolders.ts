import { useCallback, useState } from 'react';
import { Holder, MGError } from '../types';

interface HoldersState {
  holders: Holder[] | null;
  percentiles: Record<string, number> | null;
  isLoading: boolean;
  error: MGError | null;
}

export const useMGHolders = (apiBaseUrl: string = '/api') => {
  const base = apiBaseUrl.replace(/\/$/, '');
  const [state, setState] = useState<HoldersState>({ holders: null, percentiles: null, isLoading: false, error: null });

  const loadForSymbol = useCallback(async (symbol: string, opts?: { address?: string; tokenBalance?: string }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      // Prefer user-specific POST for percentile + top holders if address/balance provided
      if (opts?.address && opts?.tokenBalance) {
        const res = await fetch(`${base}/token_holdings/${symbol}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: opts.address, token_balance: opts.tokenBalance }),
        });
        if (res.ok) {
          const data = await res.json();
          const top = (data.top_10_holders || []).map((h: any) => ({ address: h.account_id, amount: Number(h.balance) })) as Holder[];
          setState({ holders: top, percentiles: data.percentile_balances || null, isLoading: false, error: null });
          return;
        }
      }

      // Fallback to read-only endpoints
      const [topRes, pctRes] = await Promise.all([
        fetch(`${base}/holders/${symbol}/top?limit=10`),
        fetch(`${base}/holders/${symbol}/percentiles?list=99,95,90,75,50,25,10,5,1`),
      ]);
      const top = topRes.ok ? await topRes.json() : [];
      const pct = pctRes.ok ? await pctRes.json() : [];
      const holders: Holder[] = (top || []).map((h: any) => ({ address: h.account_id, amount: Number(h.balance) }));
      const percentiles: Record<string, number> = {};
      (pct || []).forEach((p: any) => { percentiles[`p${p.percentile}`] = Number(p.balance); });
      setState({ holders, percentiles, isLoading: false, error: null });
    } catch (e: any) {
      setState(prev => ({ ...prev, isLoading: false, error: { message: e?.message || 'Failed to load holders', code: 'HOLDERS_FETCH_ERROR', details: e } }));
    }
  }, [base]);

  return {
    holders: state.holders,
    percentiles: state.percentiles,
    isLoading: state.isLoading,
    error: state.error,
    loadForSymbol,
  };
};

export type MGHoldersHook = ReturnType<typeof useMGHolders>;


