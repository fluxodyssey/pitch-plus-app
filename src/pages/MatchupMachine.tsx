/**
 * MatchupMachine.tsx — Pitcher vs Batter Matchup Projections
 *
 * Route: /matchup or /matchup/:pitcherId/:batterId
 *
 * Uses pitcher similarity + batter outcomes + regression engine to project
 * what will happen when a specific batter faces a specific pitcher.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData, hasMatchupData, MATCHUP_DEFAULT_SEASON } from '../data/useData';
import { useSimilarityData, useBatterOutcomes } from '../data/useMatchupData';
import { projectMatchup } from '../data/matchupEngine';
import { InlineSearch } from '../components/InlineSearch';
import type { MatchupProjection } from '../types';

interface SearchItem { id: number; name: string; team: string; sub?: string }

// ── Grade badge ───────────────────────────────────────────────────────────────

function GradeBadgeLarge({ grade, label }: { grade: number; label: string }) {
  const color =
    grade >= 5  ? '#10b981' :
    grade >= 2  ? '#34d399' :
    grade >= -1 ? '#a0a0b8' :
    grade >= -4 ? '#f59e0b' :
    '#ef4444';

  return (
    <div style={{
      background: color + '18',
      border: `2px solid ${color}`,
      borderRadius: 12,
      padding: '16px 28px',
      textAlign: 'center',
      minWidth: 100,
    }}>
      <div style={{ color, fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{label}</div>
      <div style={{ color: '#606080', fontSize: 12, marginTop: 4 }}>
        {grade > 0 ? `+${grade}` : grade} / 10
      </div>
    </div>
  );
}

// ── Outcome table ─────────────────────────────────────────────────────────────

function pct(v: number | undefined | null, digits = 1): string {
  if (v == null || isNaN(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

function deltaColor(v: number, higherBetter = true): string {
  const good = higherBetter ? v > 0.02 : v < -0.02;
  const bad  = higherBetter ? v < -0.02 : v > 0.02;
  if (good) return '#10b981';
  if (bad)  return '#ef4444';
  return '#a0a0b8';
}

function DeltaCell({ v, higherBetter = false }: { v: number | undefined; higherBetter?: boolean }) {
  if (v == null) return <td style={{ padding: '7px 10px', color: '#606080', textAlign: 'center' }}>—</td>;
  const sign = v > 0 ? '+' : '';
  const color = deltaColor(v, higherBetter);
  return (
    <td style={{ padding: '7px 10px', color, fontWeight: 600, textAlign: 'center', fontSize: 13 }}>
      {sign}{pct(v)}
    </td>
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ conf }: { conf: 'high' | 'medium' | 'low' }) {
  const colors = { high: '#10b981', medium: '#f59e0b', low: '#ef4444' };
  const color = colors[conf];
  return (
    <span style={{
      background: color + '18', border: `1px solid ${color}44`,
      color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: 0.8,
    }}>
      {conf} confidence
    </span>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────

function PlayerCard({
  name, team, hand, role, pitchPlus, label, color,
}: {
  name: string; team: string; hand: string; role?: string;
  pitchPlus?: number; label: string; color: string;
}) {
  return (
    <div style={{
      background: color + '08', border: `1px solid ${color}30`,
      borderRadius: 10, padding: '16px 20px', flex: '1 1 240px',
    }}>
      <div style={{ color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color: '#e0e0e8', fontSize: 20, fontWeight: 700 }}>{name}</div>
      <div style={{ color: '#606080', fontSize: 13, marginTop: 2 }}>
        {team} · {hand}HB{role ? ` · ${role}` : ''}
      </div>
      {pitchPlus != null && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#4a9eff', fontSize: 22, fontWeight: 700 }}>{pitchPlus}</span>
          <span style={{ color: '#606080', fontSize: 12 }}>Pitch+</span>
        </div>
      )}
    </div>
  );
}

// ── Season gate ──────────────────────────────────────────────────────────────

function MatchupSeasonGate({ currentSeason, onSwitch }: { currentSeason: number; onSwitch: () => void }) {
  return (
    <div style={{ padding: '24px', maxWidth: 640, margin: '60px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚾</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 12px 0' }}>
        Matchup Machine — {MATCHUP_DEFAULT_SEASON} only
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px 0' }}>
        Matchup projections are only available for the {MATCHUP_DEFAULT_SEASON} season right now —
        you're currently viewing <strong style={{ color: 'var(--text-2)' }}>{currentSeason}</strong>.
        Switch seasons to use the Matchup Machine.
      </p>
      <button
        onClick={onSwitch}
        style={{
          background: 'var(--accent)', border: 'none', color: '#fff',
          borderRadius: 'var(--radius-sm)', padding: '10px 18px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)',
        }}
      >
        Switch to {MATCHUP_DEFAULT_SEASON}
      </button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function MatchupMachine() {
  const { season, setSeason } = useData();
  if (!hasMatchupData(season)) {
    return <MatchupSeasonGate currentSeason={season} onSwitch={() => setSeason(MATCHUP_DEFAULT_SEASON)} />;
  }
  return <MatchupMachineInner />;
}

function MatchupMachineInner() {
  const { pitcherId: paramPitcherId, batterId: paramBatterId } = useParams<{ pitcherId?: string; batterId?: string }>();
  const navigate = useNavigate();
  const { data, season } = useData();

  const pitchers = useMemo(() => data?.pitchers?.pitchers ?? [], [data]);

  const { data: similarityData, loading: simLoading, error: simError } = useSimilarityData(season);
  const { data: batterOutcomes, loading: boLoading, error: boError } = useBatterOutcomes(season);

  const [selectedPitcherId, setSelectedPitcherId] = useState<number | null>(
    paramPitcherId ? Number(paramPitcherId) : null
  );
  const [selectedBatterId, setSelectedBatterId] = useState<number | null>(
    paramBatterId ? Number(paramBatterId) : null
  );

  // Build batter list from batter_outcomes
  const batterItems = useMemo<SearchItem[]>(() => {
    if (!batterOutcomes) return [];
    return Object.entries(batterOutcomes)
      .map(([id, b]) => ({
        id: Number(id),
        name: b.name,
        team: b.team,
        sub: `${b.team} · ${b.hand}HB · ${b.overall?.n_pa ?? 0} PA`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [batterOutcomes]);

  const pitcherItems = useMemo<SearchItem[]>(() =>
    pitchers.map((p) => ({
      id: p.pitcher_id,
      name: p.pitcher_name,
      team: p.pitcher_team,
      sub: `${p.pitcher_team} · ${p.pitcher_hand}HP · ${p.pitch_plus} Pitch+`,
    })),
    [pitchers]
  );

  const selectedPitcher = pitchers.find((p) => p.pitcher_id === selectedPitcherId) ?? null;
  const selectedBatter  = batterOutcomes?.[String(selectedBatterId)] ?? null;

  // Run projection
  const projection = useMemo<MatchupProjection | null>(() => {
    if (!similarityData || !batterOutcomes || !selectedPitcherId || !selectedBatterId) return null;
    return projectMatchup(selectedPitcherId, selectedBatterId, similarityData, batterOutcomes);
  }, [similarityData, batterOutcomes, selectedPitcherId, selectedBatterId]);

  // Update URL
  useEffect(() => {
    if (selectedPitcherId && selectedBatterId) {
      navigate(`/matchup/${selectedPitcherId}/${selectedBatterId}`, { replace: true });
    }
  }, [selectedPitcherId, selectedBatterId, navigate]);

  const dataLoading = simLoading || boLoading;
  const dataError   = simError ?? boError;

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e0e0e8', margin: '0 0 6px 0' }}>
          Matchup Machine
        </h1>
        <p style={{ color: '#606080', fontSize: 13, margin: 0 }}>
          Project batter outcomes using pitcher similarity regression.
          Select any MLB pitcher and batter to generate a matchup grade.
        </p>
      </div>

      {/* Selectors */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'end' }}>
          <div>
            <div style={{ color: '#606080', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Batter
            </div>
            <InlineSearch<SearchItem>
              items={batterItems}
              getKey={i => i.id}
              getLabel={i => i.name}
              value={selectedBatterId && selectedBatter ? { id: selectedBatterId, name: selectedBatter.name, team: selectedBatter.team } : null}
              onSelect={(item) => setSelectedBatterId(item.id)}
              placeholder="Search batter…"
              renderItem={(item) => (
                <span>{item.name}<span style={{ color: '#606080', fontSize: 12, marginLeft: 8 }}>{item.sub ?? item.team}</span></span>
              )}
            />
          </div>

          {/* Swap button */}
          <div style={{ paddingBottom: 2 }}>
            <button
              onClick={() => { const prevP = selectedPitcherId; const prevB = selectedBatterId; setSelectedPitcherId(prevB); setSelectedBatterId(prevP); }}
              title="Swap batter and pitcher"
              style={{
                background: '#1e1e2e', border: '1px solid #2a2a3e',
                color: '#a0a0b8', borderRadius: 8, padding: '9px 14px',
                cursor: 'pointer', fontSize: 18, lineHeight: 1,
              }}
            >⇄</button>
          </div>

          <div>
            <div style={{ color: '#606080', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Pitcher
            </div>
            <InlineSearch<SearchItem>
              items={pitcherItems}
              getKey={i => i.id}
              getLabel={i => i.name}
              value={selectedPitcherId && selectedPitcher ? { id: selectedPitcherId, name: selectedPitcher.pitcher_name, team: selectedPitcher.pitcher_team } : null}
              onSelect={(item) => setSelectedPitcherId(item.id)}
              placeholder="Search pitcher…"
              renderItem={(item) => (
                <span>{item.name}<span style={{ color: '#606080', fontSize: 12, marginLeft: 8 }}>{item.sub ?? item.team}</span></span>
              )}
            />
          </div>
        </div>
      </div>

      {/* Data loading state */}
      {dataLoading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#606080', fontSize: 14 }}>
          Loading matchup data…
        </div>
      )}

      {dataError && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ color: '#ef4444', fontSize: 14, marginBottom: 8 }}>
            Matchup data not yet available for {season}.
          </div>
          <div style={{ color: '#606080', fontSize: 13 }}>
            Run <code style={{ color: '#4a9eff' }}>python models/pitcher_similarity.py {season}</code> and{' '}
            <code style={{ color: '#4a9eff' }}>python models/batter_outcomes.py --year {season}</code> to generate it.
          </div>
        </div>
      )}

      {/* Empty state */}
      {!dataLoading && !dataError && (!selectedPitcherId || !selectedBatterId) && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#606080' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚾</div>
          <div style={{ fontSize: 16, color: '#a0a0b8', marginBottom: 8 }}>
            Select a batter and pitcher to generate a matchup projection
          </div>
          <div style={{ fontSize: 13 }}>
            The engine uses pitcher similarity regression to project outcomes.
          </div>
        </div>
      )}

      {/* Projection results */}
      {projection && selectedPitcher && selectedBatter && (
        <div>
          {/* Player cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <PlayerCard
              label="Batter"
              name={selectedBatter.name}
              team={selectedBatter.team}
              hand={selectedBatter.hand}
              color="#4a9eff"
            />
            <PlayerCard
              label="Pitcher"
              name={selectedPitcher.pitcher_name}
              team={selectedPitcher.pitcher_team}
              hand={selectedPitcher.pitcher_hand}
              pitchPlus={selectedPitcher.pitch_plus}
              color="#c85a5a"
            />
          </div>

          {/* Matchup grade */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <GradeBadgeLarge grade={projection.grade} label={projection.grade_label} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ color: '#e0e0e8', fontSize: 18, fontWeight: 600 }}>
                    {projection.leans === 'batter'
                      ? `Favors ${selectedBatter.name}`
                      : projection.leans === 'pitcher'
                      ? `Favors ${selectedPitcher.pitcher_name}`
                      : 'Even matchup'}
                  </span>
                  <ConfidenceBadge conf={projection.confidence} />
                </div>
                <div style={{ color: '#a0a0b8', fontSize: 14, lineHeight: 1.6 }}>
                  Projected xwOBA{' '}
                  <span style={{ color: '#e0e0e8', fontWeight: 700 }}>
                    {projection.outcomes.xwoba.toFixed(3)}
                  </span>
                  {' '}vs league average 0.320.
                  {' '}{selectedBatter.name} projects to reach base{' '}
                  <span style={{ color: '#e0e0e8', fontWeight: 700 }}>
                    {pct(projection.outcomes.reach_pct)}
                  </span>
                  {' '}of at-bats.
                  {projection.n_similar_with_data > 0
                    ? ` Based on outcomes vs ${projection.n_similar_with_data} similar pitchers.`
                    : ' Using batter vs-hand splits (no direct matchup data).'}
                </div>
              </div>
              {projection.outcomes.wrc_plus_proj != null && (
                <div style={{ textAlign: 'center', padding: '8px 16px', background: '#1e1e2e', borderRadius: 8 }}>
                  <div style={{ color: '#606080', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Proj. wRC+
                  </div>
                  <div style={{ color: '#e0e0e8', fontSize: 28, fontWeight: 700 }}>
                    {projection.outcomes.wrc_plus_proj}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Outcome table */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ color: '#4a9eff', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
              Projected Outcomes
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1e1e2e' }}>
                    {['', 'Reach Base', 'Hit', 'HR', '2B/3B', '1B', 'BB', 'K', 'xwOBA'].map((h, i) => (
                      <th key={h || `col-${i}`} style={{
                        padding: '7px 10px', textAlign: i === 0 ? 'left' : 'center',
                        color: '#606080', fontWeight: 600, fontSize: 11,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Projection row */}
                  <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                    <td style={{ padding: '7px 10px', color: '#e0e0e8', fontWeight: 600 }}>Projection</td>
                    {([
                      ['reach', projection.outcomes.reach_pct],
                      ['hit', projection.outcomes.hit_pct],
                      ['hr', projection.outcomes.hr_pct],
                      ['xbh', projection.outcomes.double_triple_pct],
                      ['1b', projection.outcomes.single_pct],
                      ['bb', projection.outcomes.bb_pct],
                      ['k', projection.outcomes.k_pct],
                    ] as const).map(([label, v]) => (
                      <td key={label} style={{ padding: '7px 10px', color: '#e0e0e8', textAlign: 'center', fontWeight: 600 }}>
                        {pct(v)}
                      </td>
                    ))}
                    <td style={{ padding: '7px 10px', color: '#e0e0e8', textAlign: 'center', fontWeight: 700 }}>
                      {projection.outcomes.xwoba.toFixed(3)}
                    </td>
                  </tr>

                  {/* Batter delta row */}
                  <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                    <td style={{ padding: '7px 10px', color: '#4a9eff', fontSize: 12 }}>vs. batter avg</td>
                    <DeltaCell v={projection.deltas.from_batter_avg.reach_pct} higherBetter />
                    <DeltaCell v={undefined} />
                    <DeltaCell v={projection.deltas.from_batter_avg.hr_pct} higherBetter />
                    <DeltaCell v={undefined} />
                    <DeltaCell v={undefined} />
                    <DeltaCell v={projection.deltas.from_batter_avg.bb_pct} higherBetter />
                    <DeltaCell v={projection.deltas.from_batter_avg.k_pct} higherBetter={false} />
                    <td style={{ padding: '7px 10px', color: deltaColor(projection.deltas.from_batter_avg.xwoba ?? 0, true), textAlign: 'center', fontWeight: 600, fontSize: 13 }}>
                      {projection.deltas.from_batter_avg.xwoba != null
                        ? `${projection.deltas.from_batter_avg.xwoba > 0 ? '+' : ''}${projection.deltas.from_batter_avg.xwoba.toFixed(3)}`
                        : '—'}
                    </td>
                  </tr>

                  {/* Batter season row */}
                  <tr>
                    <td style={{ padding: '7px 10px', color: '#606080', fontSize: 12 }}>Batter season avg</td>
                    {[
                      (selectedBatter.overall?.single_pct ?? 0) + (selectedBatter.overall?.double_pct ?? 0) +
                      (selectedBatter.overall?.triple_pct ?? 0) + (selectedBatter.overall?.hr_pct ?? 0) +
                      (selectedBatter.overall?.bb_pct ?? 0),
                      (selectedBatter.overall?.single_pct ?? 0) + (selectedBatter.overall?.double_pct ?? 0) +
                      (selectedBatter.overall?.triple_pct ?? 0) + (selectedBatter.overall?.hr_pct ?? 0),
                      selectedBatter.overall?.hr_pct,
                      (selectedBatter.overall?.double_pct ?? 0) + (selectedBatter.overall?.triple_pct ?? 0),
                      selectedBatter.overall?.single_pct,
                      selectedBatter.overall?.bb_pct,
                      selectedBatter.overall?.k_pct,
                    ].map((v, i) => (
                      <td key={i} style={{ padding: '7px 10px', color: '#606080', textAlign: 'center', fontSize: 12 }}>
                        {pct(v)}
                      </td>
                    ))}
                    <td style={{ padding: '7px 10px', color: '#606080', textAlign: 'center', fontSize: 12 }}>
                      {selectedBatter.overall?.xwoba?.toFixed(3) ?? '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Advanced metrics */}
          {(projection.outcomes.hard_hit_rate != null || projection.outcomes.gb_rate != null) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ color: '#4a9eff', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                Advanced Metrics
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Hard Hit%', v: projection.outcomes.hard_hit_rate },
                  { label: 'GB%', v: projection.outcomes.gb_rate },
                  { label: 'FB%', v: projection.outcomes.fb_rate },
                  { label: 'Barrel%', v: projection.outcomes.barrel_rate },
                ].filter(({ v }) => v != null).map(({ label, v }) => (
                  <div key={label} style={{ textAlign: 'center', background: '#1a1a2e', borderRadius: 8, padding: '10px 8px' }}>
                    <div style={{ color: '#606080', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
                    <div style={{ color: '#e0e0e8', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{pct(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Methodology note */}
          <div style={{ color: '#404060', fontSize: 12, lineHeight: 1.6, borderTop: '1px solid #1a1a2e', paddingTop: 12 }}>
            <strong style={{ color: '#606080' }}>Methodology:</strong> Outcomes are weighted by pitcher similarity score,
            then regressed toward the batter's season average using a Marcel-style regression (k=20 PA).
            Similarity data must be generated by <code style={{ color: '#4a9eff' }}>pitcher_similarity.py</code>.
            Confidence reflects the amount of observed data vs similar pitchers.
          </div>
        </div>
      )}

      {/* No projection but both selected */}
      {!projection && selectedPitcherId && selectedBatterId && !dataLoading && !dataError && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#606080' }}>
          <div style={{ fontSize: 16, color: '#a0a0b8', marginBottom: 8 }}>
            Could not generate projection
          </div>
          <div style={{ fontSize: 13 }}>
            Similarity or batter outcomes data may not be available for this season.
            Run the Python pipeline to generate it.
          </div>
        </div>
      )}
    </div>
  );
}
