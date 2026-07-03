/**
 * Catcher Framing Leaderboard — CSOE framing + ABS challenge run value.
 *
 * Framing: models/catcher_framing.py fits a called-strike probability model
 * (VAA/HAA, plate location, count — no catcher identity) with out-of-fold
 * predictions, then credits each catcher with actual − expected per 100 taken
 * pitches. Expanding a row reveals WHERE the catcher wins or loses strikes:
 * a shadow-zone residual map (blurred cell grid ≈ smoothed surface).
 *
 * Challenges: models/catcher_challenges.py prices every catcher-initiated ABS
 * challenge (2026+) at the count-dependent ball→strike run swing; successful
 * overturns accumulate as runs saved.
 */
import { useState } from 'react';
import { useCatchers, useChallenges, type CatcherRow, type ChallengeRow } from '../hooks/useArsenal';
import { heatColor } from '../data/arsenal';

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021];
const mono: React.CSSProperties = { fontFamily: 'var(--mono)' };

export function CatcherFraming() {
  const [year, setYear] = useState(2026);
  const [open, setOpen] = useState<number | null>(null);
  const doc = useCatchers(year);
  const challenges = useChallenges(year);

  if (doc === 'loading') return <Center msg="Loading framing data…" />;
  if (doc === 'missing') return <Center msg={`No catcher data for ${year} — run models/catcher_framing.py ${year}`} />;

  const maxAbs = Math.max(0.5, ...doc.catchers.map(c => Math.abs(c.csoe100)));

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ ...mono, fontSize: 12, letterSpacing: 2, color: 'var(--accent)', marginBottom: 6 }}>
        CALLED STRIKES OVER EXPECTED · PER 100 TAKEN PITCHES
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ ...mono, fontSize: 30, fontWeight: 700, letterSpacing: 3, margin: 0 }}>
          CATCHER FRAMING LEADERBOARD
        </h1>
        <select value={year} onChange={e => { setYear(Number(e.target.value)); setOpen(null); }} style={selStyle}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 20 }}>
        CS-probability model: gradient boosting on approach angles (VAA/HAA), plate location, and count —
        out-of-fold AUC <span style={{ ...mono, color: 'var(--text-2)' }}>{doc.meta.auc.toFixed(3)}</span> on{' '}
        <span style={{ ...mono, color: 'var(--text-2)' }}>{doc.meta.n_taken.toLocaleString()}</span> taken pitches.
        Expand a catcher to see where they win strikes.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {doc.catchers.map((c, i) => (
          <CatcherRowView
            key={c.id} c={c} rank={i + 1} maxAbs={maxAbs}
            open={open === c.id}
            onToggle={() => setOpen(open === c.id ? null : c.id)}
            delay={Math.min(i, 15) * 30}
          />
        ))}
      </div>

      <ChallengeBoard challenges={challenges} year={year} />
    </div>
  );
}

// ── ABS challenge run value ───────────────────────────────────────────────────

