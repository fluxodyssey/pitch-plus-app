import { useState, useEffect, useRef } from 'react';

export interface InlineSearchProps<T> {
  items: T[];
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  value: T | null;
  onSelect: (item: T) => void;
  placeholder?: string;
  label?: string;
  maxResults?: number;
  filterFn?: (item: T, query: string) => boolean;
  renderItem?: (item: T, highlighted: boolean) => React.ReactNode;
  /** If true, clear query after selection (default: set to selected label) */
  clearOnSelect?: boolean;
}

export function InlineSearch<T>({
  items,
  getKey,
  getLabel,
  value,
  onSelect,
  placeholder = 'Search…',
  label,
  maxResults = 10,
  filterFn,
  renderItem,
  clearOnSelect = false,
}: InlineSearchProps<T>) {
  const [query, setQuery] = useState(value ? getLabel(value) : '');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Sync query when the external value changes — render-phase adjustment (the
  // React-documented derived-state pattern; avoids an effect's double render).
  const valueKey = value ? getKey(value) : null;
  const [prevValueKey, setPrevValueKey] = useState(valueKey);
  if (valueKey !== prevValueKey) {
    setPrevValueKey(valueKey);
    setQuery(value ? getLabel(value) : '');
    setIdx(0);
  }

  // Click-outside-to-close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const defaultFilter = (item: T, q: string) =>
    getLabel(item).toLowerCase().includes(q.toLowerCase());

  const results = query.length >= 2
    ? items.filter(i => (filterFn ?? defaultFilter)(i, query)).slice(0, maxResults)
    : [];

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery(clearOnSelect ? '' : getLabel(item));
    setIdx(0);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && (
        <div style={{ fontSize: 10, color: '#606080', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          {label}
        </div>
      )}
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setIdx(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
          if (e.key === 'Enter' && results[idx]) { e.preventDefault(); handleSelect(results[idx]); }
          if (e.key === 'Escape') setOpen(false);
        }}
        style={{
          width: '100%', background: '#1a1a2e', border: '1px solid #2a2a3e',
          color: '#e0e0e8', borderRadius: 6, padding: '8px 12px', fontSize: 14,
          boxSizing: 'border-box', outline: 'none',
        }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#16162a', border: '1px solid #2a2a3e', borderRadius: 6,
          marginTop: 4, maxHeight: 280, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {results.map((item, i) => (
            <div
              key={getKey(item)}
              onClick={() => handleSelect(item)}
              style={{
                padding: '8px 14px', cursor: 'pointer',
                background: i === idx ? '#1a1a2e' : 'transparent',
                color: i === idx ? '#e0e0e8' : '#a0a0b8',
                fontSize: 13, borderBottom: '1px solid #1e1e2e',
                fontFamily: 'var(--sans)',
              }}
            >
              {renderItem ? renderItem(item, i === idx) : (
                <span>
                  {getLabel(item)}
                  <span style={{ color: '#606080', fontSize: 11, marginLeft: 8 }}>
                    {String((item as Record<string, unknown>)['team'] ?? '')}
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
