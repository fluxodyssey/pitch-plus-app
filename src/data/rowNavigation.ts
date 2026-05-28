import type { NavigateFunction } from 'react-router-dom';
import type { MouseEvent } from 'react';

/**
 * Returns `{ onClick, onAuxClick }` for a clickable table row.
 *
 * - Plain click → client-side navigate
 * - Cmd/Ctrl-click → opens in new tab (`window.open`)
 * - Middle-click (mouse button 1) → opens in new tab via `onAuxClick`
 *
 * This restores the modifier-key UX you get for free with `<a href>` while
 * keeping the "click anywhere on the row" affordance the app relies on.
 * See bug_hunt_2026-05-22.md (B5).
 */
export function rowNavProps(navigate: NavigateFunction, path: string) {
  return {
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) {
        window.open(path, '_blank', 'noopener');
      } else {
        navigate(path);
      }
    },
    onAuxClick: (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        window.open(path, '_blank', 'noopener');
      }
    },
  };
}