function ChallengeBoard({ challenges, year }: {
  challenges: ReturnType<typeof useChallenges>; year: number;
}) {
  if (challenges === 'loading') return null;
  if (challenges === 'missing') {
    return year >= 2026 ? (
      <div style={{ marginTop: 40, ...mono, fontSize: 12, color: 'var(--text-4)' }}>
        No challenge data for {year} — run models/catcher_challenges.py --year {year}
      </div>
    ) : null;   // pre-ABS seasons have no challenge system
  }

  const lg = challenges.league;
  const maxRuns = Math.max(0.5, ...challenges.catchers.map(c => Math.abs(c.runs_saved)));

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ ...mono, fontSize: 12, letterSpacing: 2, color: 'var(--accent)', marginBottom: 6 }}>
        ABS CHALLENGE SYSTEM · RUN VALUE ON CATCHER CHALLENGES
      </div>
      <h2 style={{ ...mono, fontSize: 22, fontWeight: 700, letterSpacing: 3, margin: '0 0 4px' }}>
        CHALLENGE VALUE
      </h2>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 18, maxWidth: 640 }}>
        Every catcher-initiated challenge priced at the count-dependent ball→strike run swing
        (a 3-2 overturn flips a walk into a strikeout ≈ 0.6 runs; an 0-0 overturn ≈ 0.08).
        League: <span style={{ ...mono, color: 'var(--text-2)' }}>{lg.catcher_challenges.toLocaleString()}</span> challenges,{' '}
        <span style={{ ...mono, color: 'var(--text-2)' }}>{lg.success_pct.toFixed(1)}%</span> overturned,{' '}
        <span style={{ ...mono, color: 'var(--positive)' }}>+{lg.total_runs_saved.toFixed(1)}</span> runs saved.
        Through {challenges.generated_from}.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {challenges.catchers.map((c, i) => (
          <ChallengeRowView key={c.id} c={c} rank={i + 1} maxRuns={maxRuns} leagueSuccess={lg.success_pct} />
        ))}
      </div>
    </div>
  );
}

function ChallengeRowView({ c, rank, maxRuns, leagueSuccess }: {
  c: ChallengeRow; rank: number; maxRuns: number; leagueSuccess: number;
}) {
  const barW = Math.abs(c.runs_saved) / maxRuns * 200;
  const aboveLg = c.success_pct >= leagueSuccess;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
    }}>
      <span style={{ ...mono, fontSize: 12, color: 'var(--text-4)', width: 26, textAlign: 'right' }}>{rank}</span>
      <span style={{ fontSize: 14, fontWeight: 600, width: 190, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {c.name}
        <span style={{ ...mono, fontSize: 11, color: 'var(--text-4)', marginLeft: 7 }}>{c.team}</span>
      </span>
      <span style={{ ...mono, fontSize: 15, fontWeight: 700, width: 66, textAlign: 'right', color: 'var(--positive)' }}>
        +{c.runs_saved.toFixed(2)}
      </span>
      <div style={{ flex: '0 0 210px', height: 8 }}>
        <div style={{ width: barW, height: 8, background: '#14a276', borderRadius: 4 }} />
      </div>
      <span style={{ ...mono, fontSize: 11.5, width: 110, textAlign: 'right', color: aboveLg ? 'var(--text-2)' : 'var(--text-4)' }}>
        {c.success_pct.toFixed(1)}% won
      </span>
      <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-4)', width: 110, textAlign: 'right' }}>
        {c.n_overturned}/{c.n_challenges} chal
      </span>
    </div>
  );
}

