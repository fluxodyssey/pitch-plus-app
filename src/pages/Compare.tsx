import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../data/useData';
import { usePitchData } from '../data/usePitchData';
import { useScoringConfig } from '../data/useScoringConfig';
import { GradeBadge } from '../components/GradeBadge';
import { DimensionRadarChart } from '../components/DimensionRadarChart';
import { ComparisonBars } from '../components/ComparisonBars';
import { PitchTypeGradeTable } from '../components/PitchTypeGradeTable';
import { computePitchTypeGrades } from '../data/computePitchTypeGrades';
import { gradeColor, DIMENSION_LABELS } from '../data/constants';
import type { Pitcher, DimensionKey } from '../types';

const DIMS: DimensionKey[] = ['stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal'];

export function Compare() {
  const { id1, id2 } = useParams<{ id1?: string; id2?: string }>();
  const navigate = useNavigate();
  const { data } = useData();
  const { config: scoringConfig } = useScoringConfig();

  const pitchers = data?.pitchers.pitchers ?? [];

  const pitcherA = useMemo(() => pitchers.find(p => String(p.pitcher_id) === id1), [pitchers, id1]);
  const pitcherB = useMemo(() => pitchers.find(p => String(p.pitcher_id) === id2), [pitchers, id2]);

  // Load pitch data for both pitchers
  const dataA = usePitchData();
  const dataB = usePitchData();

  useEffect(() => {
    if (pitcherA) dataA.loadForPitcher(pitcherA.pitcher_id);
  }, [pitcherA?.pitcher_id]);

  useEffect(() => {
    if (pitcherB) dataB.loadForPitcher(pitcherB.pitcher_id);
  }, [pitcherB?.pitcher_id]);

  // Pitch type grades
  const gradesA = useMemo(() => {
    if (!dataA.pitches.length || !scoringConfig) return [];
    return computePitchTypeGrades(dataA.pitches, scoringConfig.league_averages as any);
  }, [dataA.pitches, scoringConfig]);

  const gradesB = useMemo(() => {
    if (!dataB.pitches.length || !scoringConfig) return [];
    return computePitchTypeGrades(dataB.pitches, scoringConfig.league_averages as any);
  }, [dataB.pitches, scoringConfig]);

  // Radar data
  const radarA = pitcherA ? DIMS.map(d => ({ dimension: d, score: pitcherA.dimensions[d].score })) : [];
  const radarB = pitcherB ? DIMS.map(d => ({ dimension: d, score: pitcherB.dimensions[d].score })) : [];

  const handleSelectA = (p: Pitcher) => {
    navigate(id2 ? `/compare/${p.pitcher_id}/${id2}` : `/compare/${p.pitcher_id}`);
  };
  const handleSelectB = (p: Pitcher) => {
    navigate(`/compare/${id1 ?? ''}/${p.pitcher_id}`);
  };

  return (
    <div className="page">
      <h2 style={{ margin: '0 0 16px', fontSize: 20, color: '#e0e0e8' }}>Compare Pitchers</h2>

      {/* Pitcher selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
        <PitcherSelector pitchers={pitchers} selected={pitcherA} onSelect={handleSelectA} label="Pitcher A" />
        <div style={{ color: '#606080', fontSize: 16, fontWeight: 700, paddingTop: 10 }}>VS</div>
        <PitcherSelector pitchers={pitchers} selected={pitcherB} onSelect={handleSelectB} label="Pitcher B" />
      </div>

      {/* Selected pitcher cards */}
      {pitcherA && pitcherB && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <PitcherCard pitcher={pitcherA} />
            <PitcherCard pitcher={pitcherB} />
          </div>

          {/* Comparison bars */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 14 }}>Dimension Comparison</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', gap: 0, alignItems: 'start' }}>
              <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#4a9eff' }}>{pitcherA.pitcher_name.split(' ').pop()}</div>
              <div />
              <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#ff6b6b' }}>{pitcherB.pitcher_name.split(' ').pop()}</div>
            </div>
            <ComparisonBars pitcherA={pitcherA} pitcherB={pitcherB} />
          </div>

          {/* Radar overlay */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 14 }}>Radar Comparison</h3>
            <DimensionRadarChart
              dimensions={radarA}
              secondaryDimensions={radarB}
              secondaryLabel={pitcherB.pitcher_name}
              secondaryColor="#ff6b6b"
            />
          </div>

          {/* Arsenal comparison */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 10 }}>{pitcherA.pitcher_name} Arsenal</h3>
              {gradesA.length > 0 ? (
                <PitchTypeGradeTable grades={gradesA} compact />
              ) : (
                <div style={{ color: '#606080', fontSize: 12, padding: 10 }}>Loading pitch data…</div>
              )}
            </div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 10 }}>{pitcherB.pitcher_name} Arsenal</h3>
              {gradesB.length > 0 ? (
                <PitchTypeGradeTable grades={gradesB} compact />
              ) : (
                <div style={{ color: '#606080', fontSize: 12, padding: 10 }}>Loading pitch data…</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Prompt if only one or zero selected */}
      {(!pitcherA || !pitcherB) && (
        <div style={{ textAlign: 'center', color: '#606080', padding: 40, fontSize: 14 }}>
          Select two pitchers above to compare
        </div>
      )}
    </div>
  );
}

// ─── Inline pitcher selector with search ─────────────────────────────────────

function PitcherSelector({
  pitchers,
  selected,
  onSelect,
  label,
}: {
  pitchers: Pitcher[];
  selected: Pitcher | undefined;
  onSelect: (p: Pitcher) => void;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const results = query.length >= 2
    ? pitchers.filter(p => p.pitcher_name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => { setIdx(0); }, [query]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ fontSize: 10, color: '#606080', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={selected ? selected.pitcher_name : 'Search pitcher...'}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
          if (e.key === 'Enter' && results[idx]) { onSelect(results[idx]); setQuery(''); setOpen(false); }
          if (e.key === 'Escape') setOpen(false);
        }}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 13,
          background: '#0f0f1a',
          border: '1px solid #2a2a3e',
          borderRadius: 6,
          color: '#e0e0e8',
          outline: 'none',
        }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: '#14141f',
          border: '1px solid #2a2a3e',
          borderRadius: 6,
          maxHeight: 260,
          overflowY: 'auto',
          zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {results.map((p, i) => (
            <div
              key={p.pitcher_id}
              onClick={() => { onSelect(p); setQuery(''); setOpen(false); }}
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: i === idx ? '#1a1a2e' : 'transparent',
                color: i === idx ? '#e0e0e8' : '#a0a0b8',
                fontSize: 13,
              }}
            >
              <span>{p.pitcher_name} <span style={{ color: '#606080', fontSize: 11 }}>({p.pitcher_team})</span></span>
              <GradeBadge score={p.pitch_plus} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pitcher card summary ────────────────────────────────────────────────────

function PitcherCard({ pitcher }: { pitcher: Pitcher }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <GradeBadge score={pitcher.pitch_plus} size="lg" />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e8' }}>{pitcher.pitcher_name}</div>
          <div style={{ fontSize: 12, color: '#a0a0b8' }}>
            {pitcher.pitcher_team} · {pitcher.pitcher_hand === 'L' ? 'LHP' : 'RHP'} · {pitcher.n_pitches.toLocaleString()} pitches
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {DIMS.map(d => {
              const score = pitcher.dimensions[d].score;
              return (
                <span key={d} style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: gradeColor(score),
                  background: `${gradeColor(score)}18`,
                  padding: '1px 5px',
                  borderRadius: 3,
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
