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
import { useSimilarityData, useBatterOutcomes, useDailySlate, useHrSlate } from '../data/useMatchupData';
import { projectMatchup } from '../data/matchupEngine';
import { InlineSearch } from '../components/InlineSearch';
import { MatchupBreakdown } from '../components/MatchupBreakdown';
import type { BreakdownTarget } from '../components/MatchupBreakdown';
import type {
  BatterOutcomesData, DailyMatchupGame, DailyMatchupsDoc, HrSlateDoc, MatchupProjection, SimilarityData,
} from '../types';

interface SearchItem { id: number; name: string; team: string; sub?: string }

// ── Grade badge ───────────────────────────────────────────────────────────────

function GradeBadgeLarge({ grade, label }: { grade: number; label: string }) {
  const color =
    grade >= 5  ? '#10b981' :
    grade >= 2  ? '#34d399' :
    grade >= -1 ? 'var(--text-2)' :
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
      <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>
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
  return 'var(--text-2)';
}

function DeltaCell({ v, higherBetter = false }: { v: number | undefined; higherBetter?: boolean }) {
  if (v == null) return <td style={{ padding: '7px 10px', color: 'var(--text-3)', textAlign: 'center' }}>—</td>;
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
      <div style={{ color: 'var(--text-1)', fontSize: 20, fontWeight: 700 }}>{name}</div>
      <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>
        {team} · {hand}HB{role ? ` · ${role}` : ''}
      </div>
      {pitchPlus != null && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#4b96e6', fontSize: 22, fontWeight: 700 }}>{pitchPlus}</span>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Pitch+</span>
        </div>
      )}
    </div>
  );
}

// ── Best matchups today ───────────────────────────────────────────────────────

interface SlateRow {
  game: DailyMatchupGame;
  pitcherId: number;
  pitcherName: string;
  pitcherTeam: string;
  batterId: number;
  batterName: string;
  batterTeam: string;
  proj: MatchupProjection;
}

const SLATE_TOP_N = 15;
const SLATE_HITTERS_PER_TEAM = 9;   // ~starting lineup, by season PA
const SLATE_MIN_PA = 100;

function buildSlateRows(
  slate: DailyMatchupsDoc,
  similarityData: SimilarityData,
  batterOutcomes: BatterOutcomesData,
): SlateRow[] {
  // team → hitters by season PA (proxy for the starting lineup pre-posting)
  const byTeam = new Map<string, Array<{ id: number; name: string; nPa: number }>>();
  for (const [id, b] of Object.entries(batterOutcomes)) {
    const nPa = b.overall?.n_pa ?? 0;
    if (!b.team || nPa < SLATE_MIN_PA) continue;
    const arr = byTeam.get(b.team) ?? [];
    arr.push({ id: Number(id), name: b.name, nPa });
    byTeam.set(b.team, arr);
  }
  for (const arr of byTeam.values()) arr.sort((a, b) => b.nPa - a.nPa);

  const rows: SlateRow[] = [];
  for (const game of slate.games) {
    for (const [pitSide, batSide] of [['away', 'home'], ['home', 'away']] as const) {
      const prob = game[pitSide].probable;
      if (!prob) continue;
      const hitters = (byTeam.get(game[batSide].team) ?? []).slice(0, SLATE_HITTERS_PER_TEAM);
      for (const h of hitters) {
        const proj = projectMatchup(prob.id, h.id, similarityData, batterOutcomes);
        if (!proj) continue;
        rows.push({
          game,
          pitcherId: prob.id, pitcherName: prob.name, pitcherTeam: game[pitSide].team,
          batterId: h.id, batterName: h.name, batterTeam: game[batSide].team,
          proj,
        });
      }
    }
  }
  // best matchups FOR THE HITTER: highest batter-advantage grade first
  rows.sort((a, b) =>
    b.proj.grade - a.proj.grade
    || (b.proj.deltas.from_batter_avg.xwoba ?? 0) - (a.proj.deltas.from_batter_avg.xwoba ?? 0));
  return rows.slice(0, SLATE_TOP_N);
}

function gameTimeLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function BestMatchupsToday({
  slate, similarityData, batterOutcomes,
}: {
  slate: DailyMatchupsDoc;
  similarityData: SimilarityData;
  batterOutcomes: BatterOutcomesData;
}) {
  const [breakdown, setBreakdown] = useState<BreakdownTarget | null>(null);
  const rows = useMemo(
    () => buildSlateRows(slate, similarityData, batterOutcomes),
    [slate, similarityData, batterOutcomes],
  );

  const stale = slate.date < localToday();  // future-dated slate is fine, not stale
  const nProbables = slate.games.reduce(
    (s, g) => s + (g.away.probable ? 1 : 0) + (g.home.probable ? 1 : 0), 0);

  if (slate.games.length === 0) {
    return (
      <div className="card" style={{ color: 'var(--text-3)', fontSize: 13 }}>
        No games on the {slate.date} slate.
      </div>
    );
  }

  const th = {
    padding: '7px 10px', color: 'var(--text-3)', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, whiteSpace: 'nowrap' as const,
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: 16 }}>
          Best Matchups Today
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
          {slate.date} · {slate.games.length} games · {nProbables} probables
        </span>
        {stale && (
          <span style={{
            background: 'var(--amber-dim)', border: '1px solid var(--amber)',
            color: 'var(--amber)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
          }}>
            stale — rerun models/daily_matchups.py
          </span>
        )}
      </div>
      <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '0 0 12px' }}>
        Every probable starter crossed with the opposing lineup (top {SLATE_HITTERS_PER_TEAM} hitters
        by PA), ranked by projected hitter advantage. Click a row for the matchup breakdown.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ ...th, textAlign: 'left' }}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>Hitter</th>
              <th style={{ ...th, textAlign: 'left' }}>vs Pitcher</th>
              <th style={{ ...th, textAlign: 'left' }}>Game</th>
              <th style={{ ...th, textAlign: 'center' }}>Grade</th>
              <th style={{ ...th, textAlign: 'right' }}>Proj xwOBA</th>
              <th style={{ ...th, textAlign: 'right' }}>Δ vs avg</th>
              <th style={{ ...th, textAlign: 'center' }}>Conf</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dx = r.proj.deltas.from_batter_avg.xwoba ?? 0;
              const gradeCol =
                r.proj.grade >= 5 ? 'var(--positive)' :
                r.proj.grade >= 2 ? '#34d399' :
                r.proj.grade >= -1 ? 'var(--text-2)' : 'var(--amber)';
              return (
                <tr
                  key={`${r.pitcherId}-${r.batterId}`}
                  className="table-row-hover"
                  onClick={() => setBreakdown({ pitcherId: r.pitcherId, batterId: r.batterId, pitcherName: r.pitcherName })}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <td style={{ padding: '8px 10px', color: 'var(--text-4)' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-1)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {r.batterName}
                    <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>{r.batterTeam}</span>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {r.pitcherName}
                    <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 12 }}>{r.pitcherTeam}</span>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-3)', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {r.game.away.team} @ {r.game.home.team}
                    {gameTimeLabel(r.game.game_time) && (
                      <span style={{ color: 'var(--text-4)', marginLeft: 6 }}>{gameTimeLabel(r.game.game_time)}</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <span style={{
                      color: gradeCol, fontWeight: 700, fontSize: 13,
                      background: 'var(--bg-elevated)', borderRadius: 4, padding: '2px 8px',
                    }}>
                      {r.proj.grade_label}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-1)', fontWeight: 600 }}>
                    {r.proj.outcomes.xwoba.toFixed(3)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600,
                    color: dx > 0.005 ? 'var(--positive)' : dx < -0.005 ? 'var(--negative)' : 'var(--text-2)' }}>
                    {dx > 0 ? '+' : ''}{dx.toFixed(3)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                    {r.proj.confidence}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {breakdown && (
        <MatchupBreakdown
          target={breakdown}
          similarityData={similarityData}
          batterOutcomes={batterOutcomes}
          onClose={() => setBreakdown(null)}
        />
      )}
    </div>
  );
}

// ── HR leaderboard (today's slate) ───────────────────────────────────────────

