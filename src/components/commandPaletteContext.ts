import { createContext, useContext } from 'react';

// Lives outside CommandPalette.tsx so that file only exports components
// (react-refresh/only-export-components — keeps HMR Fast Refresh working).
export const CommandPaletteCtx = createContext<{ open: () => void }>({ open: () => {} });

export function useCommandPalette() { return useContext(CommandPaletteCtx); }
