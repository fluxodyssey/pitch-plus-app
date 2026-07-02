/**
 * Glossary.tsx — Baseball analytics metric definitions and jargon glossary.
 *
 * Route: /glossary
 * Reference for Pitch+, Swing+, Decision+, and common baseball analytics terms.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

// ── Data ──────────────────────────────────────────────────────────────────────

interface GlossaryEntry {
  term: string;
  category: 'model' | 'dimension' | 'metric' | 'baseball' | 'swing';
  definition: string;
  seeAlso?: string[];
}

const ENTRIES: GlossaryEntry[] = [
  // ── Model grades ──
  { term: 'Pitch+', category: 'model', definition: 'Overall pitcher quality grade. 100 = MLB average, σ = 15. Combines Stuff, Command, Deception, Tunnel & Sequence, Outcomes, and Arsenal. Clipped to [20, 180]. Higher is better for the pitcher.' },
  { term: 'Swing+', category: 'model', definition: 'Batter swing quality grade. 100 = MLB average, σ = 15. Measures bat speed, attack angle, contact efficiency, and barrel rate.' },
  { term: 'Decision+', category: 'model', definition: 'Batter plate discipline grade (BDQ). Grades the swing/take decision independent of outcome. High Decision+ = takes bad pitches, swings at hittable pitches.' },

  // ── Dimensions ──
  { term: 'Stuff', category: 'dimension', definition: 'Physical quality of pitches — velocity, spin, movement, and extension. Does not include location. A Stuff score of 120 means the pitcher\'s raw pitch arsenal is 1.3 SDs above average.' },
  { term: 'Command', category: 'dimension', definition: 'Ability to locate pitches precisely, work ahead in counts, and limit walks. Combines zone rate, edge rate, location precision, first-pitch strike rate, and BB%.' },
  { term: 'Deception', category: 'dimension', definition: 'Ability to induce chases and whiffs. Combines in-zone whiff rate, chase rate, CSW rate, and the pitcher deception index (how often batters swing at pitches that were in the zone at 167ms).' },
  { term: 'Tunnel & Sequence', category: 'dimension', definition: 'How well pitches share a visual path early in flight (tunnel tightness) and diverge after the batter\'s commit point (tunnel effectiveness). Also penalizes predictable sequencing.', seeAlso: ['Tango 167ms', 'Commit Point'] },
  { term: 'Outcomes', category: 'dimension', definition: 'Result-based production — K%, BB%, GB%, xFIP, wRC+ against. Higher = better results vs opposing hitters.' },
  { term: 'Arsenal', category: 'dimension', definition: 'Breadth and synergy of pitch mix — pitch entropy, arsenal synergy, best secondary whiff rate, platoon resistance, and number of pitch types. Rewards diverse, synergistic arsenals.' },

  // ── Pitch metrics ──
  { term: 'Stuff Z', category: 'metric', definition: 'Z-score composite of velocity, spin, and movement vs pitch-type peers. Measures raw pitch quality relative to other pitches of the same type.' },
  { term: 'SSW Proxy', category: 'metric', definition: 'Seam-shifted wake proxy. Measures spin-induced movement deviation from expected gyro effects. A high SSW proxy indicates unusual movement likely from seam-shifted wake aerodynamics.' },
  { term: 'Perceived Velo', category: 'metric', definition: 'Velocity adjusted for extension. Every 1 foot of extra extension = ~1 mph of perceived velocity gained, because the batter has less time to react.' },
  { term: 'K-BB%', category: 'metric', definition: 'Strikeout rate minus walk rate. A high K-BB% pitcher generates many strikeouts while limiting free passes — the most predictive single command metric.' },
  { term: 'CSW Rate', category: 'metric', definition: 'Called Strikes + Whiffs per pitch. Combines both types of pitcher-favorable outcomes on any pitch. Higher = more commanding.' },
  { term: 'Chase Rate', category: 'metric', definition: 'How often batters swing at pitches outside the strike zone. High chase rate = batters are confused or fooled by this pitcher.' },
  { term: 'In-Zone Whiff Rate', category: 'metric', definition: 'Swing-and-miss rate on pitches inside the strike zone. Measures pure miss ability on hittable pitches, capturing swing-and-miss stuff separate from deception.' },
  { term: 'Pitch Entropy', category: 'metric', definition: 'Shannon entropy of pitch usage percentages. Higher = more diverse/unpredictable pitch mix. An entropy of 0 = only one pitch thrown; max entropy = equal usage of 7+ pitches.' },
  { term: 'Arsenal Synergy', category: 'metric', definition: 'Bayesian-shrunk interaction score measuring whether seeing Pitch A makes Pitch B harder to hit. High synergy = pitches work better together than alone.' },
  { term: 'Sequence Surprise', category: 'metric', definition: 'How unpredictable the next pitch is given the previous pitch and count. Low surprise = mechanical, hittable patterns. High surprise = unpredictable sequencing.' },
  { term: 'Platoon Resistance', category: 'metric', definition: 'How well the pitcher performs against opposite-hand batters. A RHP with high platoon resistance doesn\'t give up the typical RHP vs LHB disadvantage.' },
  { term: 'FB VAA', category: 'metric', definition: 'Vertical approach angle on fastballs (degrees). Flatter angle = harder to lift = fewer home runs allowed. Below -4° is generally good; elite "rising" fastballs can hit -3° or flatter.' },
  { term: 'Release Consistency', category: 'metric', definition: 'Standard deviation of release point across all pitches (inches). Lower = more consistent — batters can\'t pick up pitch type from release point variation.' },
  { term: 'Temporal Tunnel Tightness', category: 'metric', definition: 'Pitch-location spread (feet) at Tango\'s ~167ms commit point. Lower = pitches look more similar at the moment batters must commit (better tunneled). See also: Commit Point.', seeAlso: ['Tango 167ms', 'Commit Point'] },
  { term: 'Temporal Tunnel Effectiveness', category: 'metric', definition: 'Ratio of plate spread to commit-point spread — "looks the same, ends different". Higher = more divergence after the batter has committed. Combined with tightness, this is the foundation of effective tunneling.' },
  { term: 'Timing Disruption', category: 'metric', definition: 'How far (inches) a pitcher displaces batters\' swing timing off their own baseline. Higher = better — batters are consistently early or late against this pitcher.' },
  { term: 'Plane Mismatch Induced', category: 'metric', definition: 'How far (degrees, angle proxy) a pitcher forces swings off the batter\'s preferred swing plane. Higher = better — swings against this pitcher are less well-matched to the pitch.' },
  { term: 'Miss Distance Against', category: 'metric', definition: 'Mean bat-miss distance (inches) on whiffs against a pitcher. A neutral descriptor of how badly batters miss — carries no outcome signal by itself.' },
  { term: 'Release Uniqueness', category: 'metric', definition: 'How far a pitcher\'s release slot sits from the same-hand league average, in population-σ units. A neutral descriptor of arm-slot rarity — submariners max it out.' },

  // ── Baseball terms ──
  { term: 'VAA', category: 'baseball', definition: 'Vertical Approach Angle. The angle at which a pitch descends into the hitting zone, measured in degrees. A flatter VAA (less negative) on fastballs is associated with swing-and-miss and reduced hard contact.' },
  { term: 'xFIP', category: 'baseball', definition: 'Expected Fielding Independent Pitching. Like FIP, but replaces actual HR with expected HR based on fly ball rate. Removes defense and ballpark from ERA, and also normalizes HR/FB rate.' },
  { term: 'wOBA', category: 'baseball', definition: 'Weighted On-Base Average. A linear weights-based measure of offensive value that weights hits by their run value (walk ≈ 0.69, single ≈ 0.89, HR ≈ 2.1).' },
  { term: 'wRC+', category: 'baseball', definition: 'Weighted Runs Created Plus. Park and league-adjusted offensive production. 100 = league average. An opposing wRC+ < 90 means this pitcher significantly suppresses offense.' },
  { term: 'xwOBA', category: 'baseball', definition: 'Expected wOBA based on exit velocity and launch angle, not actual results. Removes luck/defense from the equation.' },
  { term: 'CSW', category: 'baseball', definition: 'Called Strike plus Whiff. Any pitch that results in a called strike OR a swing and miss. CSW rate = CSW / pitches thrown.' },
  { term: 'Tango 167ms', category: 'baseball', definition: 'The commit point identified by analyst Tom Tango: approximately 167 milliseconds before the ball crosses the plate, batters must decide swing or take. Pitches that look identical at this point "tunnel" well.' },
  { term: 'Commit Point', category: 'baseball', definition: 'The moment during a pitch flight when a batter must commit to swinging. Used to evaluate tunneling — pitches that look alike at the commit point maximize deception.' },
  { term: 'Markov Chain (pitching)', category: 'baseball', definition: 'A model that treats each pitch as a state transition through count states (0-0, 1-0, etc.) to plate appearance outcomes. Used to compute run value and leverage of each pitch.', seeAlso: ['Count Value'] },
  { term: 'Count Value', category: 'baseball', definition: 'The run value of a pitch based on the count state it creates vs. the count it started from. A called strike on 2-0 is far more valuable than on 0-2.' },
  { term: 'Run Value (RV)', category: 'baseball', definition: 'Expected runs added or subtracted by a pitch or event, based on the run expectancy matrix. Negative RV = favorable for the pitcher.' },
  { term: 'Seam-Shifted Wake (SSW)', category: 'baseball', definition: 'An aerodynamic phenomenon where intentional seam orientation creates asymmetric airflow, causing unexpected lateral movement. Increases deception for pitchers who can control it.' },
  { term: 'Attack Angle', category: 'baseball', definition: 'The angle (degrees) at which the bat moves through the hitting zone at contact. Optimal attack angle (~10–15°) matches the pitch\'s descent angle, maximizing hard contact probability.' },
  { term: 'Bat Speed', category: 'baseball', definition: 'Linear speed of the sweet spot at contact (mph). Tracked by Statcast since 2023. Higher bat speed = more power, but also harder to control the barrel.' },
  { term: 'Swing Length', category: 'baseball', definition: 'Total distance the bat\'s sweet spot travels from start of swing to contact (feet). Longer swings are harder to control; shorter swings allow later contact decisions.' },
  { term: 'MLBAM ID', category: 'baseball', definition: 'MLB Advanced Media player identifier. The numeric ID used in Statcast and Baseball Savant. This app uses MLBAM IDs exclusively (site-specific IDs like FanGraphs\' IDfg are no longer used anywhere in the pipeline).' },

  // ── Swing/batter terms ──
  { term: 'BDQ', category: 'swing', definition: 'Batter Decision Quality. The Decision+ model\'s primary output. Grades each pitch-level swing or take decision independent of the outcome, based on pitch location, count, and approach.' },
  { term: 'Swing RV', category: 'swing', definition: 'Run value added per swing decision — how much value the batter creates by choosing to swing (vs take) on a given pitch.' },
  { term: 'Take RV', category: 'swing', definition: 'Run value added per take (non-swing) decision — how much value the batter creates by laying off a pitch. High Take RV on pitches outside the zone = elite plate discipline.' },
  { term: 'IAA', category: 'swing', definition: 'Induced Attack Angle. A Pitch+ model measuring how much a pitcher forces batters to alter their swing angle — specifically suppressing bat speed (iaa_fb) or inducing breaking ball adjustments (iaa_brk).' },
  { term: 'Timing Consistency', category: 'swing', definition: 'Standard deviation (inches) of a batter\'s contact-point timing. Lower = steadier timing, but steadier does not mean better outcomes — a neutral descriptor of swing style.' },
  { term: 'Barrel Accuracy (Miss Distance)', category: 'swing', definition: 'Mean whiff miss distance (inches) for a batter. A neutral descriptor — big-miss hitters often skew toward power rather than being simply worse.' },
  { term: 'Perfect Swing Rate', category: 'swing', definition: 'Share of swings that are simultaneously on-time, centered, and on-plane versus the batter\'s own baselines. League average ≈ 20% (Savant-comparable); higher = better.' },
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'model', label: 'Model Grades' },
  { id: 'dimension', label: 'Dimensions' },
  { id: 'metric', label: 'Metrics' },
  { id: 'baseball', label: 'Baseball Terms' },
  { id: 'swing', label: 'Swing / Batter' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function Glossary() {
  const [filter, setFilter] = useState<'all' | GlossaryEntry['category']>('all');
  const [search, setSearch] = useState('');

  const visible = ENTRIES.filter(e => {
    if (filter !== 'all' && e.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => a.term.localeCompare(b.term));

  const btnStyle = (active: boolean) => ({
    padding: '5px 12px', fontSize: 12, borderRadius: 16, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-3)',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Glossary</h1>
        <p className="subtitle">
          Definitions for all Pitch+, Swing+, and Decision+ metrics, plus common baseball analytics terms.{' '}
          <Link to="/faq" style={{ color: 'var(--accent)' }}>See also: FAQ →</Link>
        </p>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search terms…"
          style={{
            background: 'var(--bg-elevated)', border: '1px solid #2a2a3e',
            color: 'var(--text-1)', borderRadius: 6, padding: '7px 12px', fontSize: 13,
            width: 220, boxSizing: 'border-box',
          }}
        />
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setFilter(cat.id as typeof filter)} style={btnStyle(filter === cat.id)}>
            {cat.label}
          </button>
        ))}
      </div>

      <div style={{ color: 'var(--text-4)', fontSize: 12, marginBottom: 16 }}>
        {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visible.map(entry => (
          <div
            key={entry.term}
            id={entry.term.replace(/\s+/g, '-').toLowerCase()}
            className="card"
            style={{ padding: '14px 18px' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{entry.term}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
                padding: '1px 6px', borderRadius: 10,
                background: entry.category === 'model' ? 'rgba(74,158,255,0.12)'
                  : entry.category === 'dimension' ? 'rgba(167,139,250,0.12)'
                  : entry.category === 'metric' ? 'rgba(52,211,153,0.12)'
                  : entry.category === 'swing' ? 'rgba(251,191,36,0.12)'
                  : 'rgba(255,255,255,0.06)',
                color: entry.category === 'model' ? '#4a9eff'
                  : entry.category === 'dimension' ? '#a78bfa'
                  : entry.category === 'metric' ? '#34d399'
                  : entry.category === 'swing' ? '#fbbf24'
                  : '#a0a0b8',
              }}>
                {CATEGORIES.find(c => c.id === entry.category)?.label ?? entry.category}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {entry.definition}
            </p>
            {entry.seeAlso && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-4)' }}>
                See also:{' '}
                {entry.seeAlso.map((term, i) => (
                  <span key={term}>
                    {i > 0 && ', '}
                    <a href={`#${term.replace(/\s+/g, '-').toLowerCase()}`} style={{ color: 'var(--accent)' }}>
                      {term}
                    </a>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
