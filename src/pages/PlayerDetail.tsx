import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../data/useData';
import { usePitchData } from '../data/usePitchData';
import { useScoringConfig } from '../data/useScoringConfig';
import { useGameGrades } from '../data/useMatchupData';
import { filterPitches, DEFAULT_FILTERS, countActiveFilters, SEASON_DATE_FROM, SEASON_DATE_TO } from '../data/filterPitches';
import { filtersToSearchParams, searchParamsToFilters } from '../data/filterUrl';
import { computeMetrics, computeScores } from '../data/scoringEngine';
import { GradeBadge } from '../components/GradeBadge';
import { MetricBar } from '../components/MetricBar';
import { DimensionRadarChart } from '../components/DimensionRadarChart';
import { MovementProfileChart } from '../components/MovementProfileChart';
import { FilterPanel } from '../components/FilterPanel';
import { GameLog } from '../components/GameLog';
import { GameSummary } from '../components/GameSummary';
import { RollingChart } from '../components/RollingChart';
import { PercentilePanel } from '../components/PercentilePanel';
import { SkeletonPage } from '../components/Skeleton';
import { PitchArsenal } from '../components/PitchArsenal';
import { ArsenalSimulator } from '../components/ArsenalSimulator';
import { SequenceMatrix } from '../components/SequenceMatrix';
import { VelocityDistribution } from '../components/VelocityDistribution';
import { SeasonHistory } from '../components/SeasonHistory';
import { SimilarPitchers } from '../components/SimilarPitchers';
import { CountStateHeatmap } from '../components/CountStateHeatmap';
import { StuffDNA } from '../components/StuffDNA';
import { NovelMetricsPanel } from '../components/NovelMetricsPanel';
import { TTOChart } from '../components/TTOChart';
import { TabBar } from '../components/TabBar';
import { useTTOData } from '../data/useTTOData';
import { usePitchAttributes } from '../data/usePitchAttributes';
import { computeGradeAttribution } from '../data/gradeAttribution';
import { computePitchTypeGrades } from '../data/computePitchTypeGrades';
import { PitchTypeGradeTable } from '../components/PitchTypeGradeTable';
import { scoreColorContinuous } from '../data/constants';
import { computePercentiles } from '../data/percentiles';
import {
  pitchColor,
  DIMENSION_METRICS,
  DIMENSION_LABELS,
  METRIC_LABELS,
  LOWER_IS_BETTER,
  PCT_METRICS,
  gradeColor,
} from '../data/constants';
import type { DimensionKey, MetricKey, Pitcher, PitchFilters, RawPitch } from '../types';

const DIMENSION_KEYS: DimensionKey[] = [
  'stuff',
  'command',
  'deception',
  'tunnel_and_sequence',
  'outcomes',
  'arsenal',
];

function formatRaw(key: MetricKey, raw: number): string {
  if (PCT_METRICS.has(key)) return `${(raw * 100).toFixed(1)}%`;
  if (key === 'n_pitch_types') return String(Math.round(raw));
  if (key === 'avg_perceived_velo' || (key as string) === 'velo') return raw.toFixed(1);
  if (Math.abs(raw) < 10) return raw.toFixed(2);
  return raw.toFixed(1);
}

interface DimPanelProps {
  dimKey: DimensionKey;
  pitcher: Pitcher;
  weight: number;
  filteredScore?: number | null;
  filteredMetrics?: Record<string, number | null>;
  hasFilters: boolean;
  fullSeasonOnly: Set<string>;
}

