import { useRef, useEffect, useMemo } from 'react';
import { pitchColor, PITCH_TYPE_COLORS } from '../data/constants';
import type { RawPitch } from '../types';

interface Props {
  pitches: RawPitch[];
  pitchTypeNames: Record<string, string>;
  width?: number;
  height?: number;
}

const BW = 1.0;   // KDE bandwidth in mph
const STEPS = 200; // resolution of KDE curve

function kde(velos: number[], x: number): number {
  let sum = 0;
  for (const v of velos) {
    const z = (x - v) / BW;
    sum += Math.exp(-0.5 * z * z);
  }
  return sum / (velos.length * BW * Math.sqrt(2 * Math.PI));
}

export function VelocityDistribution({ pitches, pitchTypeNames, width = 720, height = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const typeMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const p of pitches) {
      if (p.v > 50 && p.v < 115) {
        if (!m.has(p.pt)) m.set(p.pt, []);
        m.get(p.pt)!.push(p.v);
      }
    }
    return m;
  }, [pitches]);

  const allVelos = useMemo(() => pitches.filter(p => p.v > 50 && p.v < 115).map(p => p.v), [pitches]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeMap.size === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 10, right: 20, bottom: 36, left: 44 };
    const W = width - pad.left - pad.right;
    const H = height - pad.top - pad.bottom;

    ctx.clearRect(0, 0, width, height);

    // Velocity range
    const allV = [...allVelos];
    const vMin = Math.floor(Math.min(...allV) - 2);
    const vMax = Math.ceil(Math.max(...allV) + 2);
    const xs = Array.from({ length: STEPS }, (_, i) => vMin + (i / (STEPS - 1)) * (vMax - vMin));

    // Compute KDE for each pitch type + all
    const curves = new Map<string, number[]>();
    for (const [pt, velos] of typeMap) {
      curves.set(pt, xs.map(x => kde(velos, x)));
    }
    const allCurve = xs.map(x => kde(allVelos, x));

    // Find max density
    let maxDensity = 0;
    for (const vals of curves.values()) maxDensity = Math.max(maxDensity, ...vals);
    maxDensity = Math.max(maxDensity, ...allCurve);

    function toX(v: number) { return pad.left + ((v - vMin) / (vMax - vMin)) * W; }
    function toY(d: number) { return pad.top + H - (d / maxDensity) * H; }

    // Grid lines
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 1;
    const pctTicks = [0, 0.25, 0.5, 0.75, 1.0];
    for (const t of pctTicks) {
      const y = pad.top + H * (1 - t);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + W, y);
      ctx.stroke();
    }

    // Velocity axis ticks
    ctx.fillStyle = '#606080';
    ctx.font = `${10 * dpr / dpr}px monospace`;
    ctx.textAlign = 'center';
    for (let v = Math.ceil(vMin / 5) * 5; v <= vMax; v += 5) {
      const x = toX(v);
      ctx.fillText(`${v}`, x, pad.top + H + 20);
      ctx.strokeStyle = '#1e1e2e';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, pad.top + H);
      ctx.lineTo(x, pad.top + H + 4);
      ctx.stroke();
    }

    // Y-axis label
    ctx.save();
    ctx.translate(10, pad.top + H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#606080';
    ctx.font = '10px system-ui';
    ctx.fillText('Frequency', 0, 0);
    ctx.restore();

    // Draw each pitch type as filled area + line
    for (const [pt, ys] of curves) {
      const color = pitchColor(pt);
      ctx.beginPath();
      ctx.moveTo(toX(xs[0]!), toY(0));
      for (let i = 0; i < xs.length; i++) {
        ctx.lineTo(toX(xs[i]!), toY(ys[i]!));
      }
      ctx.lineTo(toX(xs[xs.length - 1]!), toY(0));
      ctx.closePath();
      ctx.fillStyle = color + '30';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(toX(xs[0]!), toY(ys[0]!));
      for (let i = 1; i < xs.length; i++) {
        ctx.lineTo(toX(xs[i]!), toY(ys[i]!));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // All pitches dashed line
    ctx.beginPath();
    ctx.moveTo(toX(xs[0]!), toY(allCurve[0]!));
    for (let i = 1; i < xs.length; i++) {
      ctx.lineTo(toX(xs[i]!), toY(allCurve[i]!));
    }
    ctx.strokeStyle = '#606080';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#606080';
    ctx.font = '10px system-ui';
    ctx.fillText('Velocity (mph)', pad.left + W / 2, height - 4);

  }, [typeMap, allVelos, width, height]);

  if (typeMap.size === 0) return null;

  const types = Array.from(typeMap.keys());

  return (
    <div>
      <canvas ref={canvasRef} style={{ width, height, maxWidth: '100%' }} />
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 4 }}>
        {types.map((pt) => (
          <span key={pt} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#a0a0b8' }}>
            <span style={{ width: 18, height: 3, background: pitchColor(pt), borderRadius: 2, flexShrink: 0 }} />
            {pitchTypeNames[pt] ?? pt}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#606080' }}>
          <svg width="18" height="3" style={{ flexShrink: 0 }}>
            <line x1="0" y1="1.5" x2="18" y2="1.5" stroke="#606080" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          All Pitches
        </span>
      </div>
    </div>
  );
}
