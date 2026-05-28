/**
 * Saved filter presets — persisted in localStorage.
 * Allows users to save and restore named filter combinations for
 * AdvancedSearch and Leaderboard.
 */

export interface SavedFilter {
  id: string;
  name: string;
  page: 'search' | 'leaderboard';
  url: string;          // full search params string (e.g. "?q=deGrom&team=NYM")
  createdAt: string;    // ISO date string
}

const STORAGE_KEY = 'pitch-plus-saved-filters';

function load(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFilter[]) : [];
  } catch {
    return [];
  }
}

function save(filters: SavedFilter[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch { /* ignore */ }
}

export function getSavedFilters(page?: 'search' | 'leaderboard'): SavedFilter[] {
  const all = load();
  return page ? all.filter(f => f.page === page) : all;
}

export function saveFilter(name: string, page: 'search' | 'leaderboard', url: string): SavedFilter {
  const filters = load();
  const newFilter: SavedFilter = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    page,
    url,
    createdAt: new Date().toISOString(),
  };
  filters.push(newFilter);
  save(filters);
  return newFilter;
}

export function deleteSavedFilter(id: string): void {
  save(load().filter(f => f.id !== id));
}
