import type { RawPitch, PitchFilters } from '../types';

// Default date bounds — unbounded. Each season's pitch file only contains that
// season, so a fixed calendar window is redundant AND wrong across seasons (a
// hardcoded 2025 window silently filtered out every 2026 pitch). Empty string
// = no bound; any user-set date counts as an active filter.
export const SEASON_DATE_FROM = '';
export const SEASON_DATE_TO = '';

export const DEFAULT_FILTERS: PitchFilters = {
  dateFrom: SEASON_DATE_FROM,
  dateTo: SEASON_DATE_TO,
  pitchTypes: [],
  counts: [],
  batterHand: 'all',
  innings: [],
  outs: [],
  zone: 'all',
  result: 'all',
  veloMin: null,
  veloMax: null,
  gameId: null,
};

export function countActiveFilters(filters: PitchFilters): number {
  let count = 0;
  // Dates only count as "active" if they differ from the season defaults
  if (filters.dateFrom && filters.dateFrom !== SEASON_DATE_FROM) count++;
  if (filters.dateTo && filters.dateTo !== SEASON_DATE_TO) count++;
  if (filters.pitchTypes.length > 0) count++;
  if (filters.counts.length > 0) count++;
  if (filters.batterHand !== 'all') count++;
  if (filters.innings.length > 0) count++;
  if (filters.outs.length > 0) count++;
  if (filters.zone !== 'all') count++;
  if (filters.result !== 'all') count++;
  if (filters.veloMin != null) count++;
  if (filters.veloMax != null) count++;
  if (filters.gameId != null) count++;
  return count;
}

export function filterPitches(pitches: RawPitch[], filters: PitchFilters): RawPitch[] {
  return pitches.filter((p) => {
    if (filters.dateFrom && p.gd < filters.dateFrom) return false;
    if (filters.dateTo && p.gd > filters.dateTo) return false;
    if (filters.pitchTypes.length > 0 && !filters.pitchTypes.includes(p.pt)) return false;
    if (filters.counts.length > 0 && !filters.counts.includes(`${p.b}-${p.s}`)) return false;
    if (filters.batterHand !== 'all' && p.bh !== filters.batterHand) return false;
    if (filters.innings.length > 0 && !filters.innings.includes(p.inn)) return false;
    if (filters.outs.length > 0 && !filters.outs.includes(p.o)) return false;
    if (filters.zone === 'in' && !(p.z >= 1 && p.z <= 9)) return false;
    if (filters.zone === 'edge' && !(p.z >= 11 && p.z <= 14)) return false;
    if (filters.zone === 'chase' && p.z <= 9) return false;
    if (filters.result === 'swing' && !p.sw) return false;
    if (filters.result === 'take' && p.sw) return false;
    if (filters.result === 'whiff' && !p.wh) return false;
    if (filters.result === 'in-play' && !p.ip) return false;
    if (filters.veloMin != null && p.v < filters.veloMin) return false;
    if (filters.veloMax != null && p.v > filters.veloMax) return false;
    if (filters.gameId != null && p.gid !== filters.gameId) return false;
    return true;
  });
}
