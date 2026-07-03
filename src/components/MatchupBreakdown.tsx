/**
 * MatchupBreakdown.tsx — modal matchup breakdown card.
 *
 * Opened by clicking a row on the Best Matchups / HR Leaderboard boards.
 * Runs the client-side projection engine for the pair and shows: grade chips
 * for both sides, an advantage meter, a plain-English reach-base sentence,
 * and the outcome table (Reach/Hit/HR/2-3B/1B/BB/K) with delta rows vs the
 * batter's typical rates and vs the league average.
 */

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { projectMatchup } from '../data/matchupEngine';
import type { BatterOutcomesData, SimilarityData } from '../types';

export interface BreakdownTarget {
  pitcherId: number;
  batterId: number;
  pitcherName: string;
}

interface OutcomeCols {
  reach: number; hit: number; hr: number; xbh: number; single: number; bb: number; k: number;
}

const COLS: Array<{ key: keyof OutcomeCols; label: string; higherBetter: boolean }> = [
  { key: 'reach',  label: 'Reach', higherBetter: true },
  { key: 'hit',    label: 'Hit',   higherBetter: true },
  { key: 'hr',     label: 'HR',    higherBetter: true },
  { key: 'xbh',    label: '2/3B',  higherBetter: true },
  { key: 'single', label: '1B',    higherBetter: true },
  { key: 'bb',     label: 'BB',    higherBetter: true },
  { key: 'k',      label: 'K',     higherBetter: false },
];

function advantageSentence(grade: number, batterLast: string, pitcherLast: string): string {
  const mag = Math.abs(grade);
  const who = grade > 0 ? batterLast : pitcherLast;
  if (mag >= 7) return `Strong advantage for ${who}`;
  if (mag >= 4) return `Moderate advantage for ${who}`;
  if (mag >= 2) return `Slight advantage for ${who}`;
  return 'Even matchup';
}

function lastName(full: string): string {
  return full.split(' ').slice(-1)[0] ?? full;
}

function gradeChipColor(label: string): string {
  if (label.startsWith('A')) return 'var(--positive)';
  if (label.startsWith('B')) return 'var(--text-2)';
  if (label.startsWith('C')) return 'var(--amber)';
  return 'var(--negative)';
}

// inverse of the engine's gradeLabel, for the pitcher's side of the same axis
function gradeLabelFor(grade: number): string {
  if (grade >= 8)  return 'A+';
  if (grade >= 5)  return 'A';
  if (grade >= 2)  return 'B+';
  if (grade >= -1) return 'B';
  if (grade >= -4) return 'C+';
  if (grade >= -7) return 'C';
  return 'D';
}

