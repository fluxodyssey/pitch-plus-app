import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GradeBadge } from './GradeBadge';
import type { Pitcher } from '../types';

interface Props {
  pitchers: Pitcher[];
  compact?: boolean;
  placeholder?: string;
}

export function SearchAutocomplete({ pitchers, compact = false, placeholder = 'Search players...' }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.length >= 2
    ? pitchers
        .filter((p) => p.pitcher_name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectPlayer(id: number) {
    setQuery('');
    setOpen(false);
    navigate(`/player/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      selectPlayer(results[selectedIdx].pitcher_id);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: compact ? 200 : '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: compact ? '5px 10px' : '8px 12px',
          fontSize: compact ? 12 : 13,
          background: 'var(--bg-input)',
          border: '1px solid var(--border-plus)',
          borderRadius: 6,
          color: 'var(--text-1)',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4a9eff'; }}
        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'var(--border-plus)'; }}
      />
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-plus)',
            borderRadius: 8,
            overflow: 'hidden',
            zIndex: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {results.map((p, i) => (
            <div
              key={p.pitcher_id}
              onClick={() => selectPlayer(p.pitcher_id)}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                background: i === selectedIdx ? 'var(--bg-elevated)' : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              <span style={{ flex: 1, color: 'var(--text-1)', fontSize: 13 }}>{p.pitcher_name}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{p.pitcher_team}</span>
              <GradeBadge score={p.pitch_plus} size="sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
