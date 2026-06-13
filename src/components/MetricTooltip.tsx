import { useState, type ReactNode } from 'react';

const DESCRIPTIONS: Record<string, string> = {
  // ── Stuff ────────────────────────────────────────────────────────────────
  stuff_z: 'Z-score composite of velocity, spin, and movement vs pitch-type peers.',
  swing_plus_suppression: 'How much this pitcher degrades opponent swing quality vs each batter\'s own baseline.',
  avg_perceived_velo: 'Velocity adjusted for extension. Longer extension = higher perceived velo.',
  bat_speed_suppression: 'How much batters slow their swings vs their norm against this pitcher.',
  ssw_proxy: 'Seam-shifted wake proxy — spin-induced movement deviation from expected gyro effects.',
  // ── Command ──────────────────────────────────────────────────────────────
  bip_adjusted_kbb: 'K%×1.3 − BB%, re-weighted for ball-in-play avoidance. The dominant command signal.',
  race_to_2_strikes: 'Average pitches needed to reach a 2-strike count. Lower = faster count attack.',
  loc_precision: 'Standard deviation of pitch locations (lower = more precise).',
  zone_rate: 'Percentage of pitches thrown in the strike zone.',
  first_pitch_strike_rate: 'How often the first pitch of an at-bat is a strike.',
  take_rv_against: 'Mean run value on pitches batters take. Lower = better passive command.',
  edge_rate: 'Percentage of pitches on the edge/border of the zone.',
  markov_efficiency: 'Expected pitches per PA from 0-0, via count-transition Markov chain. Lower = more efficient.',
  // ── Deception ────────────────────────────────────────────────────────────
  in_zone_whiff_rate: 'Swing-and-miss rate on pitches inside the strike zone.',
  csw_rate: 'Called strikes + whiffs per pitch. Measures ability to get favorable counts.',
  chase_rate: 'How often batters swing at pitches outside the zone.',
  avg_extension: 'Average release point extension toward home plate (feet).',
  regime_whiff_delta: 'Whiff% when ahead in the count minus when behind. Higher = weaponizes leverage.',
  swing_length_inducement: 'How much longer batters swing vs their norm. Longer = late, compromised swings.',
  release_consistency: 'Std dev of release point across all pitches (lower = more consistent).',
  // ── Tunnel & Sequence ────────────────────────────────────────────────────
  movement_differential: 'Max movement difference between pitch types.',
  sequence_surprise: 'How unpredictable the next pitch is given the previous pitch.',
  speed_differential: 'Max velocity difference between pitch types.',
  // ── Outcomes ─────────────────────────────────────────────────────────────
  markov_dominance: 'Probability a PA starting 0-0 ends in a strikeout, from the pitcher\'s own count-transition matrix.',
  wrc_plus_against: 'Weighted runs created by opposing hitters (lower = better for pitcher).',
  k_rate: 'Strikeout percentage.',
  avg_launch_speed_against: 'Average exit velocity allowed on balls in play.',
  bb_rate: 'Walk percentage.',
  gb_rate: 'Ground ball percentage.',
  bip_rate: 'Balls in play per PA. Lower = more PAs end at K/BB, where the pitcher controls the outcome.',
  swing_rv_against: 'Mean run value on opponent swings. Lower = swings end badly for hitters.',
  in_zone_swing_rv: 'Run value on swings at in-zone pitches. Lower = suppresses damage on hittable pitches.',
  chase_swing_rv: 'Run value on chase swings. Lower = induced chases end badly for hitters.',
  // ── Arsenal ──────────────────────────────────────────────────────────────
  best_secondary_whiff: 'Whiff rate of the best non-fastball pitch.',
  count_conditional_entropy: 'Pitch entropy adjusted by count — penalizes predictability in leverage counts.',
  platoon_resistance: 'How well the pitcher performs against opposite-hand hitters.',
  n_pitch_types: 'Number of distinct pitch types thrown.',
  pitch_entropy: 'Shannon entropy of pitch mix — higher = more diverse arsenal.',
  // ── Display-only ─────────────────────────────────────────────────────────
  k_bb_pct: 'Strikeout rate minus walk rate. Higher = more dominant.',
  pitch_plus: 'Overall pitcher grade (100 = avg, 15 = 1 SD). Combines Stuff, Command, Deception, Tunnel, Outcomes, Arsenal.',
};

export function MetricTooltip({ metricKey, children }: { metricKey: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const desc = DESCRIPTIONS[metricKey];
  if (!desc) return <>{children}</>;

  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', cursor: 'help', borderBottom: '1px dotted #404060' }}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 6,
          padding: '8px 12px',
          background: '#1a1a2e',
          border: '1px solid #2a2a4a',
          borderRadius: 6,
          color: '#c0c0d8',
          fontSize: 11,
          lineHeight: 1.4,
          width: 240,
          textAlign: 'left',
          zIndex: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          whiteSpace: 'normal',
        }}>
          {desc}
        </div>
      )}
    </span>
  );
}
