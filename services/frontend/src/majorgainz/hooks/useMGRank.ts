import { useMemo } from 'react';
import { Portfolio } from '../types';
import { getRankByHbarAmount, RANK_ICONS, RankName } from '../utils/rank';

export interface RankInfo {
  rank: RankName;
  hbarAmount: number;
  iconUrl: string;
}

export function useMGRank(portfolio?: Portfolio | null): RankInfo {
  const hbarAmount = useMemo(() => {
    const hbar = portfolio?.holdings?.find(h => h.symbol?.toUpperCase() === 'HBAR');
    return hbar?.amount ?? 0;
  }, [portfolio]);

  const rank = useMemo(() => getRankByHbarAmount(hbarAmount), [hbarAmount]);
  const iconUrl = useMemo(() => RANK_ICONS[rank], [rank]);

  return { rank, hbarAmount, iconUrl };
}


