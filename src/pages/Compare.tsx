import { useMemo, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useData, type Season } from '../data/useData';
import { usePitchData } from '../data/usePitchData';
import { useScoringConfig } from '../data/useScoringConfig';
import { GradeBadge } from '../components/GradeBadge';
import { DimensionRadarChart } from '../components/DimensionRadarChart';
import { InlineSearch } from '../components/InlineSearch';
import { computePitchTypeGrades, type LeagueAvgDetailed } from '../data/computePitchTypeGrades';
import { gradeColor, DIMENSION_LABELS } from '../data/constants';
import type { Pitcher, DimensionKey, RawPitch } from '../types';

const DIMS: DimensionKey[] = ['stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal'];
const MAX_PITCHERS = 5;

// A palette of distinct colors for the comparison series
const SERIES_COLORS = ['#4a9eff', '#ff6b6b', '#34d399', '#fbbf24', '#a78bfa'];

/** One comparison slot: loads pitch-level data whenever its pitcher changes. */
function usePitchSlot(season: Season, pitcher: Pitcher | undefined): RawPitch[] {
  const { loadForPitcher, pitches } = usePitchData(season);
  const pitcherId = pitcher?.pitcher_id;
  useEffect(() => {
    if (pitcherId != null) loadForPitcher(pitcherId);
  }, [pitcherId, loadForPitcher]);
  return pitches;
}

