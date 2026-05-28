import { useRef, useEffect, useMemo } from 'react';
import { pitchColor, scoreColorContinuous } from '../data/constants';
import type { RawPitch, PitchTypeGrade } from '../types';

interface Props {
  pitches: RawPitch[];
  grades: PitchTypeGrade[];
  pitchTypeNames?: Record<string, string>;
  width?: number;
  height?: number;
  compact?: boolean;
  showTable?: boolean;
}

const PAD = { top: 20, right: 20, bottom: 40, left: 48 };
const HB_RANGE: [number, number] = [-30, 30];
const IVB_RANGE: [number, number] = [-22, 26];

// ── Eigendecompose 2×2 symmetric covariance in screen space ──────────────────
// Projects data-space covariance to screen pixels (accounts for non-uniform axes).
// Returns semi-axis lengths already in pixels and angle in canvas coords.
function computeEllipse(
  hbs: number[],
  ivbs: number[],
  scaleX: number,   // px per inch  (positive)
  scaleY: number,   // px per inch  (negative — y down in canvas)
): { cx: number; cy: number; rxPx: number; ryPx: number; angle: number } | null {
  const n = hbs.length;
  if (n < 6) return null;
  const mx = hbs.reduce((a, b) => a + b, 0) / n;
  const my = ivbs.reduce((a, b) => a + b, 0) / n;
  let cxx = 0, cyy = 0, cxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = hbs[i]! - mx;
    const dy = ivbs[i]! - my;
    cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
  }
  cxx /= (n - 1); cyy /= (n - 1); cxy /= (n - 1);
  // Project into screen space
  const sxx = cxx * scaleX * scaleX;
  const syy = cyy * scaleY * scaleY;
  const sxy = cxy * scaleX * scaleY;
  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
  const l1 = trace / 2 + disc;
  const l2 = trace / 2 - disc;
  const angle = Math.atan2(sxy, l1 - syy);
  return { cx: mx, cy: my, rxPx: Math.sqrt(Math.max(0, l1)), ryPx: Math.sqrt(Math.max(0, l2)), angle };
}

