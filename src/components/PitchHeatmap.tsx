import { useRef, useEffect } from 'react';
import { scoreColorContinuous } from '../data/constants';
import type { RawPitch } from '../types';

interface Props {
  pitches: RawPitch[];
  colorBy?: 'density' | 'whiffRate';
  width?: number;
  height?: number;
}

const GRID = 25;
const X_MIN = -2.0;
const X_MAX = 2.0;
const Z_MIN = 0.5;
const Z_MAX = 4.5;
const SIGMA = 0.6; // Gaussian kernel sigma in grid cells

function gaussianWeight(dx: number, dy: number, sigma: number): number {
  return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
}

export function PitchHeatmap({ pitches, colorBy = 'density', width = 340, height = 380 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const cellW = width / GRID;
    const cellH = height / GRID;
    const xRange = X_MAX - X_MIN;
    const zRange = Z_MAX - Z_MIN;

    // Initialize grid
    const counts: number[][] = Array.from({ length: GRID }, () => new Array(GRID).fill(0));
    const whiffs: number[][] = Array.from({ length: GRID }, () => new Array(GRID).fill(0));
    const swings: number[][] = Array.from({ length: GRID }, () => new Array(GRID).fill(0));

    // Place pitches into grid with Gaussian smoothing
    for (const p of pitches) {
      const gx = ((p.px - X_MIN) / xRange) * GRID;
      const gy = ((Z_MAX - p.pz) / zRange) * GRID; // invert Y so top = high Z

      const minI = Math.max(0, Math.floor(gx - 3 * SIGMA));
      const maxI = Math.min(GRID - 1, Math.ceil(gx + 3 * SIGMA));
      const minJ = Math.max(0, Math.floor(gy - 3 * SIGMA));
      const maxJ = Math.min(GRID - 1, Math.ceil(gy + 3 * SIGMA));

      for (let j = minJ; j <= maxJ; j++) {
        const countsRow = counts[j]!;
        const swingsRow = swings[j]!;
        const whiffsRow = whiffs[j]!;
        for (let i = minI; i <= maxI; i++) {
          const w = gaussianWeight(gx - (i + 0.5), gy - (j + 0.5), SIGMA);
          countsRow[i]! += w;
          if (p.sw) swingsRow[i]! += w;
          if (p.wh) whiffsRow[i]! += w;
        }
      }
    }

    // Find max for normalization
    let maxVal = 0;
    for (let j = 0; j < GRID; j++) {
      const row = counts[j]!;
      for (let i = 0; i < GRID; i++) {
        if (row[i]! > maxVal) maxVal = row[i]!;
      }
    }

    // Draw cells
    for (let j = 0; j < GRID; j++) {
      const countsRow = counts[j]!;
      const swingsRow = swings[j]!;
      const whiffsRow = whiffs[j]!;
      for (let i = 0; i < GRID; i++) {
        const count = countsRow[i]!;
        if (count < 0.01) continue;

        let alpha: number;
        let color: string;

        if (colorBy === 'whiffRate') {
          const sw = swingsRow[i]!;
          const wh = whiffsRow[i]!;
          if (sw < 0.5) continue; // not enough swings to compute rate
          const rate = wh / sw; // 0 to 1
          // Map whiff rate to score: higher = better for pitcher = red
          const score = 50 + rate * 100;
          alpha = Math.min(count / (maxVal * 0.5), 0.85);
          color = scoreColorContinuous(score, alpha);
        } else {
          // Density mode: accent blue with opacity
          const norm = count / maxVal;
          alpha = norm * 0.75;
          color = `rgba(74,158,255,${alpha})`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(i * cellW, j * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Draw strike zone outline
    const szLeft = (((-0.83) - X_MIN) / xRange) * width;
    const szRight = ((0.83 - X_MIN) / xRange) * width;
    const szTop = ((Z_MAX - 3.5) / zRange) * height;
    const szBottom = ((Z_MAX - 1.5) / zRange) * height;

    ctx.strokeStyle = 'rgba(74,158,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(szLeft, szTop, szRight - szLeft, szBottom - szTop);
    ctx.setLineDash([]);

  }, [pitches, colorBy, width, height]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, borderRadius: 4 }}
      />
      {pitches.length === 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#606080',
        }}>
          No pitch data
        </div>
      )}
    </div>
  );
}
