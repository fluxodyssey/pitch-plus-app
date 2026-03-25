import { useState, type ReactNode } from 'react';

const DESCRIPTIONS: Record<string, string> = {
  stuff_z: 'Z-score composite of velocity, spin, and movement vs pitch-type peers.',
  ssw_proxy: 'Seam-shifted wake proxy — spin-induced movement deviation from expected gyro effects.',
  avg_perceived_velo: 'Velocity adjusted for extension. Longer extension = higher perceived velo.',
  k_bb_pct: 'Strikeout rate minus walk rate. Higher = more dominant.',
  zone_rate: 'Percentage of pitches thrown in the strike zone.',
  edge_rate: 'Percentage of pitches on the edge/border of the zone.',
  loc_precision: 'Standard deviation of pitch locations (lower = more precise).',
  first_pitch_strike_rate: 'How often the first pitch of an at-bat is a strike.',
  in_zone_whiff_rate: 'Swing-and-miss rate on pitches inside the strike zone.',
  chase_rate: 'How often batters swing at pitches outside the zone.',
  csw_rate: 'Called strikes + whiffs per pitch. Measures ability to get favorable counts.',
  avg_extension: 'Average release point extension toward home plate (feet).',
  fb_vaa: 'Vertical approach angle on fastballs. Flatter = harder to lift.',
  release_consistency: 'Std dev of release point across all pitches (lower = more consistent).',
  temporal_tunnel_tightness: 'How similar pitches look at Tango\'s 167ms commit point. Lower = better tunneled.',
  temporal_tunnel_effectiveness: 'How much pitches diverge after the commit point. Higher = more effective.',
  tunnel_tightness: 'Pitch similarity at a fixed tunnel point.',
  tunnel_effectiveness: 'Pitch divergence after the tunnel point.',
  release_uniqueness: 'How different this pitcher\'s release is from league average.',
  speed_differential: 'Max velocity difference between pitch types.',
  movement_differential: 'Max movement difference between pitch types.',
  sequence_surprise: 'How unpredictable the next pitch is given the previous pitch.',
  wrc_plus_against: 'Weighted runs created by opposing hitters (lower = better for pitcher).',
  k_rate: 'Strikeout percentage.',
  bb_rate: 'Walk percentage.',
  avg_launch_speed_against: 'Average exit velocity allowed on balls in play.',
  gb_rate: 'Ground ball percentage.',
  pitch_entropy: 'Shannon entropy of pitch mix — higher = more diverse arsenal.',
  count_conditional_entropy: 'Pitch entropy adjusted by count — penalizes predictability in leverage counts.',
  arsenal_synergy: 'Bayesian-shrunk pitch interaction score — does pitch A make pitch B better?',
  n_pitch_types: 'Number of distinct pitch types thrown.',
  best_secondary_whiff: 'Whiff rate of the best non-fastball pitch.',
  platoon_resistance: 'How well the pitcher performs against opposite-hand hitters.',
  pitcher_deception_index: 'Percentage of chases where the pitch was in-zone at the 167ms commit point.',
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