function CatcherRowView({ c, rank, maxAbs, open, onToggle, delay }: {
  c: CatcherRow; rank: number; maxAbs: number; open: boolean; onToggle: () => void; delay: number;
}) {
  const pos = c.csoe100 >= 0;
  const barW = Math.abs(c.csoe100) / maxAbs * 130;
  return (
    <div style={{ animation: `fadeUp 320ms ${delay}ms both` }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
          background: open ? 'var(--bg-elevated)' : 'var(--bg-surface)',
          border: '1px solid var(--border-plus)', borderRadius: 8, cursor: 'pointer',
        }}
      >
        <span style={{ ...mono, fontSize: 12, color: 'var(--text-4)', width: 26, textAlign: 'right' }}>{rank}</span>
        <span style={{ fontSize: 14.5, fontWeight: 600, width: 190, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.name || `#${c.id}`}
        </span>
        <span style={{ ...mono, fontSize: 15, fontWeight: 700, width: 66, textAlign: 'right', color: pos ? 'var(--positive)' : 'var(--negative)' }}>
          {c.csoe100 >= 0 ? '+' : ''}{c.csoe100.toFixed(2)}
        </span>
        {/* diverging bar anchored at the shared zero line */}
        <div style={{ flex: '0 0 270px', display: 'flex', alignItems: 'center', height: 12 }}>
          <div style={{ width: 135, display: 'flex', justifyContent: 'flex-end' }}>
            {!pos && <div style={{ width: barW, height: 8, background: '#c94360', borderRadius: '4px 0 0 4px' }} />}
          </div>
          <div style={{ width: 2, height: 12, background: 'var(--text-4)' }} />
          <div style={{ width: 135 }}>
            {pos && <div style={{ width: barW, height: 8, background: '#14a276', borderRadius: '0 4px 4px 0' }} />}
          </div>
        </div>
        <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-3)', width: 80, textAlign: 'right' }}>
          {c.percentile}th pct
        </span>
        <span style={{ ...mono, fontSize: 11.5, color: 'var(--text-4)', width: 110, textAlign: 'right' }}>
          {c.n.toLocaleString()} taken
        </span>
        <span style={{ ...mono, fontSize: 12, color: 'var(--text-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>▸</span>
      </div>
      {open && <ResidualMap c={c} />}
    </div>
  );
}

/**
 * 7×7 shadow-zone residual grid, px −1.4..1.4 ft (catcher POV, ascending left
 * to right) × pz 0.8..4.2 ft. Cells are blurred into a smooth surface (no text
 * on cells, so blur is safe); the crisp rectangle is the nominal strike zone.
 */
function ResidualMap({ c }: { c: CatcherRow }) {
  const CELL = 46;
  const cells: Array<{ i: number; j: number; resid: number; n: number }> = [];
  for (const [key, [sum, n]] of Object.entries(c.grid)) {
    const [i, j] = key.split(',').map(Number);
    if (i == null || j == null || !n) continue;
    cells.push({ i, j, resid: sum / n, n });
  }
  // strike-zone rectangle in grid coordinates (px ±0.83 ft, pz 1.5–3.5 ft)
  const zoneLeft = ((-0.83 + 1.4) / 2.8) * 7 * CELL;
  const zoneWidth = (1.66 / 2.8) * 7 * CELL;
  const zoneTop = ((4.2 - 3.5) / 3.4) * 7 * CELL;
  const zoneHeight = (2.0 / 3.4) * 7 * CELL;

  return (
    <div style={{ padding: '18px 14px 20px 52px', display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 7 * CELL, height: 7 * CELL }}>
        <div style={{ position: 'absolute', inset: 0, filter: 'blur(9px)', borderRadius: 12, overflow: 'hidden' }}>
          {cells.map(({ i, j, resid, n }) => (
            <div key={`${i},${j}`} style={{
              position: 'absolute', left: i * CELL, top: (6 - j) * CELL, width: CELL, height: CELL,
              background: heatColor(resid, 0.15),
              opacity: Math.min(1, 0.35 + n / 120),
            }} />
          ))}
        </div>
        <div style={{
          position: 'absolute', left: zoneLeft, top: zoneTop, width: zoneWidth, height: zoneHeight,
          border: '1.5px solid var(--text-2)', borderRadius: 2, pointerEvents: 'none',
        }} />
        <div style={{ position: 'absolute', bottom: -20, left: 0, right: 0, textAlign: 'center', ...mono, fontSize: 10, color: 'var(--text-4)', letterSpacing: 1 }}>
          CATCHER POV · SHADOW-ZONE RESIDUALS
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', maxWidth: 300, lineHeight: 1.6 }}>
        <div style={{ ...mono, fontSize: 13, color: 'var(--text-1)', marginBottom: 6 }}>
          {c.cs.toLocaleString()} called strikes vs {c.xcs.toLocaleString()} expected
        </div>
        Emerald regions are where {c.name ? c.name.split(' ').slice(-1)[0] : 'this catcher'} converts
        borderline takes into strikes more often than the model expects; rose regions are strikes lost.
        The rectangle is the nominal zone — framing lives on its edges.
      </div>
    </div>
  );
}

function Center({ msg }: { msg: string }) {
  return <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-3)', ...mono }}>{msg}</div>;
}

const selStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text-1)', border: '1px solid var(--border-plus)',
  borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--sans)',
};
