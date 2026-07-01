/**
 * PitchGrades.tsx — sliceable per-pitch grades.
 *
 * Route: /grades
 * Reads graded_slices_{year}.json (models/score_slice.py) — the per-pitch grade
 * foundation aggregated to grains. ONE table drives every view: pick a pitcher,
 * see the same grades by appearance, by count state, and by batter hand. Grades
 * are 100/σ=15, standardized across all pitchers at each grain and reliability-
 * shrunk toward league mean (short outings pulled toward average).
 */
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../data/useData';
import { useGradedSlices } from '../data/useGradedSlices';
import type { SliceGrades } from '../types';

const METRICS = [
  { key: 'stuff', label: 'Stuff+' },
  { key: 'xwhiff', label: 'xWhiff+' },
  { key: 'whiff', label: 'Whiff+' },
  { key: 'velo', label: 'Velo+' },
] as const;

function gradeColor(v: number | null): string {
  if (v == null) return 'var(--text-4)';
  if (v >= 112) return 'var(--positive)';
  if (v <= 88) return 'var(--negative)';
  if (v >= 105) return 'var(--text-1)';
  if (v <= 95) return 'var(--amber)';
  return 'var(--text-2)';
}

function GradeNum({ v, size = 14 }: { v: number | null; size?: number }) {
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: size, fontWeight: 600, color: gradeColor(v) }}>
      {v == null ? '—' : v}
    </span>
  );
}

function GradeRow({ g, n, label }: { g: SliceGrades; n?: number; label: string }) {
  return (
    <tr>
      <td style={{ padding: '6px 10px', color: 'var(--text-2)', fontFamily: 'var(--sans)', fontSize: 13 }}>{label}</td>
      {typeof n === 'number' && (
        <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-4)', fontFamily: 'var(--mono)', fontSize: 12 }}>{n}</td>
      )}
      {METRICS.map((m) => (
        <td key={m.key} style={{ padding: '6px 10px', textAlign: 'right' }}>
          <GradeNum v={g[m.key]} />
        </td>
      ))}
    </tr>
  );
}

function TableHead({ withN }: { withN?: boolean }) {
  const th = { padding: '6px 10px', textAlign: 'right' as const, color: 'var(--text-4)', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' };
  return (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border-plus)' }}>
        <th style={{ ...th, textAlign: 'left' }}>&nbsp;</th>
        {withN && <th style={th}>P</th>}
        {METRICS.map((m) => <th key={m.key} style={th}>{m.label}</th>)}
      </tr>
    </thead>
  );
}

const card = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: 16,
};

export function PitchGrades() {
  const { season } = useData();
  const data = useGradedSlices(season);
  const [pid, setPid] = useState<string>('');

  const pitchers = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.pitchers)
      .map(([id, p]) => ({ id, name: p.name, n: p.n }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // default to the most-pitches pitcher; keep selection across seasons if still present
  useEffect(() => {
    if (!data) return;
    if (pid && data.pitchers[pid]) return;
    const best = Object.entries(data.pitchers).sort((a, b) => b[1].n - a[1].n)[0]?.[0] ?? '';
    setPid(best);
  }, [data, pid]);

  if (!data) return <div className="loading">Loading grades…</div>;

  const gp = pid ? data.pitchers[pid] : undefined;
  const countOrder = ['behind', 'even', 'ahead'];
  const handLabel: Record<string, string> = { L: 'vs LHB', R: 'vs RHB' };

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--sans)', color: 'var(--text-1)', fontSize: 24, marginBottom: 4 }}>
        Pitch Grades
      </h1>
      <p style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 13, marginTop: 0, marginBottom: 18, maxWidth: 720 }}>
        One per-pitch grade table, sliced. Every pitch is scored once (leakage-safe); the same grades
        re-aggregate by appearance, count, or batter hand. 100 = MLB average, σ = 15, reliability-shrunk
        (short outings pull toward average). Use the season picker in the nav to change year.
      </p>

      <select
        value={pid}
        onChange={(e) => setPid(e.target.value)}
        style={{
          background: 'var(--bg-input)', border: '1px solid var(--border-plus)', color: 'var(--text-1)',
          borderRadius: 'var(--radius-sm)', padding: '7px 12px', fontSize: 14, fontFamily: 'var(--sans)',
          marginBottom: 20, minWidth: 260, cursor: 'pointer',
        }}
      >
        {pitchers.map((p) => (
          <option key={p.id} value={p.id}>{p.name} ({p.n})</option>
        ))}
      </select>

      {!gp ? (
        <div style={{ ...card, color: 'var(--text-3)' }}>No graded data for this pitcher.</div>
      ) : (
        <>
          {/* Season anchor */}
          <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--text-1)', fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 600 }}>{gp.name}</div>
              <div style={{ color: 'var(--text-4)', fontFamily: 'var(--sans)', fontSize: 12 }}>
                {gp.hand ? `${gp.hand}HP · ` : ''}{gp.n.toLocaleString()} pitches · {gp.games.length} appearances · season
              </div>
            </div>
            {METRICS.map((m) => (
              <div key={m.key} style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--text-4)', fontFamily: 'var(--sans)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</div>
                <GradeNum v={gp.season[m.key]} size={26} />
              </div>
            ))}
          </div>

          {/* Splits: count state + batter hand */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div style={card}>
              <div style={{ color: 'var(--text-2)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>By count state</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <TableHead withN />
                <tbody>
                  {countOrder.map((c) => {
                    const cell = gp.counts[c];
                    return cell ? <GradeRow key={c} g={cell} n={cell.n} label={c} /> : null;
                  })}
                </tbody>
              </table>
            </div>
            <div style={card}>
              <div style={{ color: 'var(--text-2)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>By batter hand</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <TableHead withN />
                <tbody>
                  {['L', 'R'].map((h) => {
                    const cell = gp.hands[h];
                    return cell ? <GradeRow key={h} g={cell} n={cell.n} label={handLabel[h] ?? h} /> : null;
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Game log */}
          <div style={card}>
            <div style={{ color: 'var(--text-2)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Appearance log <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>(most recent first)</span>
            </div>
            <div style={{ maxHeight: 440, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <TableHead withN />
                <tbody>
                  {[...gp.games].reverse().map((g) => (
                    <GradeRow key={g.date + g.n} g={g} n={g.n} label={g.date} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
