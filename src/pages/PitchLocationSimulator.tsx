/**
 * PitchLocationSimulator.tsx — Pitch Location Simulator
 *
 * Route: /simulator
 * Fits a 2-D Gaussian to a pitcher's actual plate locations for a chosen
 * (pitch type × batter hand) cell, then lets the user "throw" simulated pitches
 * sampled from it. Three catcher's-view panels compare:
 *   1. Generated  — the simulated pitches thrown so far (scatter)
 *   2. Simulated  — the fitted Gaussian's density (smooth contour)
 *   3. Actual     — the real pitches' empirical density (smoothed histogram)
 *
 * Pure math lives in data/locationDensity.ts; this file is UI + composition.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data/useData';
import { usePitchData } from '../data/usePitchData';
import { InlineSearch } from '../components/InlineSearch';
import { pitchColor } from '../data/constants';
import {
  fitLocationModel, sampleFromModel, densityGrid, empiricalGrid,
  PLATE_BOUNDS, STRIKE_ZONE, type PlatePoint,
} from '../data/locationDensity';
import type { Pitcher, RawPitch } from '../types';

const PITCH_NAMES: Record<string, string> = {
  FF: 'Four-Seam', SI: 'Sinker', FC: 'Cutter', SL: 'Slider', ST: 'Sweeper',
  SV: 'Slurve', CU: 'Curveball', KC: 'Knuckle-Curve', CH: 'Changeup', FS: 'Split',
};
const pName = (pt: string) => PITCH_NAMES[pt] ?? pt;

const MIN_CELL = 40; // pitches needed for a trustworthy fit

type Hand = 'all' | 'R' | 'L';
const HAND_LABEL: Record<Hand, string> = { all: 'All hitters', R: 'vs RHH', L: 'vs LHH' };

// ── Canvas panel: strike zone + optional density grid + optional sample dots ──
const CANVAS = 300;

function PlateCanvas({
  grid, points, color = '#4a9eff', label,
}: {
  grid?: number[][];
  points?: [number, number][];
  color?: string;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { xMin, xMax, zMin, zMax } = PLATE_BOUNDS;
  const xr = xMax - xMin, zr = zMax - zMin;
  const toX = useCallback((x: number) => ((x - xMin) / xr) * CANVAS, [xMin, xr]);
  const toZ = useCallback((z: number) => ((zMax - z) / zr) * CANVAS, [zMax, zr]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS * dpr;
    canvas.height = CANVAS * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    ctx.fillStyle = '#0a1120';
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    // Density grid
    if (grid && grid.length) {
      const g = grid.length;
      const cell = CANVAS / g;
      for (let j = 0; j < g; j++) {
        const row = grid[j]!;
        for (let i = 0; i < g; i++) {
          const v = row[i]!;
          if (v < 0.04) continue;
          // perceptual-ish ramp: blue → cyan → warm at the peak
          const t = Math.min(1, v);
          const r = Math.round(40 + t * 200);
          const gg = Math.round(80 + t * 90);
          const b = Math.round(200 - t * 150);
          ctx.fillStyle = `rgba(${r},${gg},${b},${0.12 + t * 0.7})`;
          ctx.fillRect(i * cell, j * cell, cell + 0.6, cell + 0.6);
        }
      }
    }

    // Sample dots
    if (points && points.length) {
      ctx.fillStyle = color + 'cc';
      ctx.strokeStyle = color;
      for (const [x, z] of points) {
        ctx.beginPath();
        ctx.arc(toX(x), toZ(z), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Strike zone
    const sz = STRIKE_ZONE;
    ctx.strokeStyle = 'rgba(120,170,255,0.65)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(toX(sz.xMin), toZ(sz.zMax), toX(sz.xMax) - toX(sz.xMin), toZ(sz.zMin) - toZ(sz.zMax));
    ctx.setLineDash([]);
  }, [grid, points, color, toX, toZ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <canvas ref={ref} style={{ width: CANVAS, height: CANVAS, maxWidth: '100%', borderRadius: 'var(--radius)' }} />
    </div>
  );
}

export function PitchLocationSimulator() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, season } = useData();
  const pitchers = useMemo<Pitcher[]>(() => data?.pitchers?.pitchers ?? [], [data]);

  const initialId = searchParams.get('pitcher') ? Number(searchParams.get('pitcher')) : null;
  const [selectedId, setSelectedId] = useState<number | null>(initialId);
  const [hand, setHand] = useState<Hand>('all');
  const [pitchType, setPitchType] = useState<string | null>(null);
  const [n, setN] = useState(50);
  const [samples, setSamples] = useState<[number, number][]>([]);

  const { loadForPitcher, pitches, loading, error } = usePitchData(season);

  useEffect(() => {
    if (selectedId) {
      loadForPitcher(selectedId);
      setSearchParams({ pitcher: String(selectedId) }, { replace: true });
    }
  }, [selectedId, loadForPitcher, setSearchParams]);

  const selectedPitcher = useMemo(
    () => pitchers.find((p) => p.pitcher_id === selectedId) ?? null,
    [pitchers, selectedId],
  );

  // Pitches matching the current hand filter, grouped by type (for the pills).
  const handPitches = useMemo<RawPitch[]>(
    () => pitches.filter((p) => hand === 'all' || p.bh === hand),
    [pitches, hand],
  );
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of handPitches) m.set(p.pt, (m.get(p.pt) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [handPitches]);

  // Auto-select the most-used pitch type when the data/filters change.
  const typesKey = typeCounts.map(([t]) => t).join(',');
  const [prevKey, setPrevKey] = useState('');
  if (typesKey !== prevKey) {
    setPrevKey(typesKey);
    const top = typeCounts[0]?.[0] ?? null;
    if (!pitchType || !typeCounts.some(([t]) => t === pitchType)) setPitchType(top);
  }

  // The selected (pitch type × hand) cell → real plate points → fitted model.
  const cellPoints = useMemo<PlatePoint[]>(
    () => handPitches.filter((p) => p.pt === pitchType).map((p) => ({ px: p.px, pz: p.pz })),
    [handPitches, pitchType],
  );
  const model = useMemo(() => fitLocationModel(cellPoints, MIN_CELL), [cellPoints]);
  const simGrid = useMemo(() => (model.ok ? densityGrid(model) : []), [model]);
  const actualGrid = useMemo(() => (cellPoints.length ? empiricalGrid(cellPoints) : []), [cellPoints]);

  // Reset accumulated throws whenever the cell changes.
  useEffect(() => { setSamples([]); }, [selectedId, hand, pitchType]);

  const throwPitches = useCallback((count: number) => {
    if (!model.ok) return;
    setSamples((prev) => {
      const next = prev.slice();
      for (let i = 0; i < count; i++) next.push(sampleFromModel(model));
      return next;
    });
  }, [model]);

  const ptColor = pitchType ? pitchColor(pitchType) : '#4a9eff';

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px 0' }}>
          Pitch Location Simulator
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>
          Fit a 2-D Gaussian to a pitcher's real plate locations, then throw simulated pitches
          sampled from it. Compare the generated pitches against the model and the real distribution.
        </p>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Pitcher</div>
            <InlineSearch<Pitcher>
              items={pitchers}
              getKey={(p) => p.pitcher_id}
              getLabel={(p) => p.pitcher_name}
              value={selectedPitcher}
              onSelect={(p) => setSelectedId(p.pitcher_id)}
              placeholder="Search pitcher…"
              maxResults={8}
            />
          </div>

          {/* Hand toggle */}
          <div>
            <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>Batter side</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'R', 'L'] as Hand[]).map((h) => (
                <button
                  key={h}
                  onClick={() => setHand(h)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    border: `1.5px solid ${hand === h ? 'var(--accent)' : 'var(--border)'}`,
                    background: hand === h ? 'var(--accent)25' : 'transparent',
                    color: hand === h ? 'var(--accent)' : 'var(--text-3)',
                    fontWeight: hand === h ? 700 : 400, fontFamily: 'var(--sans)',
                  }}
                >{HAND_LABEL[h]}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Pitch type pills */}
        {typeCounts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Pitch type</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {typeCounts.map(([pt, c]) => {
                const active = pt === pitchType;
                const color = pitchColor(pt);
                return (
                  <button
                    key={pt}
                    onClick={() => setPitchType(pt)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      border: `1.5px solid ${active ? color : 'var(--border)'}`,
                      background: active ? color + '25' : 'transparent',
                      color: active ? color : 'var(--text-3)', fontWeight: active ? 700 : 400,
                      fontFamily: 'var(--sans)',
                    }}
                  >{pName(pt)} <span style={{ opacity: 0.6 }}>{c}</span></button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Empty / loading / error states */}
      {!selectedId && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Select a pitcher to begin</div>
          <div style={{ fontSize: 13 }}>Then pick a pitch type and throw simulated pitches.</div>
        </div>
      )}
      {selectedId && loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>Loading pitch data…</div>}
      {selectedId && error && <div style={{ textAlign: 'center', padding: 48, color: 'var(--negative)' }}>{error}</div>}

      {/* Simulator */}
      {selectedId && !loading && pitchType && (
        <>
          {/* Action bar + fit-quality strip */}
          <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => throwPitches(1)} disabled={!model.ok}
              style={btn(model.ok)}>Throw 1 pitch</button>
            <button onClick={() => throwPitches(n)} disabled={!model.ok}
              style={btn(model.ok, true)}>Throw {n} pitches</button>
            <button onClick={() => setSamples([])} style={btn(true)}>Clear</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Batch</span>
              <input type="range" min={10} max={500} step={10} value={n}
                onChange={(e) => setN(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-2)', width: 36, textAlign: 'right', fontFamily: 'var(--mono)' }}>{n}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
              Thrown: <span style={{ color: 'var(--text-1)' }}>{samples.length}</span>
            </div>
          </div>

          {!model.ok && (
            <div className="card" style={{ marginBottom: 16, color: 'var(--amber)', fontSize: 13 }}>
              ⚠ Only {cellPoints.length} {pName(pitchType)}{hand !== 'all' ? ` ${HAND_LABEL[hand]}` : ''} pitches in {season}
              {' '}— need ≥ {MIN_CELL} for a reliable fit. Pick a more-used pitch type or "All hitters".
            </div>
          )}

          {/* Three panels */}
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, justifyItems: 'center' }}>
              <PlateCanvas points={samples} color={ptColor} label={`Generated (n = ${samples.length})`} />
              <PlateCanvas grid={simGrid} label="Simulated density (model)" />
              <PlateCanvas grid={actualGrid} label={`Actual (${cellPoints.length} real pitches)`} />
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>
              Catcher's view · strike zone dashed · {pName(pitchType)} {HAND_LABEL[hand]} ·{' '}
              {selectedPitcher?.pitcher_name} {season}. The model is a descriptive 2-D Gaussian, not a predictive command grade.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function btn(enabled: boolean, primary = false): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
    cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'var(--sans)',
    border: `1px solid ${primary ? 'var(--accent)' : 'var(--border)'}`,
    background: primary && enabled ? 'var(--accent)' : 'transparent',
    color: primary && enabled ? '#fff' : enabled ? 'var(--text-2)' : 'var(--text-4)',
    opacity: enabled ? 1 : 0.5,
  };
}
