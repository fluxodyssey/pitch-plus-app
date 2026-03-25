/**
 * SimilarPitchers.tsx — Find Similar Pitchers by Dimension Profile
 *
 * Uses cosine similarity across all 6 Pitch+ dimension scores to find the N
 * pitchers most similar to the selected pitcher in the current season.
 *
 * Cosine similarity is ideal here: it measures the SHAPE of a pitcher's
 * dimension profile independent of magnitude, so a pitcher with scores
 * [130, 90, 120, 85, 110, 95] is "similar" to [125, 88, 118, 83, 107, 93]
 * even though their overall Pitch+ differs.
 *
 * Practical use case: "Who does this prospect remind you of?" — a classic
 * question in player development and evaluation.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/useData';
import { gradeColor, scoreColorContinuous } from '../data/constants';
import type { Pitcher, DimensionKey } from '../types';

const DIMENSION_KEYS: DimensionKey[] = [
  'stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal',
];

const DIM_LABELS: Record<DimensionKey, string> = {
  stuff: 'Stf',
  command: 'Cmd',
  deception: 'Dec',
  tunnel_and_sequence: 'Tun',
  outcomes: 'Out',
  arsenal: 'Ars',
};

// ── Similarity computation ────────────────────────────────────────────────────

function toVector(pitcher: Pitcher): number[] {
  return DIMENSION_KEYS.map((k) => pitcher.dimensions[k]?.score ?? 100);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, ai) => s + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((s, bi) => s + bi * bi, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  pitcher: Pitcher;
  n?: number;             // number of similar pitchers to show (default 6)
  showDimensions?: boolean;
}

export function SimilarPitchers({ pitcher, n = 6, showDimensions = true }: Props) {
  const { data } = useData();

  const similar = useMemo(() => {
    if (!data) return [];
    const allPitchers = data.pitchers.pitchers;
    const targetVec = toVector(pitcher);

    return allPitchers
      .filter((p) => p.pitcher_id !== pitcher.pitcher_id)
      .map((p) => ({
        pitcher: p,
        similarity: cosineSimilarity(targetVec, toVector(p)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, n);
  }, [data, pitcher, n]);

  if (similar.length === 0) {
    return <p style={{ color: 'var(--text-4)', fontSize: 13 }}>No similar pitchers found.</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--text-3)' }}>
        Ranked by cosine similarity of 6-dimension Pitch+ profile.
        Same profile shape ≠ same skill level — similarity measures pitcher archetype.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {similar.map(({ pitcher: p, similarity }) => (
          <Link
            key={p.pitcher_id}
            to={`/player/${p.pitcher_id}`}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-plus)',
              borderRadius: 10,
              padding: '12px 16px',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-plus)')}
            >
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: showDimensions ? 8 : 0 }}>
                <div>
                  <span style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 14 }}>
                    {p.pitcher_name}
                  </span>
                  <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>
                    {p.pitcher_team} · {p.pitcher_hand}HP
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {/* Similarity score */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>similarity</div>
                    <div style={{
                      fontSize: 14, fontWeight: 700,
                      color: similarity > 0.995
                        ? '#4ade80' : similarity > 0.985
                        ? 'var(--text-2)' : 'var(--text-3)',
                    }}>
                      {(similarity * 100).toFixed(1)}%
                    </div>
                  </div>
                  {/* Pitch+ badge */}
                  <div style={{
                    background: gradeColor(p.pitch_plus),
                    color: '#fff', borderRadius: 6,
                    padding: '3px 10px', fontSize: 14, fontWeight: 700,
                    minWidth: 42, textAlign: 'center',
                  }}>
                    {p.pitch_plus}
                  </div>
                </div>
              </div>

              {/* Dimension mini-bars */}
              {showDimensions && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {DIMENSION_KEYS.map((dk) => {
                    const score = p.dimensions[dk]?.score ?? 100;
                    return (
                      <div key={dk} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 2 }}>
                          {DIM_LABELS[dk]}
                        </div>
                        <div style={{
                          background: scoreColorContinuous(score, 0.3),
                          borderRadius: 4, padding: '2px 0',
                          fontSize: 10, fontWeight: 600,
                          color: score >= 115 ? 'var(--text-1)' : score <= 85 ? 'var(--text-1)' : 'var(--text-2)',
                        }}>
                          {score}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
