/**
 * PitcherPlots.tsx — Interactive Pitcher Visualization Hub
 *
 * Route: /plots
 * Lets users explore pitch movement, location, velocity, and heatmaps
 * for any pitcher and season, with optional game and pitch-type filtering.
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data/useData';
import { usePitchData } from '../data/usePitchData';
import { useScoringConfig } from '../data/useScoringConfig';
import { computePitchTypeGrades } from '../data/computePitchTypeGrades';
import { MovementProfileChart } from '../components/MovementProfileChart';
import { PitchLocationChart } from '../components/PitchLocationChart';
import { VelocityDistribution } from '../components/VelocityDistribution';
import { PitchHeatmap } from '../components/PitchHeatmap';
import { pitchColor } from '../data/constants';
import { InlineSearch } from '../components/InlineSearch';
import type { Pitcher, RawPitch } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PITCH_NAMES: Record<string, string> = {
  FF: 'Four-Seam', SI: 'Sinker', FC: 'Cutter',
  SL: 'Slider', ST: 'Sweeper', SV: 'Slurve',
  CU: 'Curveball', KC: 'Knuckle-Curve',
  CH: 'Changeup', FS: 'Split',
};

function pName(pt: string) { return PITCH_NAMES[pt] ?? pt; }


// ── Pitch type toggle bar ──────────────────────────────────────────────────────

function PitchTypeFilter({
  types,
  selected,
  onChange,
}: {
  types: string[];
  selected: Set<string>;
  onChange: (t: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {types.map((pt) => {
        const active = selected.has(pt);
        const color = pitchColor(pt);
        return (
          <button
            key={pt}
            onClick={() => onChange(pt)}
            style={{
              padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${active ? color : '#2a2a3e'}`,
              background: active ? color + '25' : 'transparent',
              color: active ? color : '#606080',
              cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400,
              fontFamily: 'var(--sans)',
            }}
          >
            {pName(pt)}
          </button>
        );
      })}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{ color: '#4a9eff', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function PitcherPlots() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, season } = useData();
  const pitchers = data?.pitchers?.pitchers ?? [];

  const initialId = searchParams.get('pitcher') ? Number(searchParams.get('pitcher')) : null;
  const [selectedId, setSelectedId] = useState<number | null>(initialId);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  const { loadForPitcher, pitches: allPitches, games, loading, error } = usePitchData(season);
  const { config: scoringConfig } = useScoringConfig();

  useEffect(() => {
    if (selectedId) {
      loadForPitcher(selectedId);
      setSearchParams({ pitcher: String(selectedId) }, { replace: true });
    }
  }, [selectedId, loadForPitcher]);

  const selectedPitcher = useMemo(
    () => pitchers.find((p) => p.pitcher_id === selectedId) ?? null,
    [pitchers, selectedId],
  );

  // Unique pitch types in data
  const pitchTypes = useMemo(() => {
    if (!allPitches) return [];
    return Array.from(new Set(allPitches.map((p) => p.pt))).sort();
  }, [allPitches]);

  const [selectedPitchTypes, setSelectedPitchTypes] = useState<Set<string>>(new Set());

  // Reset pitch type filter when pitcher changes
  useEffect(() => {
    if (pitchTypes.length > 0) setSelectedPitchTypes(new Set(pitchTypes));
  }, [pitchTypes.join(',')]);

  function togglePitchType(pt: string) {
    setSelectedPitchTypes((prev) => {
      const next = new Set(prev);
      if (next.has(pt)) { if (next.size > 1) next.delete(pt); }
      else next.add(pt);
      return next;
    });
  }

  // Unique games
  const gameList = useMemo(() => {
    if (!allPitches) return [];
    const byGame = new Map<number, string>();
    allPitches.forEach((p) => {
      if (!byGame.has(p.gid)) byGame.set(p.gid, p.gd ?? String(p.gid));
    });
    return Array.from(byGame.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allPitches]);

  // Filtered pitches
  const filteredPitches = useMemo<RawPitch[]>(() => {
    if (!allPitches) return [];
    return allPitches.filter((p) => {
      if (selectedGameId !== null && p.gid !== selectedGameId) return false;
      if (!selectedPitchTypes.has(p.pt)) return false;
      return true;
    });
  }, [allPitches, selectedGameId, selectedPitchTypes]);

  // Pitch type data for movement chart — must conform to PitchType interface
  const pitchTypeSummary = useMemo(() => {
    const byType = new Map<string, { n: number; ivbs: number[]; hbs: number[]; spins: number[]; velos: number[]; whiffs: number; swings: number }>();
    for (const p of filteredPitches) {
      if (!byType.has(p.pt)) byType.set(p.pt, { n: 0, ivbs: [], hbs: [], spins: [], velos: [], whiffs: 0, swings: 0 });
      const r = byType.get(p.pt)!;
      r.n++;
      if (p.ivb != null) r.ivbs.push(p.ivb);
      if (p.hb != null) r.hbs.push(p.hb);
      if (p.sp > 0) r.spins.push(p.sp);
      if (p.v > 0) r.velos.push(p.v);
      if (p.sw) { r.swings++; if (p.wh) r.whiffs++; }
    }
    const total = filteredPitches.length || 1;
    return Array.from(byType.entries()).map(([pt, r]) => {
      const avgVelo = r.velos.length ? r.velos.reduce((a, b) => a + b) / r.velos.length : 0;
      return {
        pitch_type: pt,
        pitch_name: pName(pt),
        n: r.n,
        usage_pct: r.n / total,
        ivb:       r.ivbs.length  ? r.ivbs.reduce((a, b) => a + b)  / r.ivbs.length  : 0,
        hb:        r.hbs.length   ? r.hbs.reduce((a, b) => a + b)   / r.hbs.length   : 0,
        spin:      r.spins.length ? r.spins.reduce((a, b) => a + b) / r.spins.length : 0,
        velo:      avgVelo,
        perc_velo: avgVelo,
        ext:       0,
        whiff_rate: r.swings > 0 ? r.whiffs / r.swings : 0,
      };
    });
  }, [filteredPitches]);

  const pitchTypeGrades = useMemo(() => {
    if (filteredPitches.length === 0 || !scoringConfig) return [];
    return computePitchTypeGrades(filteredPitches, scoringConfig.league_averages, PITCH_NAMES);
  }, [filteredPitches, scoringConfig]);

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e0e0e8', margin: '0 0 4px 0' }}>
          Pitcher Plots
        </h1>
        <p style={{ color: '#606080', fontSize: 13, margin: 0 }}>
          Pitch movement, location, velocity, and heatmap visualizations for any pitcher.
        </p>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Pitcher search */}
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ color: '#606080', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Pitcher
            </div>
            <InlineSearch<Pitcher>
              items={pitchers}
              getKey={p => p.pitcher_id}
              getLabel={p => p.pitcher_name}
              value={selectedPitcher}
              onSelect={(p) => { setSelectedId(p.pitcher_id); setSelectedGameId(null); }}
              placeholder="Search pitcher…"
              maxResults={8}
              renderItem={(p) => (
                <span>
                  {p.pitcher_name}
                  <span style={{ color: '#606080', fontSize: 12, marginLeft: 8 }}>
                    {p.pitcher_team} · {p.pitcher_hand}HP
                  </span>
                </span>
              )}
            />
          </div>

          {/* Game filter */}
          {gameList.length > 0 && (
            <div style={{ flex: '0 1 220px' }}>
              <div style={{ color: '#606080', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Game (optional)
              </div>
              <select
                value={selectedGameId ?? ''}
                onChange={(e) => setSelectedGameId(e.target.value ? Number(e.target.value) : null)}
                style={{
                  width: '100%',
                  background: '#1a1a2e', border: '1px solid #2a2a3e',
                  color: '#e0e0e8', borderRadius: 6, padding: '8px 12px', fontSize: 13,
                }}
              >
                <option value="">All games</option>
                {gameList.map(([gid, date]) => {
                  const info = games[String(gid)];
                  const label = info ? `${date} vs ${info.away === selectedPitcher?.pitcher_team ? info.home : info.away}` : date;
                  return <option key={gid} value={gid}>{label}</option>;
                })}
              </select>
            </div>
          )}
        </div>

        {/* Pitch type filter */}
        {pitchTypes.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: '#606080', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Pitch Types
            </div>
            <PitchTypeFilter
              types={pitchTypes}
              selected={selectedPitchTypes}
              onChange={togglePitchType}
            />
          </div>
        )}

        {/* Pitch count */}
        {filteredPitches.length > 0 && (
          <div style={{ color: '#606080', fontSize: 12, marginTop: 4 }}>
            {filteredPitches.length.toLocaleString()} pitches
            {selectedGameId ? ' (this game)' : ` (${season} season)`}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!selectedId && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#606080' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚾</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#a0a0b8', marginBottom: 6 }}>
            Select a pitcher to view plots
          </div>
          <div style={{ fontSize: 13 }}>Search for any MLB pitcher using the field above.</div>
        </div>
      )}

      {/* Loading */}
      {selectedId && loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#606080', fontSize: 14 }}>
          Loading pitch data…
        </div>
      )}

      {/* Error */}
      {selectedId && error && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#ef4444', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Charts */}
      {selectedId && !loading && filteredPitches.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 16 }}>

          <Section title="Movement Profile (iVB vs HB)">
            <MovementProfileChart
              pitches={filteredPitches}
              grades={pitchTypeGrades}
              pitchTypeNames={PITCH_NAMES}
              width={480}
              height={360}
            />
          </Section>

          <Section title="Pitch Location (Catcher's View)">
            <PitchLocationChart pitches={filteredPitches} height={320} pitchTypeNames={PITCH_NAMES} />
          </Section>

          <Section title="Velocity Distribution">
            <VelocityDistribution pitches={filteredPitches} pitchTypeNames={PITCH_NAMES} />
          </Section>

          <Section title="Zone Heatmap">
            <PitchHeatmap pitches={filteredPitches} />
          </Section>

          {/* Pitch mix summary */}
          <Section title="Pitch Mix Summary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...pitchTypeSummary].sort((a, b) => b.usage_pct - a.usage_pct).map((pt) => {
                const color = pitchColor(pt.pitch_type);
                return (
                  <div key={pt.pitch_type} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: '#e0e0e8', fontSize: 13 }}>{pt.pitch_name}</span>
                        <span style={{ color: '#a0a0b8', fontSize: 12 }}>
                          {(pt.usage_pct * 100).toFixed(1)}% · {pt.velo.toFixed(1)} mph ·{' '}
                          iVB {pt.ivb.toFixed(1)}" · HB {pt.hb.toFixed(1)}"
                        </span>
                      </div>
                      <div style={{ height: 4, background: '#1e1e2e', borderRadius: 2 }}>
                        <div style={{ width: `${pt.usage_pct * 100}%`, height: 4, background: color, borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
