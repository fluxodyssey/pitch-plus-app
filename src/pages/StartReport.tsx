/**
 * Start Report — TJStats-style breakdown of a single pitcher's game start.
 *
 * Route: /player/:id/start/:gameId
 *
 * Sections:
 *   1. Header  — pitcher, date, opponent, final line (IP, K, BB, H, ER)
 *   2. Pitch Mix — usage % per pitch type, coloured bars
 *   3. Velocity by Inning — line chart
 *   4. Location Heat Map — scatter plot by pitch type
 *   5. Count Profile — pitch distribution by ball-strike count
 *   6. Whiff / Contact table per pitch type
 *   7. Pitch Log — every pitch in sequence with result
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { exportToPng, copyToClipboard } from '../data/exportImage';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, Cell, Legend,
} from 'recharts';
import { usePitchData } from '../data/usePitchData';
import { useData } from '../data/useData';
import { useScoringConfig } from '../data/useScoringConfig';
import { pitchColor, PITCH_TYPE_COLORS } from '../data/constants';
import { computePitchTypeGrades } from '../data/computePitchTypeGrades';
import { PitchTypeGradeTable } from '../components/PitchTypeGradeTable';
import type { RawPitch } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PITCH_NAMES: Record<string, string> = {
  FF: 'Four-Seam', SI: 'Sinker', FC: 'Cutter',
  SL: 'Slider', ST: 'Sweeper', SV: 'Slurve',
  CU: 'Curveball', KC: 'Knuckle-Curve', CS: 'Slow Curve',
  CH: 'Changeup', FS: 'Split', SC: 'Screwball',
  KN: 'Knuckleball', EP: 'Eephus',
};

function pName(pt: string) { return PITCH_NAMES[pt] ?? pt; }
function pct(n: number, d: number) { return d > 0 ? (n / d * 100).toFixed(1) + '%' : '—'; }
function fmt(v: number | null | undefined, dec = 1) { return v != null ? v.toFixed(dec) : '—'; }

// ── Sub-components ────────────────────────────────────────────────────────────

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
    }}>{label}</span>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#606080', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
      <div style={{ color: '#e0e0e8', fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ color: '#606080', fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{ color: '#4a9eff', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function StartReport() {
  const { id, gameId } = useParams<{ id: string; gameId: string }>();
  const { loadForPitcher, pitches: allPitches, games, loading } = usePitchData();
  const { data: appData } = useData();
  const { config: scoringConfig } = useScoringConfig();
  const seasonPitchTypes = appData?.pitchTypes.pitchers[id!] ?? null;

  useEffect(() => {
    if (id) loadForPitcher(Number(id));
  }, [id, loadForPitcher]);

  // All pitches for this pitcher in this game
  const pitches: RawPitch[] = useMemo(() => {
    if (!id || !gameId) return [];
    return allPitches.filter(p => String(p.gid) === gameId).sort((a, b) => a.pid - b.pid);
  }, [allPitches, id, gameId]);

  const gameInfo = useMemo(() => games[gameId ?? ''], [games, gameId]);

  // ── Computed stats ─────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (!pitches.length) return null;
    const swings   = pitches.filter(p => p.sw);
    const whiffs   = pitches.filter(p => p.wh);
    const inPlay   = pitches.filter(p => p.ip);
    const strikeouts = pitches.filter(p => p.et === 'strikeout').length;
    const walks      = pitches.filter(p => p.et === 'walk').length;
    const hits       = pitches.filter(p => ['single','double','triple','home_run'].includes(p.et ?? '')).length;

    const innings = new Set(pitches.map(p => p.inn)).size;
    const avgVelo = pitches.filter(p => p.v > 0).reduce((s, p) => s + p.v, 0) /
                    pitches.filter(p => p.v > 0).length;
    const whiffRate = swings.length > 0 ? whiffs.length / swings.length : 0;
    const csw = (whiffs.length + pitches.filter(p => p.desc === 'Called Strike').length) / pitches.length;

    return { n: pitches.length, innings, strikeouts, walks, hits, avgVelo, whiffRate, csw };
  }, [pitches]);

  // Pitch type breakdown
  const pitchTypes = useMemo(() => {
    const map = new Map<string, { n: number; swings: number; whiffs: number;
                                   velos: number[]; spins: number[]; ivbs: number[]; hbs: number[] }>();
    for (const p of pitches) {
      if (!map.has(p.pt)) map.set(p.pt, { n:0, swings:0, whiffs:0, velos:[], spins:[], ivbs:[], hbs:[] });
      const row = map.get(p.pt)!;
      row.n++;
      if (p.sw) row.swings++;
      if (p.wh) row.whiffs++;
      if (p.v > 0) row.velos.push(p.v);
      if (p.sp > 0) row.spins.push(p.sp);
      if (p.ivb != null) row.ivbs.push(p.ivb);
      if (p.hb != null) row.hbs.push(p.hb);
    }
    return Array.from(map.entries())
      .map(([pt, r]) => ({
        pt,
        n: r.n,
        pct: (r.n / pitches.length * 100).toFixed(1),
        whiffRate: r.swings > 0 ? r.whiffs / r.swings : 0,
        avgVelo: r.velos.length > 0 ? r.velos.reduce((a,b)=>a+b)/r.velos.length : 0,
        avgSpin: r.spins.length > 0 ? r.spins.reduce((a,b)=>a+b)/r.spins.length : 0,
        avgIvb:  r.ivbs.length  > 0 ? r.ivbs.reduce((a,b)=>a+b)/r.ivbs.length  : 0,
        avgHb:   r.hbs.length   > 0 ? r.hbs.reduce((a,b)=>a+b)/r.hbs.length   : 0,
      }))
      .sort((a, b) => b.n - a.n);
  }, [pitches]);

  // Velo by inning
  const veloByInning = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const p of pitches) {
      if (p.v <= 0) continue;
      if (!map.has(p.inn)) map.set(p.inn, []);
      map.get(p.inn)!.push(p.v);
    }
    return Array.from(map.entries())
      .sort(([a],[b]) => a - b)
      .map(([inn, vs]) => ({
        inning: `${inn}`,
        avg: parseFloat((vs.reduce((a,b)=>a+b)/vs.length).toFixed(1)),
        max: Math.max(...vs),
      }));
  }, [pitches]);

  // Count distribution
  const countData = useMemo(() => {
    const counts = ['0-0','1-0','2-0','3-0','0-1','1-1','2-1','3-1','0-2','1-2','2-2','3-2'];
    return counts.map(c => {
      const [b, s] = c.split('-').map(Number);
      const ps = pitches.filter(p => p.b === b && p.s === s);
      return { count: c, n: ps.length };
    }).filter(r => r.n > 0);
  }, [pitches]);

  // Per-pitch-type grades
  const ptGrades = useMemo(() => {
    if (!pitches.length || !scoringConfig) return [];
    return computePitchTypeGrades(pitches, scoringConfig.league_averages as Record<string, any>);
  }, [pitches, scoringConfig]);

  // Split pitches by batter hand for location charts
  const pitchesVsLHH = useMemo(() => pitches.filter(p => p.bh === 'L'), [pitches]);
  const pitchesVsRHH = useMemo(() => pitches.filter(p => p.bh === 'R'), [pitches]);

  // HBP count
  const hbpCount = useMemo(() =>
    pitches.filter(p => p.et === 'hit_by_pitch' || p.desc?.toLowerCase().includes('hit by pitch')).length,
  [pitches]);

  // Export ref
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (mode: 'png' | 'clipboard') => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const filename = `${pitcherName.replace(/\s+/g, '_')}_${gameDate}.png`;
      if (mode === 'png') await exportToPng(exportRef.current, filename);
      else await copyToClipboard(exportRef.current);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="loading">Loading pitch data…</div>;

  if (!pitches.length) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: '#a0a0b8', marginBottom: 12 }}>No pitch data found for this start.</div>
          <Link to={`/player/${id}`} style={{ color: '#4a9eff' }}>← Back to pitcher profile</Link>
        </div>
      </div>
    );
  }

  const pitcherName = pitches[0]?.pn ?? `Pitcher ${id}`;
  const gameDate    = gameInfo?.date ?? pitches[0]?.gd ?? '';
  const opponent    = gameInfo ? `${gameInfo.away} @ ${gameInfo.home}` : '';

  return (
    <div className="page" ref={exportRef}>

      {/* ── Header ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link to={`/player/${id}`} style={{ color: '#4a9eff', fontSize: 13 }} className="no-export">← Profile</Link>
              <span style={{ color: '#2a2a3e' }} className="no-export">|</span>
              <span style={{ color: '#606080', fontSize: 13 }}>{gameDate}</span>
              {opponent && <span style={{ color: '#606080', fontSize: 13 }}>· {opponent}</span>}
            </div>
            <h1 style={{ margin: '8px 0 4px', color: '#e0e0e8', fontSize: 22 }}>{pitcherName}</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {pitchTypes.map(pt => <Pill key={pt.pt} color={pitchColor(pt.pt)} label={pName(pt.pt)} />)}
            </div>
          </div>
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              <StatBox label="Pitches" value={summary.n} />
              <StatBox label="K" value={summary.strikeouts} />
              <StatBox label="BB" value={summary.walks} />
              <StatBox label="H" value={summary.hits} />
              <StatBox label="Avg Velo" value={summary.avgVelo.toFixed(1)} sub="mph" />
              <StatBox label="Whiff%" value={(summary.whiffRate * 100).toFixed(1) + '%'} />
              <StatBox label="CSW%" value={(summary.csw * 100).toFixed(1) + '%'} />
              <StatBox label="Inn" value={summary.innings} />
              {hbpCount > 0 && <StatBox label="HBP" value={hbpCount} />}
            </div>
          )}
        </div>
        {/* Export buttons */}
        <div className="no-export" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={() => handleExport('png')}
            disabled={exporting}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600,
              border: '1px solid #2a2a3e', borderRadius: 5,
              background: 'rgba(74,158,255,0.08)', color: '#4a9eff',
              cursor: exporting ? 'wait' : 'pointer',
            }}
          >
            {exporting ? 'Exporting…' : 'Export PNG'}
          </button>
          <button
            onClick={() => handleExport('clipboard')}
            disabled={exporting}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600,
              border: '1px solid #2a2a3e', borderRadius: 5,
              background: 'transparent', color: '#a0a0b8',
              cursor: exporting ? 'wait' : 'pointer',
            }}
          >
            Copy to Clipboard
          </button>
        </div>
      </div>

      {/* ── Pitch Mix ── */}
      <Section title="Pitch Mix">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pitchTypes.map(pt => {
            const seasonPt = seasonPitchTypes?.find(s => s.pitch_type === pt.pt);
            const veloDelta = seasonPt != null && Math.abs(pt.avgVelo - seasonPt.velo) >= 0.1
              ? pt.avgVelo - seasonPt.velo : null;
            const whiffDelta = seasonPt != null && Math.abs(pt.whiffRate - seasonPt.whiff_rate) >= 0.01
              ? pt.whiffRate - seasonPt.whiff_rate : null;
            return (
              <div key={pt.pt} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 60px 90px 70px 90px 70px', gap: 8, alignItems: 'center' }}>
                <Pill color={pitchColor(pt.pt)} label={pName(pt.pt)} />
                <div style={{ height: 8, background: '#1e1e2e', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pt.pct}%`, height: '100%', background: pitchColor(pt.pt), borderRadius: 4 }} />
                </div>
                <span style={{ color: '#e0e0e8', fontSize: 13, textAlign: 'right' }}>{pt.pct}%</span>
                <span style={{ color: '#a0a0b8', fontSize: 12, textAlign: 'right' }}>
                  {pt.avgVelo.toFixed(1)} mph
                  {veloDelta != null && <span style={{ fontSize: 10, color: veloDelta > 0 ? '#69f0ae' : '#c85a5a', marginLeft: 3 }}>{veloDelta > 0 ? '+' : ''}{veloDelta.toFixed(1)}</span>}
                </span>
                <span style={{ color: '#a0a0b8', fontSize: 12, textAlign: 'right' }}>{Math.round(pt.avgSpin)} rpm</span>
                <span style={{ color: '#a0a0b8', fontSize: 12, textAlign: 'right' }}>
                  Whiff {(pt.whiffRate*100).toFixed(0)}%
                  {whiffDelta != null && <span style={{ fontSize: 10, color: whiffDelta > 0 ? '#69f0ae' : '#c85a5a', marginLeft: 3 }}>{whiffDelta > 0 ? '+' : ''}{(whiffDelta*100).toFixed(1)}</span>}
                </span>
                <span style={{ color: '#606080', fontSize: 11, textAlign: 'right' }}>{pt.n} pitches</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Velocity by inning ── */}
      {veloByInning.length >= 2 && (
        <Section title="Velocity by Inning">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={veloByInning} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="inning" tick={{ fill: '#606080', fontSize: 11 }} stroke="#2a2a3e"
                label={{ value: 'Inning', position: 'insideBottom', offset: -2, fill: '#606080', fontSize: 11 }} />
              <YAxis tick={{ fill: '#606080', fontSize: 11 }} stroke="#2a2a3e" domain={['auto', 'auto']}
                label={{ value: 'mph', angle: -90, position: 'insideLeft', fill: '#606080', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 6 }}
                labelStyle={{ color: '#a0a0b8' }} />
              <Line type="monotone" dataKey="avg" stroke="#4a9eff" strokeWidth={2} dot={{ fill: '#4a9eff', r: 4 }} name="Avg Velo" />
              <Line type="monotone" dataKey="max" stroke="#c85a5a" strokeWidth={1.5} strokeDasharray="4 2"
                dot={false} name="Max Velo" />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* ── Split Location Scatter (LHH | Pitch Breaks | RHH) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Section title={`Locations vs LHH (${pitchesVsLHH.length})`}>
          <LocationScatter pitches={pitchesVsLHH} ptList={pitchTypes} height={280} />
        </Section>

        <Section title="Pitch Breaks (iVB vs HB)">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis type="number" dataKey="hb" tick={{ fill: '#606080', fontSize: 10 }} stroke="#2a2a3e"
                label={{ value: 'HB (in)', position: 'insideBottom', offset: -10, fill: '#606080', fontSize: 10 }} />
              <YAxis type="number" dataKey="ivb" tick={{ fill: '#606080', fontSize: 10 }} stroke="#2a2a3e"
                label={{ value: 'iVB (in)', angle: -90, position: 'insideLeft', fill: '#606080', fontSize: 10 }} />
              <Tooltip cursor={false}
                contentStyle={{ background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 6, fontSize: 12 }}
                formatter={(_, __, props) => [
                  `${pName(props.payload.pt)} · ${props.payload.v.toFixed(1)} mph`,
                  `iVB ${props.payload.ivb.toFixed(1)} · HB ${props.payload.hb.toFixed(1)}`,
                ]} />
              {pitchTypes.map(pt => (
                <Scatter key={pt.pt} name={pName(pt.pt)}
                  data={pitches.filter(p => p.pt === pt.pt && p.ivb != null && p.hb != null)
                    .map(p => ({ hb: p.hb, ivb: p.ivb, pt: p.pt, v: p.v }))}
                  fill={pitchColor(pt.pt)} fillOpacity={0.7} r={4} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </Section>

        <Section title={`Locations vs RHH (${pitchesVsRHH.length})`}>
          <LocationScatter pitches={pitchesVsRHH} ptList={pitchTypes} height={280} />
        </Section>
      </div>

      {/* ── Count distribution ── */}
      <Section title="Count Profile">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
          {countData.map(c => (
            <div key={c.count} style={{
              background: '#1a1a2e', borderRadius: 6, padding: '6px 8px', textAlign: 'center',
              border: `1px solid ${c.count === '0-0' ? '#4a9eff44' : '#2a2a3e'}`,
            }}>
              <div style={{ color: '#4a9eff', fontSize: 11, fontWeight: 600 }}>{c.count}</div>
              <div style={{ color: '#e0e0e8', fontSize: 16, fontWeight: 700 }}>{c.n}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Pitch Type Grades (TJStats-style) ── */}
      {ptGrades.length > 0 && (
        <Section title="Pitch Type Grades">
          <PitchTypeGradeTable grades={ptGrades} compact />
        </Section>
      )}

      {/* ── Pitch log ── */}
      <Section title="Pitch Log">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #1e1e2e' }}>
                {['#', 'Inn', 'Count', 'Batter', 'H', 'Type', 'Velo', 'Spin', 'IVB', 'HB', 'VAA', 'Zone', 'Result'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', color: '#606080', fontWeight: 500,
                    textAlign: h === 'Batter' ? 'left' : 'center',
                    borderBottom: '1px solid #1e1e2e' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitches.map((p, i) => {
                const resultColor = p.wh ? '#d44040' : p.sw && !p.ip ? '#4a6494' : p.ip ? '#4a9eff' : '#a0a0b8';
                const resultLabel = p.et ? p.et.replace(/_/g, ' ') : p.desc;
                return (
                  <tr key={p.pid} style={{ borderBottom: '1px solid #111118', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '5px 8px', color: '#606080', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '5px 8px', color: '#a0a0b8', textAlign: 'center' }}>{p.inn}</td>
                    <td style={{ padding: '5px 8px', color: '#a0a0b8', textAlign: 'center', fontFamily: 'monospace' }}>{p.b}-{p.s}</td>
                    <td style={{ padding: '5px 8px', color: '#e0e0e8', whiteSpace: 'nowrap' }}>{p.bn}</td>
                    <td style={{ padding: '5px 8px', color: '#606080', textAlign: 'center' }}>{p.bh}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                      <Pill color={pitchColor(p.pt)} label={p.pt} />
                    </td>
                    <td style={{ padding: '5px 8px', color: '#e0e0e8', textAlign: 'right', fontFamily: 'monospace' }}>{p.v?.toFixed(1)}</td>
                    <td style={{ padding: '5px 8px', color: '#a0a0b8', textAlign: 'right', fontFamily: 'monospace' }}>{p.sp > 0 ? Math.round(p.sp).toLocaleString() : '—'}</td>
                    <td style={{ padding: '5px 8px', color: pitchColor(p.pt), textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.ivb)}</td>
                    <td style={{ padding: '5px 8px', color: pitchColor(p.pt), textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.hb)}</td>
                    <td style={{ padding: '5px 8px', color: '#606080', textAlign: 'right', fontFamily: 'monospace' }}>{p.vaa != null ? p.vaa.toFixed(1) : '—'}</td>
                    <td style={{ padding: '5px 8px', color: p.z >= 1 && p.z <= 9 ? '#c85a5a' : '#606080', textAlign: 'center' }}>{p.z}</td>
                    <td style={{ padding: '5px 8px', color: resultColor, textAlign: 'center', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {resultLabel?.slice(0, 20)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

    </div>
  );
}

// ── Reusable location scatter sub-component ──────────────────────────────────

function LocationScatter({
  pitches: ps,
  ptList,
  height = 280,
}: {
  pitches: RawPitch[];
  ptList: { pt: string }[];
  height?: number;
}) {
  if (ps.length === 0) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#606080', fontSize: 12 }}>No pitches</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
        <XAxis type="number" dataKey="px" domain={[-2.5, 2.5]} tick={{ fill: '#606080', fontSize: 10 }}
          stroke="#2a2a3e" />
        <YAxis type="number" dataKey="pz" domain={[0, 5]} tick={{ fill: '#606080', fontSize: 10 }}
          stroke="#2a2a3e" />
        <Tooltip cursor={false}
          contentStyle={{ background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 6, fontSize: 11 }}
          formatter={(_, __, props) => [
            `${pName(props.payload.pt)} · ${props.payload.v?.toFixed(1)} mph`,
            props.payload.desc,
          ]} />
        {ptList.map(pt => (
          <Scatter key={pt.pt} name={pName(pt.pt)}
            data={ps.filter(p => p.pt === pt.pt).map(p => ({ px: p.px, pz: p.pz, pt: p.pt, v: p.v, desc: p.desc }))}
            fill={pitchColor(pt.pt)} fillOpacity={0.7} r={4} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
