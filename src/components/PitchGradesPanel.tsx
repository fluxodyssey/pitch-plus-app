/**
 * PitchGradesPanel — sliceable per-pitch grades for ONE pitcher.
 *
 * Lives on the player profile (Grades tab). Reads graded_slices_{year}.json
 * (models/score_slice.py) — the per-pitch grade foundation aggregated to
 * grains. One table drives every view: season anchor, custom client-side
 * slice, count/hand splits, and the appearance log. Grades are 100/σ=15,
 * standardized across all pitchers at each grain and reliability-shrunk
 * toward league mean (short outings pulled toward average).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SliceFilters } from '../data/customSlice';
import { EMPTY_FILTERS, filterPitches, gradeSlice } from '../data/customSlice';
import { useData } from '../data/useData';
import { useGradedSlices } from '../data/useGradedSlices';
import { usePitchCalibration, usePitcherPitches } from '../data/usePitcherPitches';
import type { SliceGrades } from '../types';

const METRICS = [
  { key: 'quality', label: 'Quality+' },
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

const selStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border-plus)', color: 'var(--text-1)',
  borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: 12, fontFamily: 'var(--sans)',
  cursor: 'pointer',
} as const;

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ color: 'var(--text-4)', fontFamily: 'var(--sans)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      {children}
    </label>
  );
}

export function PitchGradesPanel({ pitcherId }: { pitcherId: string }) {
  const { season } = useData();
  const data = useGradedSlices(season);
  const [filters, setFilters] = useState<SliceFilters>(EMPTY_FILTERS);
  const pitchState = usePitcherPitches(season, pitcherId);
  const calibration = usePitchCalibration();

  const pitchTypes = useMemo(() => {
    if (pitchState.status !== 'ready') return [];
    return [...new Set(pitchState.rows.map((r) => r.pt))].filter(Boolean).sort();
  }, [pitchState]);

  // a pitch-type filter left over from another pitcher would be an INVISIBLE
  // active filter (controlled select with no matching option renders blank)
  useEffect(() => {
    if (filters.pitchType != null && pitchTypes.length > 0 && !pitchTypes.includes(filters.pitchType)) {
      setFilters((f) => ({ ...f, pitchType: null }));
    }
  }, [pitchTypes, filters.pitchType]);

  const custom = useMemo(() => {
    const cal = calibration.status === 'ready' ? calibration.data[String(season)] : undefined;
    if (pitchState.status !== 'ready' || !cal) return null;
    return gradeSlice(filterPitches(pitchState.rows, filters), cal);
  }, [pitchState, filters, calibration, season]);

  if (!data) return <div className="loading">Loading grades…</div>;

  const gp = data.pitchers[pitcherId];
  const countOrder = ['behind', 'even', 'ahead'];
  const handLabel: Record<string, string> = { L: 'vs LHB', R: 'vs RHB' };

  if (!gp) {
    return <div style={{ ...card, color: 'var(--text-3)' }}>No graded per-pitch data for this pitcher/season.</div>;
  }

  return (
    <div>
      <p style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 13, marginTop: 0, marginBottom: 16, maxWidth: 720 }}>
        Every pitch is scored once (leakage-safe); the same grades re-aggregate by appearance, count,
        or batter hand. 100 = MLB average, σ = 15, reliability-shrunk. Quality+ grades the pitch as
        thrown (shape + location); Stuff+ is location-free — Quality+ above Stuff+ reads as good
        command, below as poor.
      </p>

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

      {/* Custom slice: client-side filter over the raw per-pitch file */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ color: 'var(--text-2)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          Custom slice{' '}
          <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>
            (any filter, graded on the season scale)
          </span>
        </div>
        {pitchState.status === 'loading' && (
          <div style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 13 }}>Loading pitch data…</div>
        )}
        {pitchState.status === 'missing' && (
          <div style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 13 }}>
            Pitch-level export not found for this pitcher/season. Generate it with{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>python models/score_slice.py --export-pitches --years {String(season)}</code>.
          </div>
        )}
        {pitchState.status === 'ready' && calibration.status === 'loading' && (
          <div style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 13 }}>Loading calibration…</div>
        )}
        {pitchState.status === 'ready' && calibration.status === 'missing' && (
          <div style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 13 }}>
            pitch_calibration.json missing — generate it with{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>python models/score_slice.py --export-pitches</code>.
          </div>
        )}
        {pitchState.status === 'ready' && calibration.status === 'ready' && !custom && (
          <div style={{ color: 'var(--text-3)', fontFamily: 'var(--sans)', fontSize: 13 }}>
            No calibration for {String(season)} — rerun{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>python models/score_slice.py --export-pitches --years {String(season)}</code>.
          </div>
        )}
        {pitchState.status === 'ready' && custom && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', margin: '10px 0 14px' }}>
              <Labeled label="Balls">
                <select style={selStyle} value={filters.balls ?? ''}
                  onChange={(e) => setFilters({ ...filters, balls: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">Any</option>
                  {[0, 1, 2, 3].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Labeled>
              <Labeled label="Strikes">
                <select style={selStyle} value={filters.strikes ?? ''}
                  onChange={(e) => setFilters({ ...filters, strikes: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">Any</option>
                  {[0, 1, 2].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Labeled>
              <Labeled label="Batter">
                <select style={selStyle} value={filters.hand ?? ''}
                  onChange={(e) => setFilters({ ...filters, hand: e.target.value === '' ? null : (e.target.value as 'L' | 'R') })}>
                  <option value="">Any</option>
                  <option value="L">LHB</option>
                  <option value="R">RHB</option>
                </select>
              </Labeled>
              <Labeled label="Pitch">
                <select style={selStyle} value={filters.pitchType ?? ''}
                  onChange={(e) => setFilters({ ...filters, pitchType: e.target.value === '' ? null : e.target.value })}>
                  <option value="">Any</option>
                  {pitchTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Labeled>
              <Labeled label="Zone">
                <select style={selStyle} value={filters.zone ?? ''}
                  onChange={(e) => setFilters({ ...filters, zone: e.target.value === '' ? null : (e.target.value as 'in' | 'out') })}>
                  <option value="">Any</option>
                  <option value="in">In zone</option>
                  <option value="out">Out of zone</option>
                </select>
              </Labeled>
              <Labeled label="From">
                <input type="date" style={selStyle} value={filters.from ?? ''}
                  onChange={(e) => setFilters({ ...filters, from: e.target.value || null })} />
              </Labeled>
              <Labeled label="To">
                <input type="date" style={selStyle} value={filters.to ?? ''}
                  onChange={(e) => setFilters({ ...filters, to: e.target.value || null })} />
              </Labeled>
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                style={{ ...selStyle, color: 'var(--text-3)' }}
              >
                Reset
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--text-4)', fontFamily: 'var(--mono)', fontSize: 12, minWidth: 130 }}>
                {custom.n.toLocaleString()} pitches
                <br />{custom.swings.toLocaleString()} swings
              </div>
              {METRICS.map((m) => (
                <div key={m.key} style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-4)', fontFamily: 'var(--sans)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</div>
                  <GradeNum v={custom.grades[m.key]} size={22} />
                </div>
              ))}
            </div>
          </>
        )}
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
    </div>
  );
}
