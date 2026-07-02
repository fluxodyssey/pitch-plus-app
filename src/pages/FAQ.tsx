/**
 * FAQ.tsx — Pitch+ Model Explanation & Methodology
 *
 * Route: /faq
 * Collapsible accordion sections explaining the Pitch+ ecosystem.
 */

import { useState } from 'react';

// ── Accordion ─────────────────────────────────────────────────────────────────

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      border: '1px solid #1e1e2e',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: open ? '#16162a' : '#12121e',
          border: 'none',
          padding: '14px 18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#e0e0e8',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: 'var(--sans)',
          transition: 'background 0.15s',
        }}
      >
        <span>{title}</span>
        <span style={{ color: '#4a9eff', fontSize: 18, lineHeight: 1 }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '16px 18px 20px', background: '#10101a', color: '#c0c0d0', fontSize: 14, lineHeight: 1.7 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Shared components ──────────────────────────────────────────────────────────

function Highlight({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#4a9eff', fontWeight: 600 }}>{children}</span>;
}

function GradeRow({ grade, range, desc }: { grade: string; range: string; desc: string }) {
  const colors: Record<string, string> = {
    'A+': '#10b981', A: '#34d399', 'B+': '#6ee7b7', B: '#a0a0b8',
    'C+': '#60a5fa', C: '#3b82f6', D: '#6b7280',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <span style={{
        background: (colors[grade] ?? '#888') + '22',
        color: colors[grade] ?? '#888',
        border: `1px solid ${colors[grade] ?? '#888'}44`,
        borderRadius: 5, padding: '2px 10px', fontWeight: 700, minWidth: 32,
        textAlign: 'center', fontSize: 13,
      }}>{grade}</span>
      <span style={{ color: '#a0a0b8', fontSize: 13, minWidth: 60 }}>{range}</span>
      <span style={{ color: '#c0c0d0', fontSize: 13 }}>{desc}</span>
    </div>
  );
}

function DimRow({ name, metrics, color = '#4a9eff', weight }: {
  name: string; metrics: string; color?: string; weight: string;
}) {
  return (
    <div style={{ marginBottom: 14, paddingLeft: 12, borderLeft: `3px solid ${color}` }}>
      <div style={{ color, fontWeight: 600, fontSize: 14 }}>{name} <span style={{ color: '#606080', fontWeight: 400, fontSize: 12 }}>({weight} of Pitch+)</span></div>
      <div style={{ color: '#a0a0b8', fontSize: 13, marginTop: 4 }}>{metrics}</div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────────

export function FAQ() {
  return (
    <div style={{ padding: '28px 24px', maxWidth: 820, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e0e0e8', margin: '0 0 8px 0' }}>
          Pitch<span style={{ color: '#4a9eff' }}>+</span> Methodology & FAQ
        </h1>
        <p style={{ color: '#606080', fontSize: 14, margin: 0 }}>
          How the models work, what the scores mean, and how to interpret them.
        </p>
      </div>

      {/* Sections */}
      <Accordion title="What is Pitch+?" defaultOpen>
        <p>
          <Highlight>Pitch+</Highlight> is a composite pitching grade that places every MLB pitcher on a
          single 100-point scale — the same convention used by wRC+, ERA+, and OPS+.
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 10 }}>
          <li><strong>100 = MLB average.</strong> A score of 100 is exactly league-average performance for the season.</li>
          <li><strong>σ = 15.</strong> One standard deviation is 15 points — so a 115 is one full SD above average, and an 85 is one SD below.</li>
          <li><strong>Clipped at [20, 180]</strong> to prevent outlier distortion from very small samples.</li>
          <li>Pitch+ measures <em>how you pitch</em>, not just results. It rewards stuff, movement, command, and deception — not sequencing luck.</li>
        </ul>
        <p style={{ marginTop: 12, color: '#a0a0b8' }}>
          The model is calibrated on all MLB pitchers from 2021–2025 (minimum 100 pitches per season). It is <strong>not</strong> a predictive ERA estimator — it measures observable quality of pitching.
        </p>
      </Accordion>

      <Accordion title="The 6 Dimensions">
        <p style={{ marginBottom: 16 }}>
          Pitch+ is decomposed into 6 underlying dimensions, each scored on the same 100-point scale.
          The composite Pitch+ is a weighted average.
        </p>
        <DimRow
          name="Stuff" weight="15%"
          color="#ef4444"
          metrics="Pitch stuff Z-score, extension-adjusted velocity, spin quality, seam-shifted wake proxy, bat-speed suppression, swing-quality degradation."
        />
        <DimRow
          name="Command" weight="21%"
          color="#f59e0b"
          metrics="BIP-adjusted K-BB% (K×1.3 − BB%), zone rate, location precision, first-pitch strike rate, edge rate, take run value (passive command), race to 2 strikes, Markov efficiency."
        />
        <DimRow
          name="Deception" weight="18%"
          color="#8b5cf6"
          metrics="In-zone whiff rate, zone-weighted chase, CSW rate, extension, fastball VAA, swing-length inducement, release consistency, regime whiff delta (count adaptation)."
        />
        <DimRow
          name="Tunnel &amp; Sequence" weight="9%"
          color="#06b6d4"
          metrics="Temporal tunnel tightness (velocity-adjusted commit point), tunnel effectiveness, release uniqueness, sequence surprise, speed &amp; movement differentials."
        />
        <DimRow
          name="Outcomes" weight="22%"
          color="#10b981"
          metrics="Swing RV against (r=0.854 vs ERA — crown jewel), K rate, BB rate, BIP rate, in-zone swing RV, wRC+ against, exit velocity against, GB rate, barrel rate, Markov dominance."
        />
        <DimRow
          name="Arsenal" weight="15%"
          color="#f97316"
          metrics="Count-conditional entropy, arsenal synergy, best secondary whiff rate, spin &amp; speed diversity, platoon resistance, pitch count, pitch entropy."
        />
      </Accordion>

      <Accordion title="Grade Scale">
        <p style={{ marginBottom: 14 }}>The letter grade system mirrors the conventional wRC+ / ERA+ interpretation:</p>
        <GradeRow grade="A+" range="≥ 130" desc="Elite — top ~5% of MLB" />
        <GradeRow grade="A"  range="≥ 115" desc="Above average — top 15%" />
        <GradeRow grade="B+" range="≥ 105" desc="Solid — above average" />
        <GradeRow grade="B"  range="≥ 95"  desc="Average MLB starter quality" />
        <GradeRow grade="C+" range="≥ 85"  desc="Below average — fringe roster" />
        <GradeRow grade="C"  range="≥ 70"  desc="Poor — replacement level" />
        <GradeRow grade="D"  range="< 70"  desc="Very poor" />
      </Accordion>

      <Accordion title="Novel Metrics (v3.1)">
        <p style={{ marginBottom: 12 }}>
          These 8 metrics were added in model v3.1 after backtesting against 2021–2025 data.
          Each was validated for ERA correlation and year-over-year stability (YoY r):
        </p>
        {[
          { name: 'Swing RV Against', key: 'swing_rv_against', r: '+0.854', yoy: '0.780', note: 'Mean run value on pitches batters swing at. Best single ERA predictor found.' },
          { name: 'BIP-Adjusted K-BB%', key: 'bip_adjusted_kbb', r: '−0.601', yoy: '0.720', note: 'K%×1.3 − BB%. Weights strikeouts more because they prevent BIP contact.' },
          { name: 'BIP Rate', key: 'bip_rate', r: '+0.482', yoy: '0.740', note: 'Balls-in-play per PA. Fewer BIP = fewer chances for luck to interfere.' },
          { name: 'Take RV Against', key: 'take_rv_against', r: '+0.362', yoy: '0.645', note: '"Passive command" — run value on pitches batters don\'t swing at.' },
          { name: 'Markov Dominance', key: 'markov_dominance', r: '+0.410', yoy: '0.690', note: 'P(K | starting from 0-0) from absorbing Markov chain simulation.' },
          { name: 'Markov Efficiency', key: 'markov_efficiency', r: '−0.355', yoy: '0.620', note: 'Expected pitches per PA from 0-0. Lower = more efficient pitcher.' },
          { name: 'Regime Whiff Delta', key: 'regime_whiff_delta', r: '+0.290', yoy: '0.560', note: 'Whiff% when ahead vs behind in count. Measures pitch quality under pressure.' },
          { name: 'In-Zone Swing RV', key: 'in_zone_swing_rv', r: '+0.799', yoy: '0.750', note: 'Swing RV restricted to zone pitches — quality-of-contact suppression.' },
        ].map(({ name, r, yoy, note }) => (
          <div key={name} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: '2px solid #2a2a3e' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ color: '#e0e0e8', fontWeight: 600, fontSize: 14 }}>{name}</span>
              <span style={{ color: '#10b981', fontSize: 12 }}>ERA r={r}</span>
              <span style={{ color: '#60a5fa', fontSize: 12 }}>YoY={yoy}</span>
            </div>
            <div style={{ color: '#a0a0b8', fontSize: 13, marginTop: 4 }}>{note}</div>
          </div>
        ))}
      </Accordion>

      <Accordion title="Swing+ & Decision+">
        <p>
          <Highlight>Swing+</Highlight> evaluates batters on the same 100-point scale (100 = MLB average).
          It decomposes into 7 dimensions:
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8, marginBottom: 12 }}>
          <li><strong>Power Ceiling</strong> — EV90, max EV, hard-hit rate</li>
          <li><strong>Batted Ball Quality</strong> — xwOBA, xSLG, barrel rate</li>
          <li><strong>Barrel Accuracy</strong> — sweet spot rate, ideal attack angle rate</li>
          <li><strong>Swing Efficiency</strong> — bat speed, swing length, speed/length ratio</li>
          <li><strong>Swing Decisions</strong> — chase rate, zone swing rate, competitive swing rate</li>
          <li><strong>Contact Quality</strong> — zone contact rate, breaking ball contact</li>
          <li><strong>Pitch Handling</strong> — velo adjustment, fastball EV, breaking ball EV</li>
        </ul>
        <p>
          <Highlight>Decision+</Highlight> uses the <strong>Tango 167ms commit point model</strong> to classify
          every swing as a quality decision (batter committed to a pitch that was hittable at commit time)
          or a poor decision (chased a pitch that had already moved outside by commit time).
        </p>
      </Accordion>

      <Accordion title="Matchup Machine Methodology">
        <p>
          The <Highlight>Matchup Machine</Highlight> projects a batter's outcomes against a specific pitcher
          using <strong>pitcher similarity regression</strong>:
        </p>
        <ol style={{ paddingLeft: 20, marginTop: 10 }}>
          <li style={{ marginBottom: 8 }}>Find the <strong>top-20 most similar pitchers</strong> to the selected pitcher (from the pitcher similarity model, constrained by hand + role).</li>
          <li style={{ marginBottom: 8 }}>Look up the batter's historical outcomes against each similar pitcher.</li>
          <li style={{ marginBottom: 8 }}>Weight outcomes by similarity score (more similar = higher weight).</li>
          <li style={{ marginBottom: 8 }}>Regress toward the batter's overall season rates (Marcel-style: more observed PA = less regression).</li>
          <li style={{ marginBottom: 8 }}>Compute matchup grade: (projected xwOBA − LG avg) / σ, scaled to [−10, +10].</li>
        </ol>
        <p style={{ marginTop: 12, color: '#a0a0b8' }}>
          <strong>Confidence:</strong> High if ≥30 weighted PA against similar pitchers; Medium if ≥10; Low otherwise.
          Low confidence projections fall back to the batter's vs-hand splits.
        </p>
      </Accordion>

      <Accordion title="Data Sources">
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Pitch data:</strong> Statcast (via pybaseball), 2021–2025 MLB seasons</li>
          <li><strong>Player IDs:</strong> MLBAM IDs from Statcast throughout; player names backfilled via the Chadwick Bureau register</li>
          <li><strong>wOBA weights:</strong> static FanGraphs-published linear weights, maintained manually as constants in the model — not a live data feed (the FanGraphs API integration was removed in 2026)</li>
          <li><strong>Bat tracking:</strong> Statcast bat speed & swing length data (available 2024–2025 only)</li>
          <li><strong>Markov chain:</strong> Custom absorbing Markov chain over MLB pitch data, computing K/BB/BIP absorption probabilities from each count state</li>
        </ul>
        <p style={{ marginTop: 12, color: '#a0a0b8', fontSize: 13 }}>
          All models are open-source and run locally. No third-party analytics APIs are used.
          Data is refreshed whenever the full pipeline is re-run against new Statcast data.
        </p>
      </Accordion>

      <Accordion title="Frequently Asked Questions">
        {[
          {
            q: 'Why does Pitch+ sometimes differ from ERA or FIP?',
            a: 'Pitch+ measures observed quality of pitching process — not results. ERA is affected by defense, sequencing luck, and inherited runners. A pitcher with a 130 Pitch+ but 4.50 ERA is being unlucky; a 80 Pitch+ with a 2.80 ERA is overperforming their underlying quality.',
          },
          {
            q: 'What is the minimum sample size for reliable grades?',
            a: 'Season grades require ≥100 pitches. Per-game grades require ≥20 pitches but include Bayesian shrinkage toward season averages — small-sample game grades are pulled toward the pitcher\'s known quality. The prior strength varies by metric: noisier metrics (tunnel, swing suppression) shrink more than rate metrics (K%, zone rate).',
          },
          {
            q: 'Why are some pitcher grades missing in older seasons?',
            a: 'Some metrics require bat speed data (2024–2025 only) or specific Statcast columns added after 2021. When a metric cannot be computed, it defaults to 100 (population mean) and is excluded from the composite calculation.',
          },
          {
            q: 'What does "pitcher similarity" measure?',
            a: 'Similarity uses weighted Euclidean distance over a feature vector of 6 dimension scores, top pitch type attributes, arsenal composition, and outcome rates — normalized to z-scores and weighted by feature importance. It is constrained to same-hand, same-role comparisons. 100% = identical; 80%+ = very similar archetypes.',
          },
        ].map(({ q, a }) => (
          <div key={q} style={{ marginBottom: 18 }}>
            <div style={{ color: '#e0e0e8', fontWeight: 600, marginBottom: 5 }}>{q}</div>
            <div style={{ color: '#a0a0b8', fontSize: 13, lineHeight: 1.6 }}>{a}</div>
          </div>
        ))}
      </Accordion>

    </div>
  );
}
