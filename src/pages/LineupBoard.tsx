/**
 * Lineup Board — arsenal-weighted scouting card for a pitcher vs a team.
 *
 * Every number on this page answers one question: "against THIS pitcher's
 * actual pitch mix, how does each opposing hitter profile?" Batter splits vs
 * (pitcher hand × pitch type) are beta-binomial-shrunk toward league, then
 * weighted by the pitcher's usage against that hitter's side.
 *
 * Interactivity: click any pitch type in the arsenal panel and the entire
 * board — metric cells and all zone city maps — re-weights to that pitch
 * alone. Hover any cell for raw vs shrunk rate, sample size, and the 90%
 * credible interval.
 */
import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useArsenal } from '../hooks/useArsenal';
import { ZoneGrid, type ZoneCell } from '../components/ZoneGrid';
import {
  BOARD_METRICS, METRIC_LABEL, heatColor, heatInk, weightedMetric, weightedZones,
  type ArsenalDoc, type ArsenalPitcher, type BoardMetric,
} from '../data/arsenal';

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021];
const HEAT_SPAN: Record<BoardMetric, number> = {
  csw: 0.05, swstr: 0.05, whiff: 0.08, chase: 0.08, putaway: 0.08,
};
const ZONE_SPAN = 0.10;

const mono: React.CSSProperties = { fontFamily: 'var(--mono)' };
const panel: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid #1e2e44',
  borderRadius: 'var(--radius-lg)', padding: 18,
};