function DimensionPanel({
  dimKey,
  pitcher,
  weight,
  filteredScore,
  filteredMetrics,
  hasFilters,
  fullSeasonOnly,
}: DimPanelProps) {
  const [open, setOpen] = useState(false);
  const dim = pitcher.dimensions[dimKey];
  const metrics = DIMENSION_METRICS[dimKey];
  const color = gradeColor(filteredScore ?? dim.score);

  return (
    <div className="dim-panel">
      <button
        className="dim-panel-header"
        onClick={() => setOpen((o) => !o)}
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <span className="dim-panel-name">{DIMENSION_LABELS[dimKey]}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#606080', fontSize: 12 }}>weight {Math.round(weight * 100)}%</span>
          {hasFilters && filteredScore != null && (
            <span className="comparison-indicator">
              <span style={{ color: gradeColor(filteredScore) }}>{filteredScore}</span>
              <span style={{ color: '#404060' }}> | </span>
              <span style={{ color: '#606080', fontSize: 10 }}>Full: {dim.score}</span>
            </span>
          )}
          {(!hasFilters || filteredScore == null) && <GradeBadge score={dim.score} size="sm" />}
          <span style={{ color: '#606080', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="dim-panel-body">
          {metrics.map((metricKey) => {
            const mg = pitcher.metric_grades[metricKey];
            if (!mg) return null;
            const invertDir = LOWER_IS_BETTER.has(metricKey);
            const isFullSeasonOnly = fullSeasonOnly.has(metricKey);
            const filteredVal = filteredMetrics?.[metricKey];

            return (
              <div key={metricKey} className="metric-row">
                <span className="metric-label">
                  {METRIC_LABELS[metricKey]}
                  {isFullSeasonOnly && hasFilters && (
                    <span
                      title="Full season value — not affected by filters"
                      style={{ color: '#606080', fontSize: 10, marginLeft: 4 }}
                    >
                      [FS]
                    </span>
                  )}
                </span>
                <span className="metric-raw">
                  {hasFilters && !isFullSeasonOnly && filteredVal != null ? (
                    <span className="comparison-indicator" style={{ fontSize: 11 }}>
                      <span style={{ color: '#e0e0e8' }}>{formatRaw(metricKey, filteredVal)}</span>
                      <span style={{ color: '#404060' }}> | </span>
                      <span style={{ color: '#606080', fontSize: 10 }}>{formatRaw(metricKey, mg.raw)}</span>
                    </span>
                  ) : (
                    formatRaw(metricKey, mg.raw)
                  )}
                </span>
                <GradeBadge score={mg.grade} size="sm" />
                <div style={{ flex: 1 }}>
                  <MetricBar grade={mg.grade} invertDirection={invertDir} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, season } = useData();
  const { loadForPitcher, pitches: rawPitches, games: rawGames, loading: pitchLoading } = usePitchData(season);
  const { data: attrData, getPitcherAttributes, getExpectedPitchPlus } = usePitchAttributes(season);
  const { config: scoringConfig } = useScoringConfig();

  // Initialize filters from URL params
  const [filters, setFiltersState] = useState<PitchFilters>(() => searchParamsToFilters(searchParams));
  const [showFilters, setShowFilters] = useState(false);

  // Sync filter changes to URL
  const setFilters = (f: PitchFilters) => {
    setFiltersState(f);
    const params = filtersToSearchParams(f);
    setSearchParams(params, { replace: true });
  };

  // Load pitch data once we know the pitcher ID
  useEffect(() => {
    if (id) loadForPitcher(Number(id));
  }, [id, loadForPitcher]);

  if (loading) return <SkeletonPage />;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return null;

  const pitcher = data.pitchers.pitchers.find((p) => p.pitcher_id === Number(id));
  if (!pitcher) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>Pitcher not found</h1>
        </div>
      </div>
    );
  }

  const pitchData = data.pitchTypes.pitchers[String(pitcher.pitcher_id)] ?? [];
  const weights = data.pitchers.dimension_weights;
  const pitcherRawPitches: RawPitch[] = rawPitches;
  const games = rawGames;

  // Pitch type names from pitch_types data
  const pitchTypeNames: Record<string, string> = {};
  for (const pt of pitchData) {
    pitchTypeNames[pt.pitch_type] = pt.pitch_name;
  }
  // Also from pitch_names if available
  if (data.pitchTypes.pitch_names) {
    Object.assign(pitchTypeNames, data.pitchTypes.pitch_names);
  }

  const attributesByType = getPitcherAttributes(pitcher.pitcher_id);
  const expectedPitchPlus = getExpectedPitchPlus(pitcher.pitcher_id);
  const leagueMovement = attrData?.league_movement ?? null;

  return (
    <PlayerDetailInner
      pitcher={pitcher}
      pitchData={pitchData}
      weights={weights}
      pitcherRawPitches={pitcherRawPitches}
      games={games}
      pitchLoading={pitchLoading}
      scoringConfig={scoringConfig}
      pitchTypeNames={pitchTypeNames}
      filters={filters}
      setFilters={setFilters}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      navigate={navigate}
      searchParams={searchParams}
      setSearchParams={setSearchParams}
      data={data}
      attributesByType={attributesByType}
      expectedPitchPlus={expectedPitchPlus}
      leagueMovement={leagueMovement}
      season={season}
    />
  );
}

// ─── Inner component (uses hooks safely with all data) ────────────────────────

interface InnerProps {
  pitcher: Pitcher;
  pitchData: import('../types').PitchType[];
  weights: Record<DimensionKey, number>;
  pitcherRawPitches: RawPitch[];
  games: Record<string, import('../types').GameInfo>;
  pitchLoading: boolean;
  scoringConfig: import('../types').ScoringConfig | null;
  pitchTypeNames: Record<string, string>;
  filters: PitchFilters;
  setFilters: (f: PitchFilters) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
  searchParams: URLSearchParams;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
  data: import('../types').AppData;
  attributesByType: Record<string, import('../types').AttributeGrades> | null;
  expectedPitchPlus: number | null;
  leagueMovement: import('../types').PitchAttributesData['league_movement'] | null;
  season: import('../data/useData').Season;
}

function PlayerDetailInner({
  pitcher,
  pitchData,
  weights,
  pitcherRawPitches,
  games,
  pitchLoading,
  scoringConfig,
  pitchTypeNames,
  filters,
  setFilters,
  showFilters,
  setShowFilters,
  navigate,
  searchParams,
  setSearchParams,
  data,
  attributesByType,
  expectedPitchPlus,
  leagueMovement,
  season,
}: InnerProps) {
  const { data: gameGradesData } = useGameGrades(season);
  const { data: ttoData } = useTTOData(pitcher?.pitcher_id ?? null, season);
  const activeFilterCount = countActiveFilters(filters);
  const hasFilters = activeFilterCount > 0;
  const [rollingMetric, setRollingMetric] = useState<'velo' | 'whiffRate' | 'zoneRate' | 'cswRate'>('velo');

  // Tab state (synced with URL ?tab=)
  const activeTab = searchParams.get('tab') ?? 'overview';
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  // Compute percentile rankings (memoized across all pitchers)
  const percentileMap = useMemo(
    () => computePercentiles(data.pitchers.pitchers),
    [data.pitchers.pitchers]
  );
  const percentiles = percentileMap.get(pitcher.pitcher_id);

  // Grade attribution explanations
  const gradeAttribution = useMemo(
    () => computeGradeAttribution(pitcher, attributesByType ?? null, percentiles),
    [pitcher, attributesByType, percentiles]
  );

  // Filtered pitches (memoized)
  const filteredPitches = useMemo(() => {
    if (pitcherRawPitches.length === 0) return [];
    return filterPitches(pitcherRawPitches, filters);
  }, [pitcherRawPitches, filters]);

  // Compute metrics from filtered pitches (memoized)
  const filteredMetrics = useMemo(() => {
    if (!scoringConfig || filteredPitches.length === 0) return null;
    return computeMetrics(filteredPitches, scoringConfig);
  }, [filteredPitches, scoringConfig]);

  // Compute scores from filtered metrics
  const filteredScores = useMemo(() => {
    if (!scoringConfig || !filteredMetrics) return null;
    // Pass full-season grades for full-season-only metrics
    const fsGrades: Record<string, { grade: number; raw: number }> = {};
    for (const key of scoringConfig.fullseason_only_metrics ?? []) {
      const mk = key as MetricKey;
      if (pitcher.metric_grades[mk]) {
        fsGrades[key] = pitcher.metric_grades[mk];
      }
    }
    return computeScores(filteredMetrics, scoringConfig, fsGrades);
  }, [filteredMetrics, scoringConfig, pitcher]);

  // Available pitch types for this pitcher
  const availablePitchTypes = useMemo(
    () => Array.from(new Set(pitcherRawPitches.map((p) => p.pt))).sort(),
    [pitcherRawPitches]
  );

  // Per-pitch-type grades (TJStats-style)
  const pitchTypeGrades = useMemo(() => {
    if (filteredPitches.length === 0 || !scoringConfig) return [];
    return computePitchTypeGrades(
      filteredPitches,
      scoringConfig.league_averages as Record<string, any>,
      pitchTypeNames,
    );
  }, [filteredPitches, scoringConfig, pitchTypeNames]);

  // Full-season-only metrics set
  const fullSeasonOnly = useMemo(
    () => new Set(scoringConfig?.fullseason_only_metrics ?? []),
    [scoringConfig]
  );

  const radarData = DIMENSION_KEYS.map((d) => ({
    dimension: d,
    score:
      hasFilters && filteredScores?.dimensions[d] != null
        ? filteredScores.dimensions[d]!
        : pitcher.dimensions[d].score,
  }));

  const leagueRadar = DIMENSION_KEYS.map((d) => ({ dimension: d, score: 100 }));

  // Full-season radar for overlay when filters active
  const fullSeasonRadar =
    hasFilters
      ? DIMENSION_KEYS.map((d) => ({ dimension: d, score: pitcher.dimensions[d].score }))
      : undefined;

  const smallSample = filteredPitches.length > 0 && filteredPitches.length < 20;

  // Effective pitch+ to show
  const displayPitchPlus =
    hasFilters && filteredScores?.pitchPlus != null
      ? filteredScores.pitchPlus
      : pitcher.pitch_plus;

  const gameSelected = filters.gameId != null;

  return (
    <div className="page">
      {/* ── Savant-style Header Card ──────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
          <button
            onClick={() => window.print()}
            style={{
              background: '#0f1929', border: '1px solid #1e3a5f', color: '#94a3b8',
              borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            title="Export as PDF via browser print"
          >
            Export Report
          </button>
        </div>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            {/* Player info */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 style={{ margin: '0 0 4px', fontSize: 28, letterSpacing: -0.5 }}>{pitcher.pitcher_name}</h1>
              <p style={{ margin: 0, color: '#a0a0b8', fontSize: 13 }}>
                P &nbsp;|&nbsp; {pitcher.pitcher_team} &nbsp;|&nbsp; {pitcher.pitcher_hand === 'L' ? 'LHP' : pitcher.pitcher_hand === 'R' ? 'RHP' : 'Switch'}
              </p>
              <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
                {[
                  { label: 'Pitches', value: pitcher.n_pitches.toLocaleString() },
                  { label: 'Games', value: pitcher.n_games },
                  { label: 'K%', value: pitcher.metric_grades.k_rate ? `${(pitcher.metric_grades.k_rate.raw * 100).toFixed(1)}%` : '—' },
                  { label: 'BB%', value: pitcher.metric_grades.bb_rate ? `${(pitcher.metric_grades.bb_rate.raw * 100).toFixed(1)}%` : '—' },
                  { label: 'CSW%', value: pitcher.metric_grades.csw_rate ? `${(pitcher.metric_grades.csw_rate.raw * 100).toFixed(1)}%` : '—' },
                  { label: 'Velo', value: pitcher.metric_grades.avg_perceived_velo ? `${pitcher.metric_grades.avg_perceived_velo.raw.toFixed(1)}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#e0e0e8' }}>{value}</div>
                    <div style={{ fontSize: 10, color: '#606080', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pitch+ score + xPitch+ + dimension badges */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ textAlign: 'center' }}>
                  <GradeBadge score={displayPitchPlus} size="lg" />
                  <div style={{ color: '#606080', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>
                    {hasFilters ? 'Pitch+ (filtered)' : 'Pitch+'}
                  </div>
                </div>
                {expectedPitchPlus != null && (
                  <div style={{ textAlign: 'center' }}>
                    {(() => {
                      const delta = displayPitchPlus - expectedPitchPlus;
                      const deltaColor = delta > 5 ? '#c85a5a' : delta < -5 ? '#4a6494' : '#8890a0';
                      return (
                        <>
                          <div style={{
                            background: scoreColorContinuous(expectedPitchPlus, 0.15),
                            border: `2px solid ${scoreColorContinuous(expectedPitchPlus, 0.5)}`,
                            borderRadius: 8,
                            padding: '4px 10px',
                            fontSize: 22,
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: scoreColorContinuous(expectedPitchPlus, 1),
                            minWidth: 52,
                          }}>
                            {Math.round(expectedPitchPlus)}
                          </div>
                          <div style={{ color: '#606080', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>
                            xPitch+
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: deltaColor, marginTop: 1 }}>
                            {delta > 0 ? '+' : ''}{Math.round(delta)} vs stuff
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              {hasFilters && filteredScores?.pitchPlus != null && (
                <div style={{ color: '#404060', fontSize: 11, textAlign: 'center' }}>Full Pitch+: {pitcher.pitch_plus}</div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 300 }}>
                {DIMENSION_KEYS.map((d) => {
                  const score = hasFilters && filteredScores?.dimensions[d] != null ? filteredScores.dimensions[d]! : pitcher.dimensions[d].score;
                  const color = gradeColor(score);
                  return (
                    <div key={d} title={DIMENSION_LABELS[d]} style={{
                      background: `${color}18`,
                      border: `1px solid ${color}40`,
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 11,
                      textAlign: 'center',
                    }}>
                      <div style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{score}</div>
                      <div style={{ color: '#606080', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3 }}>{DIMENSION_LABELS[d].slice(0, 4)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pitch loading indicator */}
      {pitchLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: '#14141f',
            border: '1px solid #1e1e2e',
            borderRadius: 8,
            color: '#a0a0b8',
            fontSize: 13,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid #4a9eff',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Loading detailed pitch data…
        </div>
      )}

      {/* Filter Bar */}
      {pitcherRawPitches.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            className={`filter-toggle-btn${showFilters ? ' active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{ flexShrink: 0 }}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="active-filters-badge" style={{ marginLeft: 6 }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <span style={{ color: '#606080', fontSize: 12 }}>
            Showing{' '}
            <strong style={{ color: '#4a9eff' }}>
              {filteredPitches.length.toLocaleString()}
            </strong>{' '}
            of <strong>{pitcherRawPitches.length.toLocaleString()}</strong> pitches
          </span>
          {activeFilterCount > 0 && (
            <button
              className="reset-filters-btn"
              onClick={() => setFilters({ ...DEFAULT_FILTERS })}
            >
              Reset All
            </button>
          )}
        </div>
      )}

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {filters.pitchTypes.length > 0 && (
            <span className="filter-chip">
              {filters.pitchTypes.map((pt) => (
                <span key={pt} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: pitchColor(pt) }} />
                  {pt}
                </span>
              ))}
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, pitchTypes: [] })}>×</button>
            </span>
          )}
          {filters.batterHand !== 'all' && (
            <span className="filter-chip">
              vs {filters.batterHand === 'L' ? 'LHH' : 'RHH'}
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, batterHand: 'all' })}>×</button>
            </span>
          )}
          {filters.counts.length > 0 && (
            <span className="filter-chip">
              {filters.counts.length <= 3 ? filters.counts.join(', ') : `${filters.counts.length} counts`}
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, counts: [] })}>×</button>
            </span>
          )}
          {filters.zone !== 'all' && (
            <span className="filter-chip">
              {filters.zone === 'in' ? 'In-Zone' : filters.zone === 'edge' ? 'Edge' : 'Chase'}
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, zone: 'all' })}>×</button>
            </span>
          )}
          {filters.result !== 'all' && (
            <span className="filter-chip">
              {filters.result}
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, result: 'all' })}>×</button>
            </span>
          )}
          {filters.innings.length > 0 && (
            <span className="filter-chip">
              Inn: {filters.innings.join(',')}
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, innings: [] })}>×</button>
            </span>
          )}
          {filters.outs.length > 0 && (
            <span className="filter-chip">
              {filters.outs.length === 1 ? `${filters.outs[0]} out` : `${filters.outs.join(',')} outs`}
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, outs: [] })}>×</button>
            </span>
          )}
          {(filters.veloMin != null || filters.veloMax != null) && (
            <span className="filter-chip">
              {filters.veloMin ?? 50}–{filters.veloMax ?? 105} mph
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, veloMin: null, veloMax: null })}>×</button>
            </span>
          )}
          {(filters.dateFrom && filters.dateFrom !== SEASON_DATE_FROM) || (filters.dateTo && filters.dateTo !== SEASON_DATE_TO) ? (
            <span className="filter-chip">
              {filters.dateFrom ?? '…'} → {filters.dateTo ?? '…'}
              <button className="filter-chip-x" onClick={() => setFilters({ ...filters, dateFrom: SEASON_DATE_FROM, dateTo: SEASON_DATE_TO })}>×</button>
            </span>
          ) : null}
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && pitcherRawPitches.length > 0 && (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          availablePitchTypes={availablePitchTypes}
          pitchTypeNames={pitchTypeNames}
          totalPitches={pitcherRawPitches.length}
          filteredPitches={filteredPitches.length}
        />
      )}

      {/* Small sample warning */}
      {smallSample && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(255,213,79,0.1)',
            border: '1px solid rgba(255,213,79,0.3)',
            borderRadius: 8,
            color: '#ffd54f',
            fontSize: 13,
          }}
        >
          Small sample ({filteredPitches.length} pitches) — metrics may be unreliable
        </div>
      )}

      {/* ── Tab Bar ── */}
      <TabBar
        tabs={[
          { key: 'overview',  label: 'Overview' },
          { key: 'arsenal',   label: 'Arsenal', ...(pitchTypeGrades.length > 0 && { badge: pitchTypeGrades.length }) },
          { key: 'research',  label: 'Research Lab' },
          { key: 'charts', label: 'Charts' },
          { key: 'trends', label: 'Trends' },
          { key: 'gamelog', label: 'Game Log' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ══════════════════════ OVERVIEW TAB ══════════════════════ */}
      {activeTab === 'overview' && <>
      {/* Percentile Rankings */}
      {percentiles && <PercentilePanel pitcher={pitcher} percentiles={percentiles} />}

      {/* Arsenal Intelligence — StuffDNA + Grade Attribution */}
      {(attributesByType || pitchData.length > 0) && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Arsenal Intelligence</h3>
          <div className="two-col" style={{ alignItems: 'flex-start' }}>
            {/* StuffDNA visualization */}
            <div>
              <p style={{ fontSize: 12, color: '#606080', margin: '0 0 10px' }}>
                Movement space with attribute grades. Node size = usage · Border thickness = attribute quality · Background clouds = league average for each pitch type
              </p>
              <StuffDNA
                pitchTypes={pitchData}
                attributesByType={attributesByType ?? null}
                leagueMovement={leagueMovement}
                pitchTypeNames={pitchTypeNames}
                width={420}
                height={360}
                highlightedTypes={filters.pitchTypes}
                onPitchTypeClick={(pt) => {
                  const next = filters.pitchTypes.includes(pt)
                    ? filters.pitchTypes.filter(t => t !== pt)
                    : [...filters.pitchTypes, pt];
                  setFilters({ ...filters, pitchTypes: next });
                }}
              />
            </div>

            {/* Grade Attribution Explanations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: '#606080', margin: '0 0 4px' }}>
                What's driving each dimension grade
              </p>
              {gradeAttribution.map(({ dimensionKey, score, drivers, summary }) => {
                if (drivers.length === 0) return null;
                const dimColor = gradeColor(score);
                return (
                  <div key={dimensionKey} style={{
                    background: '#0f0f1a',
                    border: `1px solid #1e1e2e`,
                    borderLeft: `3px solid ${dimColor}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#c0c0d8', fontWeight: 600, fontSize: 13 }}>
                        {DIMENSION_LABELS[dimensionKey]}
                      </span>
                      <span style={{ color: dimColor, fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                        {score}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {drivers.slice(0, 3).map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                          <span style={{
                            width: 28,
                            height: 16,
                            borderRadius: 3,
                            background: scoreColorContinuous(50 + d.percentile, 0.2),
                            border: `1px solid ${scoreColorContinuous(50 + d.percentile, 0.4)}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'monospace',
                            fontSize: 9,
                            fontWeight: 700,
                            color: scoreColorContinuous(50 + d.percentile, 1),
                            flexShrink: 0,
                          }}>
                            {d.percentile}
                          </span>
                          <span style={{ color: '#a0a0b8' }}>{d.label}</span>
                        </div>
                      ))}
                    </div>
                    {summary && (
                      <p style={{ fontSize: 10, color: '#404060', margin: '6px 0 0', fontStyle: 'italic' }}>
                        {summary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Two-column: Radar + Dimension Breakdown */}
      <div className="two-col">
        <div className="card">
          <h3 className="card-title">
            Dimension Profile
            {hasFilters && (
              <span style={{ color: '#606080', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
                (filtered)
              </span>
            )}
          </h3>
          <DimensionRadarChart
            dimensions={radarData}
            secondaryDimensions={(hasFilters ? fullSeasonRadar : leagueRadar) ?? []}
            secondaryLabel={hasFilters ? 'Full Season' : 'League Avg (100)'}
            secondaryColor={hasFilters ? '#ffd54f' : '#ffd54f'}
            {...(pitcher.dim_ci && { ciBands: pitcher.dim_ci })}
          />
        </div>

        <div className="card">
          <h3 className="card-title">Dimension Breakdown</h3>
          {DIMENSION_KEYS.map((d) => (
            <DimensionPanel
              key={d}
              dimKey={d}
              pitcher={pitcher}
              weight={weights[d]}
              {...(filteredScores?.dimensions[d] !== undefined && { filteredScore: filteredScores.dimensions[d] })}
              {...(filteredMetrics && { filteredMetrics })}
              hasFilters={hasFilters && filteredPitches.length > 0}
              fullSeasonOnly={fullSeasonOnly}
            />
          ))}
        </div>
      </div>

      </>}

      {/* ══════════════════════ ARSENAL TAB ══════════════════════ */}
      {activeTab === 'arsenal' && <>

      {/* Per-Pitch-Type Grades (TJStats-style) */}
      {pitchTypeGrades.length > 0 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 14 }}>
            Pitch Type Grades
            {hasFilters && <span style={{ color: '#606080', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>(filtered)</span>}
          </h3>
          <PitchTypeGradeTable grades={pitchTypeGrades} />
        </div>
      )}

      {/* Pitch Arsenal with per-pitch heatmaps */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 14 }}>
          Pitch Arsenal
          {hasFilters && <span style={{ color: '#606080', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>(filtered)</span>}
        </h3>
        <PitchArsenal
          pitches={pitcherRawPitches.length > 0 ? filteredPitches : []}
          pitchTypes={pitchData}
          config={scoringConfig}
          pitchTypeNames={pitchTypeNames}
          highlightedTypes={filters.pitchTypes}
          attributesByType={attributesByType}
          onPitchTypeClick={(pt) => {
            const next = filters.pitchTypes.includes(pt)
              ? filters.pitchTypes.filter(t => t !== pt)
              : [...filters.pitchTypes, pt];
            setFilters({ ...filters, pitchTypes: next });
          }}
        />
      </div>

      {/* Pitch Sequence Matrix */}
      <SequenceMatrix pitcherId={pitcher.pitcher_id} />

      {/* What-If Arsenal Simulator */}
      {pitchData.length > 0 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 6 }}>What-If Arsenal Simulator</h3>
          <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14, marginTop: 0 }}>
            Simulate pitch mix changes and see projected Arsenal metric impact
          </p>
          <ArsenalSimulator pitchTypes={pitchData} pitchNames={pitchTypeNames} />
        </div>
      )}

      </>}

      {/* ══════════════════════ CHARTS TAB ══════════════════════ */}
      {activeTab === 'charts' && <>

      {filteredPitches.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
          No per-pitch data available for this pitcher in {season}. Charts require pitch-level data files.
        </div>
      )}

      {/* Velocity Distribution */}
      {filteredPitches.length > 30 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Pitch Velocity Distribution</h3>
          <VelocityDistribution pitches={filteredPitches} pitchTypeNames={pitchTypeNames} />
        </div>
      )}

      {/* Pitch Movement from raw data */}
      {filteredPitches.length > 0 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 14 }}>Pitch Movement Profile</h3>
          <MovementProfileChart
            pitches={filteredPitches}
            grades={pitchTypeGrades}
            pitchTypeNames={pitchTypeNames}
            width={560}
            height={380}
          />
        </div>
      )}

      {/* GameSummary: shown when game selected or filters active */}
      {(hasFilters || gameSelected) && pitcherRawPitches.length > 0 && filteredPitches.length > 0 && (
        <div className="card">
          <GameSummary
            pitches={filteredPitches}
            config={scoringConfig}
            pitchTypeNames={pitchTypeNames}
            highlightedPitchTypes={filters.pitchTypes}
            onPitchTypeClick={(pt) => {
              const current = filters.pitchTypes;
              const next = current.includes(pt)
                ? current.filter((t) => t !== pt)
                : [...current, pt];
              setFilters({ ...filters, pitchTypes: next });
            }}
            title={
              gameSelected
                ? `Game Summary — ${games[String(filters.gameId)]?.date ?? ''}`
                : `Filtered Summary (${filteredPitches.length} pitches)`
            }
          />
        </div>
      )}

      </>}

      {/* ══════════════════════ TRENDS TAB ══════════════════════ */}
      {activeTab === 'trends' && <>

      {pitcherRawPitches.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
          No per-pitch data available for this pitcher in {season}. Rolling performance and pitch trends require pitch-level data files.
        </div>
      )}

      {/* Rolling Performance */}
      {pitcherRawPitches.length > 10 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h3 className="card-title" style={{ margin: 0 }}>Rolling Performance</h3>
            <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
              {([
                { key: 'velo', label: 'Velocity' },
                { key: 'whiffRate', label: 'Whiff%' },
                { key: 'zoneRate', label: 'Zone%' },
                { key: 'cswRate', label: 'CSW%' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRollingMetric(key)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: rollingMetric === key ? 600 : 400,
                    border: `1px solid ${rollingMetric === key ? '#4a9eff' : '#2a2a3e'}`,
                    borderRadius: 4,
                    background: rollingMetric === key ? 'rgba(74,158,255,0.15)' : 'transparent',
                    color: rollingMetric === key ? '#4a9eff' : '#606080',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <RollingChart pitches={pitcherRawPitches} metric={rollingMetric} />
        </div>
      )}

      {/* Season History + Trajectory */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 14 }}>Season History</h3>
        <SeasonHistory pitcherId={pitcher.pitcher_id} />
      </div>

      {/* Count-State Heatmap (requires markov_pitch.py --merge) */}
      {pitcher.markov_count_data && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 6 }}>Count-State Profile</h3>
          <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14, marginTop: 0 }}>
            Absorption probabilities from each count via Markov chain analysis
          </p>
          <CountStateHeatmap
            countData={pitcher.markov_count_data}
            pitcherName={pitcher.pitcher_name}
          />
        </div>
      )}

      {/* Similar Pitchers */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 6 }}>Similar Pitchers</h3>
        <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14, marginTop: 0 }}>
          Pitchers with the most similar dimension profile in the current season
        </p>
        <SimilarPitchers pitcher={pitcher} n={6} />
      </div>

      </>}

      {/* ══════════════════════ RESEARCH LAB TAB ══════════════════════ */}
      {activeTab === 'research' && <>
      <NovelMetricsPanel pitcherId={pitcher.pitcher_id} />

      {ttoData && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Times Through the Order (TTO)</h3>
          <TTOChart data={ttoData} pitchTypeNames={pitchTypeNames} />
        </div>
      )}
      </>}

      {/* ══════════════════════ GAME LOG TAB ══════════════════════ */}
      {activeTab === 'gamelog' && (
        pitcherRawPitches.length > 0 ? (
          <div className="card">
            <h3 className="card-title">Game Log</h3>
            <GameLog
              pitches={pitcherRawPitches}
              games={games}
              pitcherTeam={pitcher.pitcher_team}
              pitcherId={pitcher.pitcher_id}
              selectedGameId={filters.gameId}
              onSelectGame={(gid) => setFilters({ ...filters, gameId: gid })}
              pitcherGameGrades={gameGradesData?.[String(pitcher.pitcher_id)] ?? null}
            />
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
            No per-pitch game log data available for this pitcher in {season}.
          </div>
        )
      )}
    </div>
  );
}


