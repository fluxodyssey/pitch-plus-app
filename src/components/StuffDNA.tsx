import { useRef, useEffect, useState, useCallback } from 'react';
import { pitchColor, scoreColorContinuous } from '../data/constants';
import { AttributeGauges } from './AttributeGauges';
import type { PitchType, AttributeGrades, PitchAttributesData } from '../types';

interface Props {
  pitchTypes: PitchType[];
  attributesByType: Record<string, AttributeGrades> | null;
  leagueMovement: PitchAttributesData['league_movement'] | null;
  pitchTypeNames: Record<string, string>;
  width?: number;
  height?: number;
  onPitchTypeClick?: (pt: string) => void;
  highlightedTypes?: string[];
}

const PAD = { top: 30, right: 60, bottom: 40, left: 50 };
const HB_RANGE: [number, number] = [-28, 28];
const IVB_RANGE: [number, number] = [-20, 24];

export function StuffDNA({
  pitchTypes,
  attributesByType,
  leagueMovement,
  pitchTypeNames,
  width = 480,
  height = 400,
  onPitchTypeClick,
  highlightedTypes,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Only pitch types with attribute data
  const displayTypes = pitchTypes.filter(pt =>
    pt.n >= 20 &&
    (attributesByType?.[pt.pitch_type] != null || pt.hb != null)
  );

  const W = width - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;

  // useCallback so these can sit in the draw effect's deps without re-running
  // it every render — identity only changes when the plot area resizes.
  const toX = useCallback((hb: number) => PAD.left + ((hb - HB_RANGE[0]) / (HB_RANGE[1] - HB_RANGE[0])) * W, [W]);
  const toY = useCallback((ivb: number) => PAD.top + H - ((ivb - IVB_RANGE[0]) / (IVB_RANGE[1] - IVB_RANGE[0])) * H, [H]);

  function hitTest(mx: number, my: number): string | null {
    for (const pt of displayTypes) {
      const attrs = attributesByType?.[pt.pitch_type];
      const hb = attrs?.avg_hb ?? pt.hb ?? 0;
      const ivb = attrs?.avg_ivb ?? pt.ivb ?? 0;
      const r = 8 + (pt.usage_pct * 40);
      const dx = mx - toX(hb);
      const dy = my - toY(ivb);
      if (dx * dx + dy * dy <= r * r) return pt.pitch_type;
    }
    return null;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || displayTypes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // ── Grid ─────────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 1;
    for (let hb = -24; hb <= 24; hb += 6) {
      ctx.beginPath(); ctx.moveTo(toX(hb), PAD.top); ctx.lineTo(toX(hb), PAD.top + H); ctx.stroke();
    }
    for (let ivb = -18; ivb <= 22; ivb += 6) {
      ctx.beginPath(); ctx.moveTo(PAD.left, toY(ivb)); ctx.lineTo(PAD.left + W, toY(ivb)); ctx.stroke();
    }

    // Zero axes
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(toX(0), PAD.top); ctx.lineTo(toX(0), PAD.top + H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left, toY(0)); ctx.lineTo(PAD.left + W, toY(0)); ctx.stroke();
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = '#404060';
    ctx.font = `${9}px monospace`;
    ctx.textAlign = 'center';
    for (let hb = -24; hb <= 24; hb += 12) {
      ctx.fillText(`${hb}"`, toX(hb), PAD.top + H + 14);
    }
    ctx.textAlign = 'right';
    for (let ivb = -12; ivb <= 18; ivb += 6) {
      ctx.fillText(`${ivb}"`, PAD.left - 4, toY(ivb) + 3);
    }

    // Axis titles
    ctx.fillStyle = '#606080';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Horizontal Break (in)', PAD.left + W / 2, height - 6);
    ctx.save();
    ctx.translate(12, PAD.top + H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Induced Vertical Break (in)', 0, 0);
    ctx.restore();

    // ── League average density clouds per pitch type ──────────────────────────
    if (leagueMovement) {
      for (const [pt, lm] of Object.entries(leagueMovement)) {
        const color = pitchColor(pt);
        const cx = toX(lm.hb_mean);
        const cy = toY(lm.ivb_mean);
        const rx = (lm.hb_std / (HB_RANGE[1] - HB_RANGE[0])) * W;
        const ry = (lm.ivb_std / (IVB_RANGE[1] - IVB_RANGE[0])) * H;

        // Draw elliptical "cloud"
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * 1.2);
        grad.addColorStop(0, `${color}18`);
        grad.addColorStop(1, `${color}00`);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(rx, ry) * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // League average × marker
        ctx.fillStyle = `${color}50`;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('×', cx, cy + 3);
      }
    }

    // ── Pitch nodes ──────────────────────────────────────────────────────────
    for (const pt of displayTypes) {
      const attrs = attributesByType?.[pt.pitch_type];
      const hb = attrs?.avg_hb ?? pt.hb ?? 0;
      const ivb = attrs?.avg_ivb ?? pt.ivb ?? 0;
      const overall = attrs?.overall ?? 100;
      const cx = toX(hb);
      const cy = toY(ivb);
      const baseR = 10 + pt.usage_pct * 45;
      const color = pitchColor(pt.pitch_type);
      const isHighlighted = !highlightedTypes?.length || highlightedTypes.includes(pt.pitch_type);
      const isHovered = hovered === pt.pitch_type;
      const alpha = isHighlighted ? 1 : 0.25;

      // Grade-based border thickness (thicker = better attribute grade)
      const borderW = 1 + (overall / 200) * 5;

      // Outer glow for hovered
      if (isHovered) {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR + 8);
        glow.addColorStop(0, `${color}30`);
        glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fill circle
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.fillStyle = `${color}30`;
      ctx.fill();

      // Border colored by grade
      const borderColor = scoreColorContinuous(overall, 0.9);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderW;
      ctx.stroke();

      // Pitch type label
      ctx.fillStyle = isHovered ? '#fff' : color;
      ctx.font = `${isHovered ? 600 : 500} ${11}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText(pt.pitch_type, cx, cy + 3);

      ctx.globalAlpha = 1;

      // Usage pct below label
      if (baseR > 14) {
        ctx.fillStyle = `${color}80`;
        ctx.font = '8px monospace';
        ctx.fillText(`${(pt.usage_pct * 100).toFixed(0)}%`, cx, cy + baseR + 9);
      }
    }

  }, [displayTypes, attributesByType, leagueMovement, hovered, highlightedTypes, width, height, W, H, toX, toY]);

  const hoveredAttrs = hovered ? attributesByType?.[hovered] : null;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, maxWidth: '100%', cursor: onPitchTypeClick ? 'pointer' : 'default' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const scaleX = width / rect.width;
          const mx = (e.clientX - rect.left) * scaleX;
          const my = (e.clientY - rect.top) * scaleX;
          const hit = hitTest(mx, my);
          setHovered(hit);
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const scaleX = width / rect.width;
          const mx = (e.clientX - rect.left) * scaleX;
          const my = (e.clientY - rect.top) * scaleX;
          const hit = hitTest(mx, my);
          if (hit && onPitchTypeClick) onPitchTypeClick(hit);
        }}
      />

      {/* Hover tooltip */}
      {hovered && hoveredAttrs && (
        <div style={{
          position: 'absolute',
          left: tooltipPos.x + 12,
          top: tooltipPos.y - 20,
          background: '#14141f',
          border: `1px solid ${pitchColor(hovered)}`,
          borderRadius: 8,
          padding: '10px 14px',
          minWidth: 200,
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ color: pitchColor(hovered), fontWeight: 700, fontSize: 14 }}>
              {pitchTypeNames[hovered] ?? hovered}
            </span>
            <span style={{
              background: `${scoreColorContinuous(hoveredAttrs.overall, 0.2)}`,
              border: `1px solid ${scoreColorContinuous(hoveredAttrs.overall, 0.5)}`,
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 11,
              fontWeight: 700,
              color: scoreColorContinuous(hoveredAttrs.overall, 1),
              fontFamily: 'monospace',
              marginLeft: 'auto',
            }}>
              {Math.round(hoveredAttrs.overall)}
            </span>
          </div>
          <AttributeGauges attrs={hoveredAttrs} compact />
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#606080' }}>
            <span>{hoveredAttrs.avg_velo.toFixed(1)} mph</span>
            <span>iVB {hoveredAttrs.avg_ivb.toFixed(1)}"</span>
            <span>HB {hoveredAttrs.avg_hb.toFixed(1)}"</span>
          </div>
        </div>
      )}
    </div>
  );
}
