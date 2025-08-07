// Rank utilities for Major Gainz
// Converts user's HBAR amount into a rank and exposes icon URLs

export type RankName =
  | 'General'
  | 'Colonel'
  | 'Major'
  | 'Lieutenant'
  | 'Sergeant'
  | 'Private'
  | 'Recruit';

export const RANK_THRESHOLDS: Array<{ name: RankName; minHBAR: number }> = [
  { name: 'General', minHBAR: 100_000 },
  { name: 'Colonel', minHBAR: 5_000 },
  { name: 'Major', minHBAR: 2_500 },
  { name: 'Lieutenant', minHBAR: 1_000 },
  { name: 'Sergeant', minHBAR: 100 },
  { name: 'Private', minHBAR: 10 },
  { name: 'Recruit', minHBAR: 0 },
];

// Vite: `?url` returns a string URL for <img src="">
// These assets are provided in services/frontend/src/majorgainz/assets/ranks
// Recruit has no asset yet; we fall back to Private
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite virtual import type
import General from '../assets/ranks/General.svg?url';
// @ts-ignore
import Colonel from '../assets/ranks/Colonel.svg?url';
// @ts-ignore
import Major from '../assets/ranks/Major.svg?url';
// @ts-ignore
import Lieutenant from '../assets/ranks/Lieutenant.svg?url';
// @ts-ignore
import Sergeant from '../assets/ranks/Sergeant.svg?url';
// @ts-ignore
import Private from '../assets/ranks/Private.svg?url';

export const RANK_ICONS: Record<RankName, string> = {
  General,
  Colonel,
  Major,
  Lieutenant,
  Sergeant,
  Private,
  Recruit: Private,
};

export function getRankByHbarAmount(hbarAmount: number): RankName {
  for (const r of RANK_THRESHOLDS) {
    if (hbarAmount >= r.minHBAR) return r.name;
  }
  return 'Recruit';
}