export function MovementProfileChart({
  pitches,
  grades,
  pitchTypeNames,
  width = 480,
  height = 360,
  compact = false,
  showTable = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const W = width - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;

  const scaleX = W / (HB_RANGE[1] - HB_RANGE[0]);
  const scaleY = -(H / (IVB_RANGE[1] - IVB_RANGE[0]));  // negative: y down in canvas

  const toX = (hb: number) => PAD.left + (hb - HB_RANGE[0]) * scaleX;
  const toY = (ivb: number) => PAD.top + H + (ivb - IVB_RANGE[0]) * scaleY;  // scaleY < 0

  // Group pitches by type for ellipse computation
  const pitchesByType = useMemo(() => {
    const map = new Map<string, { hbs: number[]; ivbs: number[] }>();
    for (const p of pitches) {
      if (!map.has(p.pt)) map.set(p.pt, { hbs: [], ivbs: [] });
      const e = map.get(p.pt)!;
      e.hbs.push(p.hb);
      e.ivbs.push(p.ivb);
    }
    return map;
  }, [pitches]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pitches.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // ── Grid ─────────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#131826';
    ctx.lineWidth = 1;
    for (let hb = -24; hb <= 24; hb += 6) {
      ctx.beginPath(); ctx.moveTo(toX(hb), PAD.top); ctx.lineTo(toX(hb), PAD.top + H); ctx.stroke();
    }
    for (let ivb = -18; ivb <= 24; ivb += 6) {
      ctx.beginPath(); ctx.moveTo(PAD.left, toY(ivb)); ctx.lineTo(PAD.left + W, toY(ivb)); ctx.stroke();
    }

    // Zero axes
    ctx.strokeStyle = '#252540';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(toX(0), PAD.top); ctx.lineTo(toX(0), PAD.top + H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left, toY(0)); ctx.lineTo(PAD.left + W, toY(0)); ctx.stroke();
    ctx.setLineDash([]);

    // Axis tick labels
    ctx.fillStyle = '#3a3a58';
    ctx.font = `${compact ? 8 : 9}px monospace`;
    ctx.textAlign = 'center';
    for (let hb = -24; hb <= 24; hb += 12) {
      ctx.fillText(`${hb}"`, toX(hb), PAD.top + H + 14);
    }
    ctx.textAlign = 'right';
    for (let ivb = -18; ivb <= 24; ivb += 6) {
      ctx.fillText(`${ivb}`, PAD.left - 4, toY(ivb) + 3);
    }

    // Axis titles
    ctx.fillStyle = '#505070';
    ctx.font = `${compact ? 9 : 10}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText('Horizontal Break (in)', PAD.left + W / 2, height - 4);
    ctx.save();
    ctx.translate(11, PAD.top + H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Induced Vertical Break (in)', 0, 0);
    ctx.restore();

    // ── Individual pitch dots ─────────────────────────────────────────────────
    ctx.globalAlpha = compact ? 0.38 : 0.48;
    for (const p of pitches) {
      ctx.beginPath();
      ctx.arc(toX(p.hb), toY(p.ivb), compact ? 2 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = pitchColor(p.pt);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Confidence ellipses + tail lines + cluster markers ───────────────────
    for (const [pt, { hbs, ivbs }] of pitchesByType) {
      const color = pitchColor(pt);
      const params = computeEllipse(hbs, ivbs, scaleX, scaleY);
      if (!params) {
        // Too few pitches: just draw a center dot
        if (hbs.length > 0) {
          const mx = hbs.reduce((a, b) => a + b, 0) / hbs.length;
          const my = ivbs.reduce((a, b) => a + b, 0) / ivbs.length;
          ctx.beginPath();
          ctx.arc(toX(mx), toY(my), 4, 0, Math.PI * 2);
          ctx.fillStyle = color + '80';
          ctx.fill();
        }
        continue;
      }

      const cx = toX(params.cx);
      const cy = toY(params.cy);

      // Tail line from origin to cluster center
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(cx, cy);
      ctx.strokeStyle = color + '28';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 1-sigma ellipse
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(params.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(params.rxPx, 2), Math.max(params.ryPx, 1), 0, 0, Math.PI * 2);
      ctx.fillStyle = color + '14';
      ctx.fill();
      ctx.strokeStyle = color + '50';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Cluster center marker
      ctx.beginPath();
      ctx.arc(cx, cy, compact ? 4 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color + '35';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pitch type label
      ctx.fillStyle = color;
      ctx.font = `700 ${compact ? 9 : 11}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText(pt, cx, cy + (compact ? 3 : 4));
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitches, pitchesByType, width, height, compact]);

  if (pitches.length === 0) {
    return <div style={{ color: '#606080', textAlign: 'center', padding: 40 }}>No pitch data</div>;
  }

  const fs = compact ? 11 : 12;
  const hfs = compact ? 10 : 11;
  const pad = compact ? '4px 8px' : '6px 10px';

  return (
    <div>
      {showTable && grades.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fs }}>
            <thead>
              <tr>
                {['PITCH', '#', '%', 'VELO', 'SPIN', 'IVB', 'HB', 'proSTUFF+'].map(h => (
                  <th key={h} style={{
                    padding: pad, color: '#505070', fontWeight: 500, fontSize: hfs,
                    textAlign: h === 'PITCH' ? 'left' : 'right',
                    borderBottom: '1px solid #1a1a2e',
                    textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grades.map(g => {
                const color = pitchColor(g.pitchType);
                return (
                  <tr key={g.pitchType} style={{ borderBottom: '1px solid #10101c' }}>
                    <td style={{ padding: pad, textAlign: 'left' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          background: color + '22', border: `1px solid ${color}55`,
                          borderRadius: 4, padding: '1px 5px',
                          fontSize: compact ? 9 : 10, fontFamily: 'monospace',
                          letterSpacing: 0.5, color,
                        }}>{g.pitchType}</span>
                        <span style={{ color: '#8890a0', fontWeight: 400 }}>
                          {pitchTypeNames?.[g.pitchType] ?? g.pitchName}
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: pad, textAlign: 'right', fontFamily: 'monospace', color: '#e0e0e8' }}>{g.count}</td>
                    <td style={{ padding: pad, textAlign: 'right', fontFamily: 'monospace', color: '#8890a0' }}>{(g.usagePct * 100).toFixed(0)}%</td>
                    <td style={{ padding: pad, textAlign: 'right', fontFamily: 'monospace', color: '#e0e0e8' }}>
                      {g.avgVelo != null ? g.avgVelo.toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: pad, textAlign: 'right', fontFamily: 'monospace', color: '#8890a0' }}>
                      {g.avgSpin != null ? Math.round(g.avgSpin) : '—'}
                    </td>
                    <td style={{ padding: pad, textAlign: 'right', fontFamily: 'monospace', color: '#e0e0e8' }}>
                      {g.avgIvb != null ? (g.avgIvb >= 0 ? '+' : '') + g.avgIvb.toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: pad, textAlign: 'right', fontFamily: 'monospace', color: '#e0e0e8' }}>
                      {g.avgHb != null ? (g.avgHb >= 0 ? '+' : '') + g.avgHb.toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: pad, textAlign: 'right' }}>
                      <span style={{
                        background: scoreColorContinuous(g.stuffGrade, 0.2),
                        border: `1px solid ${scoreColorContinuous(g.stuffGrade, 0.5)}`,
                        color: scoreColorContinuous(g.stuffGrade, 1),
                        borderRadius: 4, padding: '2px 6px',
                        fontFamily: 'monospace', fontWeight: 700,
                        fontSize: compact ? 10 : 11,
                      }}>{g.stuffGrade}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ width, height, maxWidth: '100%', display: 'block' }}
      />
    </div>
  );
}
