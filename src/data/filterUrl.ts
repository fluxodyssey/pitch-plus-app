import type { PitchFilters } from '../types';
import { DEFAULT_FILTERS } from './filterPitches';

export function filtersToSearchParams(filters: PitchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.pitchTypes.length > 0) params.set('pt', filters.pitchTypes.join(','));
  if (filters.counts.length > 0) params.set('counts', filters.counts.join(','));
  if (filters.batterHand !== 'all') params.set('bh', filters.batterHand);
  if (filters.innings.length > 0) params.set('inn', filters.innings.join(','));
  if (filters.outs.length > 0) params.set('outs', filters.outs.join(','));
  if (filters.zone !== 'all') params.set('zone', filters.zone);
  if (filters.result !== 'all') params.set('result', filters.result);
  if (filters.veloMin != null) params.set('vmin', String(filters.veloMin));
  if (filters.veloMax != null) params.set('vmax', String(filters.veloMax));
  if (filters.dateFrom) params.set('from', filters.dateFrom);
  if (filters.dateTo) params.set('to', filters.dateTo);
  if (filters.gameId != null) params.set('gid', String(filters.gameId));
  return params;
}

export function searchParamsToFilters(params: URLSearchParams): PitchFilters {
  const f = { ...DEFAULT_FILTERS };
  const pt = params.get('pt');
  if (pt) f.pitchTypes = pt.split(',');
  const counts = params.get('counts');
  if (counts) f.counts = counts.split(',');
  const bh = params.get('bh');
  if (bh === 'L' || bh === 'R') f.batterHand = bh;
  const inn = params.get('inn');
  if (inn) f.innings = inn.split(',').map(Number);
  const outs = params.get('outs');
  if (outs) f.outs = outs.split(',').map(Number);
  const zone = params.get('zone');
  if (zone === 'in' || zone === 'edge' || zone === 'chase') f.zone = zone;
  const result = params.get('result');
  if (result === 'swing' || result === 'take' || result === 'whiff' || result === 'in-play') f.result = result;
  const vmin = params.get('vmin');
  if (vmin) f.veloMin = Number(vmin);
  const vmax = params.get('vmax');
  if (vmax) f.veloMax = Number(vmax);
  const from = params.get('from');
  if (from) f.dateFrom = from;
  const to = params.get('to');
  if (to) f.dateTo = to;
  const gid = params.get('gid');
  if (gid) f.gameId = Number(gid);
  return f;
}