function pctCell(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function MatchupBreakdown({
  target, similarityData, batterOutcomes, onClose,
}: {
  target: BreakdownTarget;
  similarityData: SimilarityData;
  batterOutcomes: BatterOutcomesData;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { pitcherId, batterId, pitcherName } = target;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const proj = useMemo(
    () => projectMatchup(pitcherId, batterId, similarityData, batterOutcomes),
    [pitcherId, batterId, similarityData, batterOutcomes],
  );

  const batterProfile = batterOutcomes[String(batterId)];
  const pitcherHand = similarityData[String(pitcherId)]?.hand ?? '?';

  // league PA-weighted baseline — stands in for "batters facing this pitcher",
  // which the client data can't know (batter_outcomes is keyed by batter)
  const league = useMemo<OutcomeCols>(() => {
    let pa = 0;
    const sum = { single: 0, xbh: 0, hr: 0, bb: 0, k: 0 };
    for (const b of Object.values(batterOutcomes)) {
      const o = b.overall;
      const n = o?.n_pa ?? 0;
      if (!o || n <= 0) continue;
      pa += n;
      sum.single += (o.single_pct ?? 0) * n;
      sum.xbh    += ((o.double_pct ?? 0) + (o.triple_pct ?? 0)) * n;
      sum.hr     += (o.hr_pct ?? 0) * n;
      sum.bb     += (o.bb_pct ?? 0) * n;
      sum.k      += (o.k_pct ?? 0) * n;
    }
    const f = pa > 0 ? 1 / pa : 0;
    const single = sum.single * f, xbh = sum.xbh * f, hr = sum.hr * f, bb = sum.bb * f, k = sum.k * f;
    const hit = single + xbh + hr;
    return { reach: hit + bb, hit, hr, xbh, single, bb, k };
  }, [batterOutcomes]);

  // Portal to <body>: .card ancestors keep a filled transform animation, which
  // makes them containing blocks for position:fixed — un-portaled, the overlay
  // would pin to the card instead of the viewport.
  if (!proj || !batterProfile?.overall) {
    return createPortal(
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.62)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
        <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
            No projection available
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '0 0 16px' }}>
            {pitcherName} isn't in the similarity data (too few pitches this season),
            so the matchup engine can't project this pairing.
          </p>
          <button onClick={onClose} style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-plus)', color: 'var(--text-2)',
            borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)',
          }}>Close</button>
        </div>
      </div>,
      document.body,
    );
  }

  const o = proj.outcomes;
  const pred: OutcomeCols = {
    reach: o.reach_pct, hit: o.hit_pct, hr: o.hr_pct,
    xbh: o.double_triple_pct, single: o.single_pct, bb: o.bb_pct, k: o.k_pct,
  };
  const bo = batterProfile.overall;
  const batterTypical: OutcomeCols = (() => {
    const single = bo.single_pct ?? 0, xbh = (bo.double_pct ?? 0) + (bo.triple_pct ?? 0),
          hr = bo.hr_pct ?? 0, bb = bo.bb_pct ?? 0, k = bo.k_pct ?? 0;
    const hit = single + xbh + hr;
    return { reach: hit + bb, hit, hr, xbh, single, bb, k };
  })();

  const batterName = batterProfile.name;
  const batterLast = lastName(batterName);
  const pitcherLast = lastName(pitcherName);
  const batterGrade = proj.grade_label;
  const pitcherGrade = gradeLabelFor(-proj.grade);
  const meterPos = ((proj.grade + 10) / 20) * 100; // 0 = pitcher edge, 100 = batter edge
  const meterColor = proj.grade > 1 ? 'var(--positive)' : proj.grade < -1 ? 'var(--negative)' : 'var(--text-3)';
  const reachDelta = pred.reach - batterTypical.reach;

  const th = {
    padding: '6px 8px', color: 'var(--text-3)', fontWeight: 600 as const, fontSize: 11,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, textAlign: 'center' as const,
  };

  const deltaCell = (d: number, higherBetter: boolean, key: string) => {
    const good = higherBetter ? d > 0.005 : d < -0.005;
    const bad  = higherBetter ? d < -0.005 : d > 0.005;
    const color = good ? 'var(--positive)' : bad ? 'var(--negative)' : 'var(--text-3)';
    return (
      <td key={key} style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12.5, color, fontWeight: 600 }}>
        {d > 0 ? '+' : ''}{(d * 100).toFixed(1)}
      </td>
    );
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.62)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-plus)',
          borderRadius: 'var(--radius-lg)', padding: '22px 24px', width: 'min(94vw, 640px)',
          maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
        }}
      >
        {/* Header: batter VS pitcher with per-side grade chips */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'start', marginBottom: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: 16 }}>{batterName}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
              {batterProfile.team} · {batterProfile.hand}HB
            </div>
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                color: gradeChipColor(batterGrade), fontWeight: 800, fontSize: 24,
                fontFamily: 'var(--mono)', lineHeight: 1,
              }}>{batterGrade}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'left' }}>
                matchup for<br />{batterLast}
              </span>
            </div>
          </div>
          <div style={{ color: 'var(--text-4)', fontWeight: 700, fontSize: 13, paddingTop: 20 }}>VS</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: 16 }}>{pitcherName}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{pitcherHand}HP</div>
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                color: gradeChipColor(pitcherGrade), fontWeight: 800, fontSize: 24,
                fontFamily: 'var(--mono)', lineHeight: 1,
              }}>{pitcherGrade}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'left' }}>
                matchup for<br />{pitcherLast}
              </span>
            </div>
          </div>
        </div>

        {/* Advantage meter */}
        <div style={{ margin: '0 8px 4px' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {advantageSentence(proj.grade, batterLast, pitcherLast)}
          </div>
          <div style={{ position: 'relative', height: 26, margin: '0 12px' }}>
            <div style={{
              position: 'absolute', top: 11, left: 0, right: 0, height: 4,
              background: 'var(--bg-elevated)', borderRadius: 2,
            }} />
            <div style={{
              position: 'absolute', top: 0, left: `${meterPos}%`, transform: 'translateX(-50%)',
              width: 26, height: 26, borderRadius: '50%', background: meterColor,
              color: '#0b0b0c', fontWeight: 800, fontSize: 13, fontFamily: 'var(--mono)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{Math.abs(proj.grade)}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-4)', fontSize: 10.5, margin: '2px 6px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <span>{pitcherLast} edge</span><span>{batterLast} edge</span>
          </div>
        </div>

        {/* Plain-English summary */}
        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.55, margin: '14px 0 16px' }}>
          <strong style={{ color: 'var(--text-1)' }}>{batterName}</strong> has a{' '}
          <strong style={{ color: 'var(--text-1)' }}>{pctCell(pred.reach)} chance</strong> of reaching base
          vs {pitcherName}, which is{' '}
          <strong style={{ color: reachDelta >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
            {Math.abs(reachDelta * 100).toFixed(1)}% {reachDelta >= 0 ? 'higher' : 'lower'}
          </strong>{' '}
          than {batterLast}'s typical expectations. Based on {proj.n_similar_with_data} similar-pitcher
          matchup{proj.n_similar_with_data === 1 ? '' : 's'} · {proj.confidence} confidence.
        </p>

        {/* Outcome table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ ...th, textAlign: 'left' }}></th>
                {COLS.map(c => <th key={c.key} style={th}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <td style={{ padding: '6px 8px', color: 'var(--text-1)', fontWeight: 700, fontSize: 12.5 }}>Prediction</td>
                {COLS.map(c => (
                  <td key={c.key} style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--text-1)', fontWeight: 700 }}>
                    {pctCell(pred[c.key])}
                  </td>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', color: 'var(--text-2)', fontSize: 12.5, whiteSpace: 'nowrap' }}>vs {batterLast}'s norm</td>
                {COLS.map(c => deltaCell(pred[c.key] - batterTypical[c.key], c.higherBetter, c.key))}
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', color: 'var(--text-2)', fontSize: 12.5, whiteSpace: 'nowrap' }}>vs league avg</td>
                {COLS.map(c => deltaCell(pred[c.key] - league[c.key], c.higherBetter, c.key))}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 6 }}>
          Delta rows in percentage points. Green = good for the hitter. League row is the PA-weighted
          MLB average (per-pitcher allowed rates aren't in the client data).
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid var(--border-plus)', color: 'var(--text-2)',
              borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--sans)',
            }}
          >Close</button>
          <button
            onClick={() => navigate(`/matchup/${pitcherId}/${batterId}`)}
            style={{
              background: 'var(--accent)', border: 'none', color: '#fff',
              borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)',
            }}
          >Full projection →</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