function pct(v: number | null | undefined, digits = 1): string {
  return v == null || !isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`;
}

export function LineupBoard() {
  const { pitcherId: urlPid } = useParams();
  const navigate = useNavigate();
  const [year, setYear] = useState(2026);
  const [oppTeam, setOppTeam] = useState<string>('');
  const [ptFilter, setPtFilter] = useState<string | null>(null);
  const [view, setView] = useState<'board' | 'city'>('board');
  const [search, setSearch] = useState('');
  const doc = useArsenal(year);

  const pitchers = useMemo(() => {
    if (typeof doc === 'string') return [];
    return Object.entries(doc.pitchers)
      .map(([id, p]) => ({ id, ...p, tot: totalPitches(p) }))
      .filter(p => p.name)
      .sort((a, b) => b.tot - a.tot);
  }, [doc]);

  const teams = useMemo(() => {
    if (typeof doc === 'string') return [];
    return [...new Set(Object.values(doc.batters).map(b => b.team).filter(Boolean))].sort();
  }, [doc]);

  const pid = urlPid && typeof doc !== 'string' && doc.pitchers[urlPid] ? urlPid : pitchers[0]?.id;
  const pitcher = pid && typeof doc !== 'string' ? doc.pitchers[pid] : undefined;

  const opp = oppTeam && teams.includes(oppTeam)
    ? oppTeam
    : teams.find(t => t !== pitcher?.team) ?? '';

  const lineup = useMemo(() => {
    if (typeof doc === 'string' || !opp) return [];
    return Object.entries(doc.batters)
      .filter(([, b]) => b.team === opp && b.name)
      .map(([id, b]) => ({ id, ...b, tot: (sumN(b.vsL) + sumN(b.vsR)) }))
      .sort((a, b) => b.tot - a.tot)
      .slice(0, 12);
  }, [doc, opp]);

  if (doc === 'loading') return <Center msg="Loading arsenal data…" />;
  if (doc === 'missing') return <Center msg={`No arsenal data for ${year} — run models/arsenal_matchup.py ${year}`} />;
  if (!pitcher || !pid) return <Center msg="No pitchers in this season's export." />;

  const filteredPitchers = search
    ? pitchers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : pitchers;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px' }}>
      {/* ── masthead ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 6, ...mono, fontSize: 12, letterSpacing: 2, color: 'var(--accent)' }}>
        ARSENAL-WEIGHTED LINEUP BOARD · PITCHER POV
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ ...mono, fontSize: 34, fontWeight: 700, letterSpacing: 3, margin: 0, textTransform: 'uppercase' }}>
          {pitcher.name || pid} <span style={{ color: 'var(--text-3)', fontSize: 22 }}>· {pitcher.hand}HP</span>
        </h1>
        <span style={{ ...mono, fontSize: 16, color: 'var(--accent)', letterSpacing: 1 }}>
          vs {opp || '—'}
        </span>
      </div>

      {/* ── controls ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={selStyle}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Find pitcher…"
          style={{ ...selStyle, width: 150 }}
        />
        <select
          value={pid}
          onChange={e => navigate(`/lineup/${e.target.value}`)}
          style={{ ...selStyle, maxWidth: 220 }}
        >
          {filteredPitchers.slice(0, 400).map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.team})</option>
          ))}
        </select>
        <select value={opp} onChange={e => setOppTeam(e.target.value)} style={selStyle}>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', border: '1px solid #1e2e44', borderRadius: 8, overflow: 'hidden' }}>
          {(['board', 'city'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              ...mono, fontSize: 12, letterSpacing: 1, padding: '8px 16px', border: 'none',
              cursor: 'pointer', textTransform: 'uppercase',
              background: view === v ? 'var(--accent)' : 'transparent',
              color: view === v ? '#fff' : 'var(--text-2)',
            }}>{v === 'board' ? 'Metrics Board' : 'City Map'}</button>
          ))}
        </div>
      </div>

      {/* ── arsenal panel (click a pitch to isolate it) ───────────── */}
      <div style={{ ...panel, marginBottom: 20 }}>
        <PanelTitle text="ARSENAL LOCATION" sub="zone frequency by pitch · click a pitch to re-weight the whole board to it" />
        {(['L', 'R'] as const).map(side => (
          <div key={side} style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 12 }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--text-3)', letterSpacing: 1.5, width: 52, paddingTop: 26 }}>
              VS {side}HB
            </div>
            {Object.entries(pitcher[`vs${side}`])
              .filter(([, c]) => c.usage >= 0.03)
              .sort((a, b) => b[1].usage - a[1].usage)
              .map(([pt, c]) => {
                const active = ptFilter === pt;
                const maxZ = Math.max(1, ...Object.values(c.zones));
                const cells: Partial<Record<number, ZoneCell>> = {};
                for (const [z, n] of Object.entries(c.zones)) {
                  const a = 0.10 + 0.75 * (n / maxZ);
                  cells[Number(z)] = {
                    label: String(Math.round((n / c.n) * 100)),
                    fill: `rgba(47,128,237,${a.toFixed(2)})`,
                    tip: `${pt} → zone ${z}\n${n} pitches (${pct(n / c.n, 0)})`,
                  };
                }
                return (
                  <div
                    key={pt}
                    onClick={() => setPtFilter(active ? null : pt)}
                    style={{
                      cursor: 'pointer', padding: 8, borderRadius: 8,
                      border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
                      background: active ? 'var(--accent-dim)' : 'transparent',
                      transition: 'border-color 120ms, background 120ms',
                    }}
                  >
                    <div style={{ ...mono, fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 6, color: active ? 'var(--accent)' : 'var(--text-1)' }}>
                      {pt} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{Math.round(c.usage * 100)}%</span>
                    </div>
                    <ZoneGrid cells={cells} size={26} />
                  </div>
                );
              })}
          </div>
        ))}
        {ptFilter && (
          <div style={{ ...mono, fontSize: 12, color: 'var(--accent)', marginTop: 10 }}>
            ▸ Board isolated to {ptFilter} — click it again to restore full-arsenal weighting.
          </div>
        )}
      </div>

      {/* ── the board / city map ─────────────────────────────────── */}
      {view === 'board' ? (
        <MetricsBoard doc={doc} pitcher={pitcher} lineup={lineup} ptFilter={ptFilter} />
      ) : (
        <CityMap doc={doc} pitcher={pitcher} lineup={lineup.slice(0, 9)} ptFilter={ptFilter} />
      )}

      <Legend />
    </div>
  );
}

// ── metrics board ────────────────────────────────────────────────────────────

function MetricsBoard({ doc, pitcher, lineup, ptFilter }: {
  doc: ArsenalDoc; pitcher: ArsenalPitcher;
  lineup: Array<{ id: string; name: string; hand: string }>;
  ptFilter: string | null;
}) {
  const [tip, setTip] = useState<{ key: string; text: string } | null>(null);
  return (
    <div style={{ ...panel, overflowX: 'auto', position: 'relative' }}>
      <PanelTitle text="ARSENAL WEIGHTED METRICS" sub="emerald = pitcher advantage vs league · hover a cell for the 90% credible interval" />
      <table style={{ borderCollapse: 'separate', borderSpacing: 2, marginTop: 12, width: '100%' }}>
        <thead>
          <tr>
            {['#', 'HITTER', 'B', ...BOARD_METRICS.map(m => METRIC_LABEL[m])].map(h => (
              <th key={h} style={{ ...mono, fontSize: 11, letterSpacing: 1.5, color: 'var(--text-3)', padding: '6px 10px', textAlign: h === 'HITTER' ? 'left' : 'center' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineup.map((b, i) => {
            const batter = doc.batters[b.id];
            if (!batter) return null;
            return (
              <tr key={b.id} style={{ animation: `fadeUp 360ms ${i * 45}ms both` }}>
                <td style={{ ...mono, fontSize: 13, color: i < 9 ? 'var(--accent)' : 'var(--text-4)', fontWeight: 700, textAlign: 'center', padding: '4px 8px' }}>
                  {i + 1}
                </td>
                <td style={{ fontSize: 14, fontWeight: 600, padding: '4px 10px', whiteSpace: 'nowrap' }}>{b.name}</td>
                <td style={{ ...mono, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>{b.hand}</td>
                {BOARD_METRICS.map(m => {
                  const wm = weightedMetric(pitcher, batter, doc.league, m, ptFilter);
                  const key = `${b.id}:${m}`;
                  if (!wm) {
                    return <td key={m} style={{ background: 'var(--bg-input)', borderRadius: 4, textAlign: 'center', ...mono, fontSize: 12, color: 'var(--text-4)', padding: '8px 6px' }}>—</td>;
                  }
                  const fill = heatColor(wm.rate - wm.league, HEAT_SPAN[m]);
                  const breakdown = wm.parts
                    .filter(p => p.rate)
                    .map(p => `${p.pt.padEnd(3)} ${Math.round(p.usage * 100)}% · ${pct(p.rate!.rate)} (n ${p.rate!.n})`)
                    .join('\n');
                  return (
                    <td
                      key={m}
                      onMouseEnter={() => setTip({
                        key,
                        text: `${b.name} — ${METRIC_LABEL[m]}${ptFilter ? ` (${ptFilter} only)` : ''}\n`
                          + `shrunk ${pct(wm.rate)}  ·  90% CI ${pct(wm.lo)}–${pct(wm.hi)}\n`
                          + `league-weighted ${pct(wm.league)}  ·  eff n ${wm.effN}\n${breakdown}`,
                      })}
                      onMouseLeave={() => setTip(null)}
                      style={{
                        background: fill, color: heatInk(fill), borderRadius: 4,
                        textAlign: 'center', ...mono, fontSize: 13, fontWeight: 600,
                        padding: '9px 6px', minWidth: 76, cursor: 'default',
                        outline: tip?.key === key ? '1px solid var(--text-2)' : 'none',
                      }}
                    >
                      {pct(wm.rate)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {tip && (
        <div style={{
          position: 'sticky', bottom: 8, left: 8, display: 'inline-block',
          padding: '8px 12px', background: 'var(--bg-elevated)', whiteSpace: 'pre',
          border: '1px solid var(--accent-line)', borderRadius: 6, ...mono, fontSize: 11.5,
          color: 'var(--text-1)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', marginTop: 10,
        }}>{tip.text}</div>
      )}
    </div>
  );
}

// ── city map ─────────────────────────────────────────────────────────────────

function CityMap({ doc, pitcher, lineup, ptFilter }: {
  doc: ArsenalDoc; pitcher: ArsenalPitcher;
  lineup: Array<{ id: string; name: string; hand: string }>;
  ptFilter: string | null;
}) {
  return (
    <div style={panel}>
      <PanelTitle text="LINEUP CITY MAP" sub="arsenal-weighted zone CSW per hitter · emerald = pitcher wins that zone vs league · pitcher POV" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 22, marginTop: 16 }}>
        {lineup.map((b, i) => {
          const batter = doc.batters[b.id];
          if (!batter) return null;
          const zones = weightedZones(pitcher, batter, doc.league, ptFilter);
          const cells: Partial<Record<number, ZoneCell>> = {};
          for (const [z, v] of Object.entries(zones)) {
            const fill = heatColor(v.rate - v.league, ZONE_SPAN);
            cells[Number(z)] = {
              label: String(Math.round(v.rate * 100)),
              fill, ink: heatInk(fill),
              tip: `zone ${z} — CSW ${pct(v.rate)}\nleague here ${pct(v.league)}\nbatter zone n ${v.n}`,
            };
          }
          const overall = weightedMetric(pitcher, batter, doc.league, 'csw', ptFilter);
          return (
            <div key={b.id} style={{ animation: `fadeUp 360ms ${i * 60}ms both` }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                <span style={{ ...mono, color: 'var(--accent)' }}>{i + 1}.</span> {b.name}
                <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> ({b.hand})</span>
              </div>
              <div style={{ ...mono, fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
                CSW {overall ? pct(overall.rate) : '—'} · league {overall ? pct(overall.league) : '—'}
              </div>
              <ZoneGrid cells={cells} size={40} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── chrome ───────────────────────────────────────────────────────────────────

function PanelTitle({ text, sub }: { text: string; sub?: string }) {
  return (
    <div>
      <div style={{ ...mono, fontSize: 15, fontWeight: 700, letterSpacing: 3 }}>
        {text} <span style={{ color: 'var(--text-4)' }}>—————</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, fontStyle: 'italic' }}>{sub}</div>}
    </div>
  );
}

function Legend() {
  const steps = ['#f8556f', '#c94360', '#9e3a56', '#77384e', 'var(--bg-elevated)', '#2b524b', '#1e7a61', '#14a276', '#10cf8e'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
      <span style={{ ...mono, fontSize: 11, color: 'var(--text-3)' }}>hitter advantage</span>
      <div style={{ display: 'flex', gap: 2 }}>
        {steps.map(c => <div key={c} style={{ width: 22, height: 10, background: c, borderRadius: 2 }} />)}
      </div>
      <span style={{ ...mono, fontSize: 11, color: 'var(--text-3)' }}>pitcher advantage</span>
      <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 12 }}>
        vs league, arsenal-weighted · rates beta-binomial-shrunk (small samples pull to league) · hover cells for 90% CI
      </span>
    </div>
  );
}

function Center({ msg }: { msg: string }) {
  return <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)', ...mono }}>{msg}</div>;
}

const selStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text-1)', border: '1px solid #1e2e44',
  borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--sans)',
};

function totalPitches(p: ArsenalPitcher): number {
  return [...Object.values(p.vsL), ...Object.values(p.vsR)].reduce((s, c) => s + c.n, 0);
}
function sumN(side: Record<string, { n: number }>): number {
  return Object.values(side).reduce((s, c) => s + c.n, 0);
}