function localToday(): string {
  // local calendar date — toISOString() is UTC and flips "today" mid-evening
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function fairAmerican(p: number): string {
  // zero-vig American odds for probability p — comparable to sportsbook prices
  if (p <= 0 || p >= 1) return '—';
  return p < 0.5
    ? `+${Math.round((100 * (1 - p)) / p)}`
    : `-${Math.round((100 * p) / (1 - p))}`;
}

function StaleBadge() {
  return (
    <span style={{
      background: 'var(--amber-dim)', border: '1px solid var(--amber)',
      color: 'var(--amber)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
    }}>
      stale — rerun models/slate_hr_projection.py
    </span>
  );
}

function HrLeaderboard({
  slate, similarityData, batterOutcomes,
}: {
  slate: HrSlateDoc;
  similarityData: SimilarityData;
  batterOutcomes: BatterOutcomesData;
}) {
  const [breakdown, setBreakdown] = useState<BreakdownTarget | null>(null);
  const rows = useMemo(
    () => [...slate.batters].sort((a, b) => b.p_hr_game - a.p_hr_game),
    [slate],
  );
  const stale = slate.date < localToday();  // future-dated slate is fine, not stale
  const anyPosted = rows.some(r => r.lineup_posted);

  if (rows.length === 0) {
    return <div className="card" style={{ color: 'var(--text-3)', fontSize: 13 }}>No HR projections on the {slate.date} slate.</div>;
  }

  const th = {
    padding: '7px 10px', color: 'var(--text-3)', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, whiteSpace: 'nowrap' as const,
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: 16 }}>
          HR Leaderboard — Today
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
          {slate.date} · {rows.length} hitters
        </span>
        {stale && <StaleBadge />}
      </div>
      <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '0 0 12px' }}>
        Chance of hitting a home run today for every projected hitter on the slate:
        per-PA HR probability vs the probable starter (matchup outcome model) compounded
        over expected PA by lineup slot. {anyPosted
          ? '● marks confirmed posted lineups; others use the PA-sorted roster.'
          : 'Lineups not posted yet — hitters are the PA-sorted top 9 per team.'}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ ...th, textAlign: 'left' }}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>Hitter</th>
              <th style={{ ...th, textAlign: 'left' }}>vs Pitcher</th>
              <th style={{ ...th, textAlign: 'left' }}>Game</th>
              <th style={{ ...th, textAlign: 'right' }}>HR% Today</th>
              <th style={{ ...th, textAlign: 'right' }}>Fair Odds</th>
              <th style={{ ...th, textAlign: 'right' }}>per PA</th>
              <th style={{ ...th, textAlign: 'right' }}>E[PA]</th>
              <th style={{ ...th, textAlign: 'right' }}>E[HR]</th>
              <th style={{ ...th, textAlign: 'center' }}>Conf</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.pitcher_id}-${r.batter_id}`}
                className="table-row-hover"
                onClick={() => setBreakdown({ pitcherId: r.pitcher_id, batterId: r.batter_id, pitcherName: r.pitcher })}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <td style={{ padding: '7px 10px', color: 'var(--text-4)' }}>{i + 1}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-1)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {r.batter}
                  <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
                    {r.team} · {r.hand} · #{r.slot}{r.lineup_posted ? ' ●' : ''}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {r.pitcher}
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-3)', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {r.away} @ {r.home}
                  {gameTimeLabel(r.game_time) && (
                    <span style={{ color: 'var(--text-4)', marginLeft: 6 }}>{gameTimeLabel(r.game_time)}</span>
                  )}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--positive)' }}>
                  {(r.p_hr_game * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-1)' }}>
                  {fairAmerican(r.p_hr_game)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                  {(r.p_hr * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                  {r.expected_pa.toFixed(1)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>
                  {r.expected_hr.toFixed(2)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>
                  {r.confidence}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {breakdown && (
        <MatchupBreakdown
          target={breakdown}
          similarityData={similarityData}
          batterOutcomes={batterOutcomes}
          onClose={() => setBreakdown(null)}
        />
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
  const slate = useDailySlate();
  const hrSlate = useHrSlate();
  const [board, setBoard] = useState<'matchups' | 'hr'>('matchups');

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 6px 0' }}>
          Matchup Machine
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>
          Search any pitcher-batter matchup, or scan today's slate for the best hitter spots.
          Projections use pitcher-similarity regression over observed batter outcomes.
        </p>
      </div>

      {/* Selectors */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'end' }}>
          <div>
            <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
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
                <span>{item.name}<span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>{item.sub ?? item.team}</span></span>
              )}
            />
          </div>

          {/* Swap button */}
          <div style={{ paddingBottom: 2 }}>
            <button
              onClick={() => { const prevP = selectedPitcherId; const prevB = selectedBatterId; setSelectedPitcherId(prevB); setSelectedBatterId(prevP); }}
              title="Swap batter and pitcher"
              style={{
                background: 'var(--border)', border: '1px solid var(--border-plus)',
                color: 'var(--text-2)', borderRadius: 8, padding: '9px 14px',
                cursor: 'pointer', fontSize: 18, lineHeight: 1,
              }}
            >⇄</button>
          </div>

          <div>
            <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
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
                <span>{item.name}<span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>{item.sub ?? item.team}</span></span>
              )}
            />
          </div>
        </div>
      </div>

      {/* Data loading state */}
      {dataLoading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>
          Loading matchup data…
        </div>
      )}

      {dataError && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ color: '#ef4444', fontSize: 14, marginBottom: 8 }}>
            Matchup data not yet available for {season}.
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
            Run <code style={{ color: '#4b96e6' }}>python models/pitcher_similarity.py {season}</code> and{' '}
            <code style={{ color: '#4b96e6' }}>python models/batter_outcomes.py --year {season}</code> to generate it.
          </div>
        </div>
      )}

      {/* Today's boards — shown until a specific matchup is selected */}
      {!dataLoading && !dataError && similarityData && batterOutcomes
        && (!selectedPitcherId || !selectedBatterId) && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Today:</span>
            {([['matchups', 'Best Matchups'], ['hr', 'HR Leaderboard']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setBoard(key)}
                style={{
                  padding: '5px 14px', fontSize: 12, border: '1px solid',
                  borderColor: board === key ? 'var(--accent)' : 'var(--border-plus)',
                  background: board === key ? 'var(--accent-dim)' : 'transparent',
                  color: board === key ? 'var(--accent)' : 'var(--text-2)',
                  borderRadius: 4, cursor: 'pointer', fontWeight: board === key ? 600 : 400,
                }}>
                {label}
              </button>
            ))}
          </div>

          {board === 'matchups' && (
            slate === 'loading' ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 }}>
                Loading today's slate…
              </div>
            ) : slate === 'missing' ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 8 }}>
                  No daily slate file found
                </div>
                <div style={{ fontSize: 13 }}>
                  Run <code style={{ color: 'var(--accent)' }}>python models/daily_matchups.py</code> to
                  pull today's games and probable starters — or search any matchup above.
                </div>
              </div>
            ) : (
              <BestMatchupsToday
                slate={slate}
                similarityData={similarityData}
                batterOutcomes={batterOutcomes}
              />
            )
          )}

          {board === 'hr' && (
            hrSlate === 'loading' ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 }}>
                Loading HR projections…
              </div>
            ) : hrSlate === 'missing' ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 8 }}>
                  No HR slate file found
                </div>
                <div style={{ fontSize: 13 }}>
                  Run <code style={{ color: 'var(--accent)' }}>python models/slate_hr_projection.py</code> to
                  project today's home-run chances.
                </div>
              </div>
            ) : (
              <HrLeaderboard
                slate={hrSlate}
                similarityData={similarityData}
                batterOutcomes={batterOutcomes}
              />
            )
          )}
        </>
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
              color="#4b96e6"
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
                  <span style={{ color: 'var(--text-1)', fontSize: 18, fontWeight: 600 }}>
                    {projection.leans === 'batter'
                      ? `Favors ${selectedBatter.name}`
                      : projection.leans === 'pitcher'
                      ? `Favors ${selectedPitcher.pitcher_name}`
                      : 'Even matchup'}
                  </span>
                  <ConfidenceBadge conf={projection.confidence} />
                </div>
                <div style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
                  Projected xwOBA{' '}
                  <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>
                    {projection.outcomes.xwoba.toFixed(3)}
                  </span>
                  {' '}vs league average 0.320.
                  {' '}{selectedBatter.name} projects to reach base{' '}
                  <span style={{ color: 'var(--text-1)', fontWeight: 700 }}>
                    {pct(projection.outcomes.reach_pct)}
                  </span>
                  {' '}of at-bats.
                  {projection.n_similar_with_data > 0
                    ? ` Based on outcomes vs ${projection.n_similar_with_data} similar pitchers.`
                    : ' Using batter vs-hand splits (no direct matchup data).'}
                </div>
              </div>
              {projection.outcomes.wrc_plus_proj != null && (
                <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--border)', borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Proj. wRC+
                  </div>
                  <div style={{ color: 'var(--text-1)', fontSize: 28, fontWeight: 700 }}>
                    {projection.outcomes.wrc_plus_proj}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Outcome table */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ color: '#4b96e6', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
              Projected Outcomes
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['', 'Reach Base', 'Hit', 'HR', '2B/3B', '1B', 'BB', 'K', 'xwOBA'].map((h, i) => (
                      <th key={h || `col-${i}`} style={{
                        padding: '7px 10px', textAlign: i === 0 ? 'left' : 'center',
                        color: 'var(--text-3)', fontWeight: 600, fontSize: 11,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Projection row */}
                  <tr style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--text-1)', fontWeight: 600 }}>Projection</td>
                    {([
                      ['reach', projection.outcomes.reach_pct],
                      ['hit', projection.outcomes.hit_pct],
                      ['hr', projection.outcomes.hr_pct],
                      ['xbh', projection.outcomes.double_triple_pct],
                      ['1b', projection.outcomes.single_pct],
                      ['bb', projection.outcomes.bb_pct],
                      ['k', projection.outcomes.k_pct],
                    ] as const).map(([label, v]) => (
                      <td key={label} style={{ padding: '7px 10px', color: 'var(--text-1)', textAlign: 'center', fontWeight: 600 }}>
                        {pct(v)}
                      </td>
                    ))}
                    <td style={{ padding: '7px 10px', color: 'var(--text-1)', textAlign: 'center', fontWeight: 700 }}>
                      {projection.outcomes.xwoba.toFixed(3)}
                    </td>
                  </tr>

                  {/* Batter delta row */}
                  <tr style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
                    <td style={{ padding: '7px 10px', color: '#4b96e6', fontSize: 12 }}>vs. batter avg</td>
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
                    <td style={{ padding: '7px 10px', color: 'var(--text-3)', fontSize: 12 }}>Batter season avg</td>
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
                      <td key={i} style={{ padding: '7px 10px', color: 'var(--text-3)', textAlign: 'center', fontSize: 12 }}>
                        {pct(v)}
                      </td>
                    ))}
                    <td style={{ padding: '7px 10px', color: 'var(--text-3)', textAlign: 'center', fontSize: 12 }}>
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
              <div style={{ color: '#4b96e6', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
                Advanced Metrics
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Hard Hit%', v: projection.outcomes.hard_hit_rate },
                  { label: 'GB%', v: projection.outcomes.gb_rate },
                  { label: 'FB%', v: projection.outcomes.fb_rate },
                  { label: 'Barrel%', v: projection.outcomes.barrel_rate },
                ].filter(({ v }) => v != null).map(({ label, v }) => (
                  <div key={label} style={{ textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 8px' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
                    <div style={{ color: 'var(--text-1)', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{pct(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Methodology note */}
          <div style={{ color: 'var(--text-4)', fontSize: 12, lineHeight: 1.6, borderTop: '1px solid var(--bg-elevated)', paddingTop: 12 }}>
            <strong style={{ color: 'var(--text-3)' }}>Methodology:</strong> Outcomes are weighted by pitcher similarity score,
            then regressed toward the batter's season average using a Marcel-style regression (k=20 PA).
            Similarity data must be generated by <code style={{ color: '#4b96e6' }}>pitcher_similarity.py</code>.
            Confidence reflects the amount of observed data vs similar pitchers.
          </div>
        </div>
      )}

      {/* No projection but both selected */}
      {!projection && selectedPitcherId && selectedBatterId && !dataLoading && !dataError && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 16, color: 'var(--text-2)', marginBottom: 8 }}>
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
