import { Holder } from '../types';

export type DistributionMode = 'linear' | 'log10';

export interface Bin {
  rangeLabel: string;
  from: number;
  to: number;
  count: number;
  totalAmount: number;
}

export function getTopHolders(holders: Holder[] = [], n: number = 10): Holder[] {
  return [...holders]
    .sort((a, b) => (b.usd ?? b.amount) - (a.usd ?? a.amount))
    .slice(0, n);
}

export function toCumulativeDistribution(holders: Holder[] = []): Array<{ rank: number; amount: number; percent: number; address: string }>{
  const sorted = [...holders].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, h) => sum + (h.amount || 0), 0);
  let acc = 0;
  return sorted.map((h, idx) => {
    acc += h.amount || 0;
    return {
      rank: idx + 1,
      amount: h.amount || 0,
      percent: total > 0 ? (acc / total) * 100 : 0,
      address: h.address,
    };
  });
}

export function buildBins(
  holders: Holder[] = [],
  mode: DistributionMode = 'log10',
  binCount: number = 12
): Bin[] {
  if (!holders.length) return [];
  const amounts = holders.map(h => h.amount || 0).filter(v => v > 0);
  if (!amounts.length) return [];

  let min = Math.min(...amounts);
  let max = Math.max(...amounts);

  if (mode === 'log10') {
    min = Math.log10(Math.max(min, 1e-12));
    max = Math.log10(Math.max(max, 1e-12));
  }

  const step = (max - min) / binCount || 1;
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => {
    const start = min + i * step;
    const end = start + step;
    const from = mode === 'log10' ? Math.pow(10, start) : start;
    const to = mode === 'log10' ? Math.pow(10, end) : end;
    const label = mode === 'log10'
      ? `${formatAmount(from)}–${formatAmount(to)}`
      : `${from.toFixed(2)}–${to.toFixed(2)}`;
    return { rangeLabel: label, from, to, count: 0, totalAmount: 0 };
  });

  holders.forEach(h => {
    const amt = h.amount || 0;
    if (amt <= 0) return;
    const value = mode === 'log10' ? Math.log10(Math.max(amt, 1e-12)) : amt;
    const idx = Math.min(
      bins.length - 1,
      Math.max(0, Math.floor((value - min) / step))
    );
    bins[idx].count += 1;
    bins[idx].totalAmount += amt;
  });

  return bins;
}

export function formatAmount(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}


