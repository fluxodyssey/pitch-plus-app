import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useData, AVAILABLE_SEASONS, setGlobalSeason, getGlobalSeason, hasMatchupData } from '../data/useData';
import { GradeBadge } from './GradeBadge';
import { CommandPaletteCtx } from './commandPaletteContext';

// ─── Fuzzy scoring ───────────────────────────────────────────────────────────

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 1000 + (t.indexOf(q) === 0 ? 500 : 0);
  let qi = 0, score = 0, prevMatch = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += (ti === prevMatch + 1) ? 10 : 1;
      prevMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <CommandPaletteCtx.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      {isOpen && <CommandPaletteOverlay onClose={() => setIsOpen(false)} />}
    </CommandPaletteCtx.Provider>
  );
}

// ─── Overlay ─────────────────────────────────────────────────────────────────

interface CmdItem {
  id: string;
  label: string;
  sublabel?: string;
  group: string;
  score?: number;
  onSelect: () => void;
  badge?: number;
}

function CommandPaletteOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { data } = useData();
  const pitchers = useMemo(() => data?.pitchers?.pitchers ?? [], [data]);

  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setIdx(0); }, [query]);

  // Build command list
  const items = useMemo(() => {
    const cmds: CmdItem[] = [];
    const currentSeason = getGlobalSeason();

    // Navigation — all pages
    const navs = [
      { label: 'Pitchers', sublabel: 'Browse all pitchers', path: '/' },
      { label: 'Batters', sublabel: 'Browse all batters', path: '/batters' },
      { label: 'Teams', sublabel: 'Team rotations', path: '/teams' },
      { label: 'Leaderboard', sublabel: 'Rank pitchers by any metric', path: '/leaderboard' },
      { label: 'Advanced Search', sublabel: 'Filter & slice metrics', path: '/search' },
      { label: 'Compare Pitchers', sublabel: 'Head-to-head comparison', path: '/compare' },
      ...(hasMatchupData(currentSeason) ? [{ label: 'Matchup Machine', sublabel: 'Pitcher vs batter projections', path: '/matchup' }] : []),
      { label: 'Pitcher Plots', sublabel: 'Movement, location, heatmaps', path: '/plots' },
      { label: 'Design Lab', sublabel: 'Pitch design recommendations', path: '/design' },
      { label: 'Spring Training', sublabel: 'Spring development tracker', path: '/spring' },
      { label: 'Glossary', sublabel: 'Metric definitions', path: '/glossary' },
      { label: 'FAQ', sublabel: 'How scores are calculated', path: '/faq' },
    ];
    for (const n of navs) {
      cmds.push({ id: `nav-${n.path}`, label: n.label, sublabel: n.sublabel, group: 'Navigate', onSelect: () => { navigate(n.path); onClose(); } });
    }

    // Season switching
    for (const s of [...AVAILABLE_SEASONS].reverse()) {
      if (s !== currentSeason) {
        cmds.push({
          id: `season-${s}`,
          label: `Switch to ${s} season`,
          sublabel: `Currently: ${currentSeason}`,
          group: 'Season',
          onSelect: () => { setGlobalSeason(s); onClose(); },
        });
      }
    }

    // Pitcher search
    if (query.length >= 2) {
      const scored = pitchers
        .map(p => ({ pitcher: p, score: fuzzyScore(query, p.pitcher_name) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      for (const { pitcher, score } of scored) {
        cmds.push({
          id: `pitcher-${pitcher.pitcher_id}`,
          label: pitcher.pitcher_name,
          sublabel: `${pitcher.pitcher_team} · ${pitcher.pitcher_hand === 'L' ? 'LHP' : 'RHP'}`,
          group: 'Pitchers',
          score,
          badge: pitcher.pitch_plus,
          onSelect: () => { navigate(`/player/${pitcher.pitcher_id}`); onClose(); },
        });
      }
      // Quick compare action when a pitcher is found
      if (scored.length > 0) {
        const p = scored[0]!.pitcher;
        cmds.push({
          id: `compare-${p.pitcher_id}`,
          label: `Compare ${p.pitcher_name}`,
          sublabel: 'Open side-by-side comparison',
          group: 'Actions',
          onSelect: () => { navigate(`/compare/${p.pitcher_id}`); onClose(); },
        });
        cmds.push({
          id: `plots-${p.pitcher_id}`,
          label: `Plot ${p.pitcher_name}`,
          sublabel: 'View movement, location & heatmaps',
          group: 'Actions',
          onSelect: () => { navigate(`/plots?pitcher=${p.pitcher_id}`); onClose(); },
        });
      }
    }

    return cmds;
  }, [query, pitchers, navigate, onClose]);

  // Filter items based on query (navigation items also get filtered)
  const filtered = useMemo(() => {
    if (query.length < 2) return items.filter(i => i.group === 'Navigate');
    return items.filter(i => {
      if (i.group === 'Pitchers') return true; // already fuzzy-filtered
      return fuzzyScore(query, i.label) > 0;
    });
  }, [items, query]);

  // Group items
  const groups = useMemo(() => {
    const map = new Map<string, CmdItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.group);
      if (arr) arr.push(item);
      else map.set(item.group, [item]);
    }
    return map;
  }, [filtered]);

  const flatItems = useMemo(() => filtered, [filtered]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, flatItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && flatItems[idx]) { flatItems[idx].onSelect(); }
    if (e.key === 'Escape') { onClose(); }
  }

  let itemIndex = 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}
      />
      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
        width: 'min(540px, 90vw)', maxHeight: 420,
        background: '#14141f', border: '1px solid #2a2a3e', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', zIndex: 9999,
        animation: 'fadeSlideIn 0.15s ease-out',
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search pitchers, pages, actions..."
          style={{
            padding: '14px 18px', border: 'none', borderBottom: '1px solid #1e1e2e',
            background: 'transparent', color: '#e0e0e8', fontSize: 15, outline: 'none',
          }}
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {Array.from(groups.entries()).map(([group, groupItems]) => (
            <div key={group}>
              <div style={{
                padding: '8px 18px 4px', fontSize: 10, fontWeight: 600,
                color: '#606080', textTransform: 'uppercase', letterSpacing: 0.8,
              }}>
                {group}
              </div>
              {groupItems.map(item => {
                const thisIdx = itemIndex++;
                const highlighted = thisIdx === idx;
                return (
                  <div
                    key={item.id}
                    onClick={item.onSelect}
                    onMouseEnter={() => setIdx(thisIdx)}
                    style={{
                      padding: '8px 18px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                      background: highlighted ? '#1a1a2e' : 'transparent',
                      color: highlighted ? '#e0e0e8' : '#a0a0b8',
                      fontSize: 13, transition: 'background 0.08s',
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      {item.label}
                      {item.sublabel && <span style={{ color: '#606080', fontSize: 11, marginLeft: 6 }}>({item.sublabel})</span>}
                    </span>
                    {item.badge != null && <GradeBadge score={item.badge} size="sm" />}
                  </div>
                );
              })}
            </div>
          ))}
          {flatItems.length === 0 && (
            <div style={{ padding: '20px 18px', color: '#606080', fontSize: 13, textAlign: 'center' }}>
              {query.length < 2 ? 'Type to search...' : 'No results found'}
            </div>
          )}
        </div>
        <div style={{
          padding: '6px 18px', borderTop: '1px solid #1e1e2e',
          display: 'flex', gap: 12, fontSize: 10, color: '#404060',
        }}>
          <span><kbd style={{ background: '#1a1a2e', padding: '0 3px', borderRadius: 2, border: '1px solid #2a2a3e' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: '#1a1a2e', padding: '0 3px', borderRadius: 2, border: '1px solid #2a2a3e' }}>↵</kbd> select</span>
          <span><kbd style={{ background: '#1a1a2e', padding: '0 3px', borderRadius: 2, border: '1px solid #2a2a3e' }}>esc</kbd> close</span>
        </div>
      </div>
    </>,
    document.body,
  );
}