export function Compare() {
  // Support both old route params (/compare/:id1/:id2) and new query params (?ids=1,2,3)
  const { id1, id2 } = useParams<{ id1?: string; id2?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, season } = useData();
  const { config: scoringConfig } = useScoringConfig();

  const pitchers = useMemo(() => data?.pitchers.pitchers ?? [], [data]);

  // Resolve pitcher IDs — prefer ?ids= param, fall back to route params
  const [ids, setIds] = useState<number[]>(() => {
    const idsParam = searchParams.get('ids');
    if (idsParam) return idsParam.split(',').map(Number).filter(Boolean).slice(0, MAX_PITCHERS);
    const routeIds = [id1, id2].filter(Boolean).map(Number).filter(Boolean);
    return routeIds;
  });

  // Sync ids → URL search param
  const idsKey = ids.join(',');
  useEffect(() => {
    if (idsKey) {
      setSearchParams({ ids: idsKey }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [idsKey, setSearchParams]);

  const selectedPitchers = useMemo(
    () => ids.map(id => pitchers.find(p => p.pitcher_id === id)).filter(Boolean) as Pitcher[],
    [pitchers, ids],
  );

  // One fixed slot per MAX_PITCHERS — hooks must be called unconditionally.
  const pitches0 = usePitchSlot(season, selectedPitchers[0]);
  const pitches1 = usePitchSlot(season, selectedPitchers[1]);
  const pitches2 = usePitchSlot(season, selectedPitchers[2]);
  const pitches3 = usePitchSlot(season, selectedPitchers[3]);
  const pitches4 = usePitchSlot(season, selectedPitchers[4]);

  const pitchGrades = useMemo(() => {
    const pitchesBySlot = [pitches0, pitches1, pitches2, pitches3, pitches4];
    return selectedPitchers.map((_, i) => {
      const pitches = pitchesBySlot[i] ?? [];
      if (!pitches.length || !scoringConfig) return [];
      return computePitchTypeGrades(pitches, scoringConfig.league_averages as unknown as Record<string, LeagueAvgDetailed>);
    });
  }, [selectedPitchers, scoringConfig, pitches0, pitches1, pitches2, pitches3, pitches4]);

  const radarSeries = selectedPitchers.map(p =>
    DIMS.map(d => ({ dimension: d, score: p.dimensions[d]?.score ?? 0 }))
  );

  const addPitcher = (p: Pitcher) => {
    if (ids.includes(p.pitcher_id)) return;
    setIds(prev => [...prev, p.pitcher_id].slice(0, MAX_PITCHERS));
  };

  const removePitcher = (id: number) => setIds(prev => prev.filter(x => x !== id));

  const canAdd = ids.length < MAX_PITCHERS;
  const unselected = pitchers.filter(p => !ids.includes(p.pitcher_id));

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#e0e0e8' }}>
          Compare Pitchers
          <span style={{ fontSize: 12, color: '#606080', fontWeight: 400, marginLeft: 10 }}>
            {selectedPitchers.length}/{MAX_PITCHERS} selected
          </span>
        </h2>
        {ids.length > 0 && (
          <button
            onClick={() => setIds([])}
            style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #2a2a3e', background: 'transparent', color: '#606080', cursor: 'pointer' }}
          >
            Clear all ×
          </button>
        )}
      </div>

      {/* Pitcher selector row */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Selected pitcher chips */}
          {selectedPitchers.map((p, i) => (
            <div key={p.pitcher_id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: `${SERIES_COLORS[i]}18`, border: `1px solid ${SERIES_COLORS[i]}50`,
              borderRadius: 20, padding: '5px 12px', fontSize: 13, color: SERIES_COLORS[i],
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SERIES_COLORS[i], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{p.pitcher_name}</span>
              <span style={{ color: '#606080', fontSize: 11 }}>({p.pitcher_team})</span>
              <button onClick={() => removePitcher(p.pitcher_id)} style={{ background: 'none', border: 'none', color: '#606080', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          ))}

          {/* Add pitcher search */}
          {canAdd && (
            <div style={{ width: 240 }}>
              <InlineSearch<Pitcher>
                items={unselected}
                getKey={p => p.pitcher_id}
                getLabel={p => p.pitcher_name}
                value={null}
                onSelect={addPitcher}
                placeholder={ids.length === 0 ? 'Add pitcher…' : '+ Add another…'}
                maxResults={8}
                clearOnSelect
                renderItem={(p) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{p.pitcher_name} <span style={{ color: '#606080', fontSize: 11 }}>({p.pitcher_team})</span></span>
                    <GradeBadge score={p.pitch_plus} size="sm" />
                  </div>
                )}
              />
            </div>
          )}
        </div>
      </div>

      {selectedPitchers.length === 0 && (
        <div style={{ textAlign: 'center', color: '#606080', padding: 48, fontSize: 14 }}>
          Add up to {MAX_PITCHERS} pitchers above to compare
        </div>
      )}

      {selectedPitchers.length >= 1 && (
        <>
          {/* Pitcher cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selectedPitchers.length, 3)}, 1fr)`, gap: 12, marginBottom: 20 }}>
            {selectedPitchers.map((p, i) => (
              <PitcherCard key={p.pitcher_id} pitcher={p} color={SERIES_COLORS[i] ?? '#888'} />
            ))}
          </div>

          {/* Radar overlay */}
          {selectedPitchers.length >= 2 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 className="card-title" style={{ margin: 0 }}>Radar Comparison</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {selectedPitchers.map((p, i) => (
                    <span key={p.pitcher_id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: SERIES_COLORS[i] }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: SERIES_COLORS[i], display: 'inline-block' }} />
                      {p.pitcher_name.split(' ').pop()}
                    </span>
                  ))}
                </div>
              </div>
              <DimensionRadarChart
                dimensions={radarSeries[0] ?? []}
                color={SERIES_COLORS[0] ?? '#888'}
                secondaryDimensions={radarSeries[1] ?? []}
                secondaryColor={SERIES_COLORS[1] ?? '#888'}
                secondaryLabel={selectedPitchers[1]?.pitcher_name ?? ''}
                extraSeries={selectedPitchers.slice(2).map((p, i) => ({
                  dimensions: radarSeries[i + 2] ?? [],
                  color: SERIES_COLORS[i + 2] ?? '#888',
                  label: p.pitcher_name,
                }))}
              />
            </div>
          )}

          {/* Dimension comparison bars */}
          {selectedPitchers.length >= 2 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 className="card-title" style={{ marginBottom: 14 }}>Dimension Scores</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#606080', fontWeight: 500 }}>Dimension</th>
                      {selectedPitchers.map((p, i) => (
                        <th key={p.pitcher_id} style={{ padding: '6px 10px', textAlign: 'center', color: SERIES_COLORS[i], fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {p.pitcher_name.split(' ').pop()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DIMS.map(d => (
                      <tr key={d} style={{ borderBottom: '1px solid #1e1e2e' }}>
                        <td style={{ padding: '6px 10px', color: '#a0a0b8', fontSize: 12 }}>{DIMENSION_LABELS[d]}</td>
                        {selectedPitchers.map((p) => {
                          const score = p.dimensions[d]?.score ?? 0;
                          return (
                            <td key={p.pitcher_id} style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <span style={{ color: gradeColor(score), fontWeight: 700 }}>{score}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #2a2a3e' }}>
                      <td style={{ padding: '8px 10px', color: '#e0e0e8', fontWeight: 600 }}>Pitch+</td>
                      {selectedPitchers.map((p) => (
                        <td key={p.pitcher_id} style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <GradeBadge score={p.pitch_plus} size="sm" />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Arsenal comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selectedPitchers.length, 3)}, 1fr)`, gap: 12 }}>
            {selectedPitchers.map((p, i) => (
              <div key={p.pitcher_id} className="card">
                <h3 className="card-title" style={{ marginBottom: 10, color: SERIES_COLORS[i] }}>
                  {p.pitcher_name} Arsenal
                </h3>
                {(pitchGrades[i]?.length ?? 0) > 0 ? (
                  <PitchTypeGradeTableCompact grades={pitchGrades[i] ?? []} />
                ) : (
                  <div style={{ color: '#606080', fontSize: 12, padding: 10 }}>Loading pitch data…</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Pitcher card ─────────────────────────────────────────────────────────────

function PitcherCard({ pitcher, color }: { pitcher: Pitcher; color: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <GradeBadge score={pitcher.pitch_plus} size="lg" />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e8' }}>{pitcher.pitcher_name}</div>
          <div style={{ fontSize: 12, color: '#a0a0b8' }}>
            {pitcher.pitcher_team} · {pitcher.pitcher_hand === 'L' ? 'LHP' : 'RHP'} · {pitcher.n_pitches.toLocaleString()} pitches
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {DIMS.map(d => {
              const score = pitcher.dimensions[d]?.score ?? 0;
              return (
                <span key={d} style={{
                  fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                  color: gradeColor(score), background: `${gradeColor(score)}18`,
                  padding: '1px 5px', borderRadius: 3,
                }}>
                  {DIMENSION_LABELS[d].slice(0, 3).toUpperCase()} {score}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline pitch grade table ─────────────────────────────────────────────────

function PitchTypeGradeTableCompact({ grades }: { grades: ReturnType<typeof computePitchTypeGrades> }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          {['Type', 'Velo', 'Grade', 'Usage'].map(h => (
            <th key={h} style={{ padding: '4px 6px', color: '#606080', fontWeight: 500, textAlign: h === 'Type' ? 'left' : 'center', borderBottom: '1px solid #1e1e2e' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grades.map(g => (
          <tr key={g.pitchType} style={{ borderBottom: '1px solid #111118' }}>
            <td style={{ padding: '4px 6px', color: '#e0e0e8' }}>{g.pitchName}</td>
            <td style={{ padding: '4px 6px', color: '#a0a0b8', textAlign: 'center', fontFamily: 'monospace' }}>
              {g.avgVelo?.toFixed(1) ?? '—'}
            </td>
            <td style={{ padding: '4px 6px', textAlign: 'center' }}>
              <GradeBadge score={g.stuffGrade} size="sm" />
            </td>
            <td style={{ padding: '4px 6px', color: '#a0a0b8', textAlign: 'center' }}>
              {`${(g.usagePct * 100).toFixed(0)}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