// ─── Legacy Arsenal Table (from pitch_types.json) ────────────────────────────

function ArsenalTableLegacy({
  pitchData,
  leagueAverages,
}: {
  pitchData: import('../types').PitchType[];
  leagueAverages: Record<string, import('../types').LeagueAvg>;
}) {
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Pitch', 'Usage%', 'Velo', 'Perc Velo', 'Spin', 'iVB', 'HBreak', 'Ext', 'Whiff%'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 10px',
                      color: '#a0a0b8',
                      borderBottom: '2px solid #1e1e2e',
                      background: '#14141f',
                      textAlign: h === 'Pitch' ? 'left' : 'right',
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {pitchData
              .slice()
              .sort((a, b) => b.usage_pct - a.usage_pct)
              .map((p) => {
                const lg = leagueAverages[p.pitch_type];
                function diff(val: number, avg: number, higher = true) {
                  const d = val - avg;
                  const good = higher ? d > 0 : d < 0;
                  const pct = Math.abs(d) / (avg || 1);
                  const intensity = Math.min(pct * 3, 1);
                  if (pct < 0.02) return 'transparent';
                  return good
                    ? `rgba(212,64,64,${intensity * 0.4})`
                    : `rgba(58,80,128,${intensity * 0.4})`;
                }
                return (
                  <tr key={p.pitch_type} style={{ borderBottom: '1px solid #1e1e2e' }}>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: pitchColor(p.pitch_type),
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: '#e0e0e8' }}>{p.pitch_name}</span>
                        <span style={{ color: '#606080', fontSize: 11 }}>({p.pitch_type})</span>
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#a0a0b8' }}>
                      {(p.usage_pct * 100).toFixed(1)}%
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        background: lg ? diff(p.velo, lg.velo) : 'transparent',
                        color: '#e0e0e8',
                      }}
                    >
                      {p.velo.toFixed(1)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e0e0e8' }}>
                      {p.perc_velo.toFixed(1)}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        background: lg ? diff(p.spin, lg.spin) : 'transparent',
                        color: '#e0e0e8',
                      }}
                    >
                      {Math.round(p.spin)}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e0e0e8' }}>
                      {p.ivb.toFixed(1)}"
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e0e0e8' }}>
                      {p.hb.toFixed(1)}"
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        background: lg ? diff(p.ext, lg.ext) : 'transparent',
                        color: '#e0e0e8',
                      }}
                    >
                      {p.ext.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        background: diff(p.whiff_rate, 0.2),
                        color: '#e0e0e8',
                      }}
                    >
                      {(p.whiff_rate * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p style={{ color: '#606060', fontSize: 11, marginTop: 8 }}>
        Cell shading = vs league average for that pitch type (green = above avg, red = below avg)
      </p>
    </div>
  );
}
