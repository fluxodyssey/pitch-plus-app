import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts for the Pitch+ app.
 *
 * Two-key Vim-style navigation (G then key):
 *   G P → Pitchers   G B → Batters   G T → Teams
 *   G L → Leaderboard  G S → Search  G M → Matchups
 *   G C → Compare   G U → Lineups   G K → Catcher Framing
 *   G F → FAQ       G G → Glossary
 *
 * Single-key:
 *   ? → Show shortcuts help overlay (toggle)
 */
export function useKeyboardShortcuts(
  onOpenHelp: () => void,
  onOpenCommandPalette: () => void,
) {
  const navigate = useNavigate();
  const pendingGRef = useRef(false);
  const [pendingG, setPendingG] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = () => {
    pendingGRef.current = false;
    setPendingG(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Skip when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (pendingGRef.current) {
        clearPending();
        switch (key) {
          case 'p': navigate('/');          break;
          case 'b': navigate('/?tab=batters'); break;
          case 't': navigate('/teams');     break;
          case 'l': navigate('/');          break;
          case 's': navigate('/search');    break;
          case 'm': navigate('/matchup');   break;
          case 'c': navigate('/compare');   break;
          case 'u': navigate('/lineup');    break;
          case 'k': navigate('/catchers');  break;
          case 'f': navigate('/faq');       break;
          case 'g': navigate('/glossary');  break;
        }
        return;
      }

      if (key === 'g') {
        pendingGRef.current = true;
        setPendingG(true);
        // Auto-clear after 1 second if no second key
        timerRef.current = setTimeout(clearPending, 1000);
        return;
      }

      if (key === '?') {
        e.preventDefault();
        onOpenHelp();
        return;
      }

      if (key === '/') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [navigate, onOpenHelp, onOpenCommandPalette]);

  return { pendingG };
}

// ── Shortcuts reference data (used by the help overlay) ────────────────────

export const KEYBOARD_SHORTCUTS = [
  { key: 'G P', description: 'Go to Leaderboard (Pitchers)' },
  { key: 'G B', description: 'Go to Leaderboard (Batters)' },
  { key: 'G T', description: 'Go to Teams' },
  { key: 'G M', description: 'Go to Matchup Machine' },
  { key: 'G U', description: 'Go to Lineup Board' },
  { key: 'G K', description: 'Go to Catcher Framing' },
  { key: 'G C', description: 'Go to Compare' },
  { key: 'G S', description: 'Go to Advanced Search' },
  { key: 'G F', description: 'Go to FAQ' },
  { key: 'G G', description: 'Go to Glossary' },
  { key: '⌘K', description: 'Open command palette' },
  { key: '/', description: 'Open command palette' },
  { key: '?', description: 'Show keyboard shortcuts' },
];
