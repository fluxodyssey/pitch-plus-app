import type { PitchersData, PitchTypesData, Pitcher, DimensionKey, MetricKey } from '../types';

// ─── Delta Types ─────────────────────────────────────────────────────────────

export interface PitchTypeDelta {
  pitch_type: string;
  pitch_name: string;
  spring_velo: number | null;
  spring_spin: number | null;
  spring_ivb: number | null;
  spring_hb: number | null;
  spring_usage: number;
  spring_whiff: number | null;
  baseline_velo: number | null;
  baseline_spin: number | null;
  baseline_ivb: number | null;
  baseline_hb: number | null;
  baseline_usage: number;
  baseline_whiff: number | null;
  velo_delta: number | null;
  spin_delta: number | null;
  ivb_delta: number | null;
  hb_delta: number | null;
  usage_delta: number;
  whiff_delta: number | null;
  is_new: boolean;
  is_dropped: boolean;
}

export interface SpringDelta {
  pitcher_id: number;
  pitcher_name: string;
  pitcher_hand: string;
  pitcher_team: string;
  team_2025: string;
  spring_pitch_plus: number;
  spring_n_pitches: number;
  baseline_pitch_plus: number;
  baseline_n_pitches: number;
  pitch_plus_delta: number;
  dimension_deltas: Record<string, number>;
  spring_dimensions: Record<string, { score: number; grade: string }>;
  baseline_dimensions: Record<string, { score: number; grade: string }>;
  pitch_type_deltas: PitchTypeDelta[];
}

// ─── Compute ─────────────────────────────────────────────────────────────────

export function computeSpringDeltas(
  springData: PitchersData,
  baselineData: PitchersData,
  springPitchTypes: PitchTypesData | null,
  baselinePitchTypes: PitchTypesData | null,
): SpringDelta[] {
  // Index baseline pitchers by ID
  const baselineMap = new Map<number, Pitcher>();
  for (const p of baselineData.pitchers) {
    baselineMap.set(p.pitcher_id, p);
  }

  const deltas: SpringDelta[] = [];
  const seenIds = new Set<number>();

  for (const sp of springData.pitchers) {
    if (seenIds.has(sp.pitcher_id)) continue; // Source data has duplicate pitcher_ids (e.g., mid-spring trades); first occurrence wins
    const bp = baselineMap.get(sp.pitcher_id);
    if (!bp) continue; // No 2025 baseline for this pitcher
    seenIds.add(sp.pitcher_id);

    // Dimension deltas
    const dimDeltas: Record<string, number> = {};
    const dimKeys: DimensionKey[] = ['stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal'];
    for (const dk of dimKeys) {
      const ss = sp.dimensions[dk]?.score ?? 100;
      const bs = bp.dimensions[dk]?.score ?? 100;
      dimDeltas[dk] = Math.round(ss - bs);
    }

    // Pitch type deltas
    const ptDeltas: PitchTypeDelta[] = [];
    if (springPitchTypes && baselinePitchTypes) {
      const sTypes = springPitchTypes.pitchers[String(sp.pitcher_id)] ?? [];
      const bTypes = baselinePitchTypes.pitchers[String(sp.pitcher_id)] ?? [];
      const bMap = new Map(bTypes.map(t => [t.pitch_type, t]));
      const sMap = new Map(sTypes.map(t => [t.pitch_type, t]));

      // Spring pitches (may be new or existing)
      for (const st of sTypes) {
        const bt = bMap.get(st.pitch_type);
        ptDeltas.push({
          pitch_type: st.pitch_type,
          pitch_name: st.pitch_name,
          spring_velo: st.velo,
          spring_spin: st.spin,
          spring_ivb: st.ivb,
          spring_hb: st.hb,
          spring_usage: st.usage_pct,
          spring_whiff: st.whiff_rate,
          baseline_velo: bt?.velo ?? null,
          baseline_spin: bt?.spin ?? null,
          baseline_ivb: bt?.ivb ?? null,
          baseline_hb: bt?.hb ?? null,
          baseline_usage: bt?.usage_pct ?? 0,
          baseline_whiff: bt?.whiff_rate ?? null,
          velo_delta: st.velo != null && bt?.velo != null ? +(st.velo - bt.velo).toFixed(1) : null,
          spin_delta: st.spin != null && bt?.spin != null ? Math.round(st.spin - bt.spin) : null,
          ivb_delta: st.ivb != null && bt?.ivb != null ? +(st.ivb - bt.ivb).toFixed(1) : null,
          hb_delta: st.hb != null && bt?.hb != null ? +(st.hb - bt.hb).toFixed(1) : null,
          usage_delta: +((st.usage_pct ?? 0) - (bt?.usage_pct ?? 0)).toFixed(3),
          whiff_delta: st.whiff_rate != null && bt?.whiff_rate != null ? +(st.whiff_rate - bt.whiff_rate).toFixed(3) : null,
          is_new: !bt,
          is_dropped: false,
        });
      }

      // Dropped pitches (in 2025 but not spring)
      for (const bt of bTypes) {
        if (!sMap.has(bt.pitch_type)) {
          ptDeltas.push({
            pitch_type: bt.pitch_type,
            pitch_name: bt.pitch_name,
            spring_velo: null, spring_spin: null, spring_ivb: null, spring_hb: null,
            spring_usage: 0, spring_whiff: null,
            baseline_velo: bt.velo, baseline_spin: bt.spin, baseline_ivb: bt.ivb, baseline_hb: bt.hb,
            baseline_usage: bt.usage_pct, baseline_whiff: bt.whiff_rate,
            velo_delta: null, spin_delta: null, ivb_delta: null, hb_delta: null,
            usage_delta: -(bt.usage_pct ?? 0), whiff_delta: null,
            is_new: false, is_dropped: true,
          });
        }
      }
    }

    deltas.push({
      pitcher_id: sp.pitcher_id,
      pitcher_name: sp.pitcher_name,
      pitcher_hand: sp.pitcher_hand,
      pitcher_team: sp.pitcher_team,
      team_2025: bp.pitcher_team,
      spring_pitch_plus: sp.pitch_plus,
      spring_n_pitches: sp.n_pitches,
      baseline_pitch_plus: bp.pitch_plus,
      baseline_n_pitches: bp.n_pitches,
      pitch_plus_delta: sp.pitch_plus - bp.pitch_plus,
      dimension_deltas: dimDeltas,
      spring_dimensions: sp.dimensions,
      baseline_dimensions: bp.dimensions,
      pitch_type_deltas: ptDeltas,
    });
  }

  return deltas;
}
