/**
 * 13-cell Statcast zone grid (zones 1-9 inner 3×3, 11-14 corners), rendered
 * from the PITCHER's point of view (catcher-view columns mirrored — zone 1,
 * up-and-in to a RHB, appears top-right). Pure presentational: parent supplies
 * per-zone value/label/fill; hover shows the tooltip string.
 */
import { useState } from 'react';

export interface ZoneCell {
  label: string;            // text inside the cell
  fill: string;             // background
  ink?: string;             // label color (default --text-1)
  tip?: string;             // hover tooltip
}

interface Props {
  cells: Partial<Record<number, ZoneCell>>;
  size?: number;            // inner-cell edge px (default 34)
  caption?: string;
}

// Pitcher POV: mirror catcher-view columns. Rows top→bottom.
const INNER_ROWS = [[3, 2, 1], [6, 5, 4], [9, 8, 7]];
const CORNERS = { tl: 12, tr: 11, bl: 14, br: 13 };

const EMPTY: ZoneCell = { label: '', fill: 'var(--bg-input)' };

export function ZoneGrid({ cells, size = 34, caption }: Props) {
  const [tip, setTip] = useState<{ z: number; text: string } | null>(null);
  const cell = (z: number) => cells[z] ?? EMPTY;
  const cs = size * 0.72;  // corner cells slightly smaller

  const box = (z: number, edge: number) => {
    const c = cell(z);
    return (
      <div
        key={z}
        onMouseEnter={() => c.tip && setTip({ z, text: c.tip })}
        onMouseLeave={() => setTip(null)}
        style={{
          width: edge, height: edge, background: c.fill,
          color: c.ink ?? 'var(--text-1)', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--mono)', fontSize: Math.max(10, edge * 0.32),
          fontWeight: 600, cursor: c.tip ? 'default' : undefined,
          transition: 'transform 80ms', position: 'relative',
          ...(tip?.z === z && { transform: 'scale(1.08)', zIndex: 2 }),
        }}
      >
        {c.label}
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {/* corners + inner grid, 2px surface gaps per dataviz mark spec */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: size * 3 + 4 + cs * 2 + 8 }}>
        {box(CORNERS.tl, cs)}
        {box(CORNERS.tr, cs)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '-2px 0' }}>
        {INNER_ROWS.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 2 }}>
            {row.map(z => box(z, size))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: size * 3 + 4 + cs * 2 + 8 }}>
        {box(CORNERS.bl, cs)}
        {box(CORNERS.br, cs)}
      </div>
      {/* home plate, pitcher POV */}
      <svg width={size * 1.6} height={size * 0.5} viewBox="0 0 64 20" style={{ opacity: 0.35 }}>
        <path d="M8 2 L56 2 L56 8 L32 18 L8 8 Z" fill="var(--text-3)" />
      </svg>
      {caption && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: 0.5 }}>
          {caption}
        </div>
      )}
      {tip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, padding: '6px 10px', background: 'var(--bg-elevated)',
          border: '1px solid var(--accent-line)', borderRadius: 6, whiteSpace: 'pre',
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-1)', zIndex: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'none',
        }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
