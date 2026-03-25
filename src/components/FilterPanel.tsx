import { useState } from 'react';
import type { PitchFilters } from '../types';
import { DEFAULT_FILTERS, countActiveFilters } from '../data/filterPitches';
import { pitchColor } from '../data/constants';

interface Props {
  filters: PitchFilters;
  onChange: (filters: PitchFilters) => void;
  availablePitchTypes: string[];
  pitchTypeNames: Record<string, string>;
  totalPitches: number;
  filteredPitches: number;
}

const COUNT_GROUPS = [
  { label: 'First Pitch', counts: ['0-0'] },
  { label: 'Ahead', counts: ['0-1', '0-2', '1-2'] },
  { label: 'Behind', counts: ['1-0', '2-0', '2-1', '3-0', '3-1'] },
  { label: 'Even', counts: ['0-0', '1-1', '2-2'] },
  { label: 'Two-Strike', counts: ['0-2', '1-2', '2-2', '3-2'] },
];

const ALL_COUNTS = [
  '0-0', '0-1', '0-2',
  '1-0', '1-1', '1-2',
  '2-0', '2-1', '2-2',
  '3-0', '3-1', '3-2',
];

const INNINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const QUICK_PRESETS = [
  { label: 'Fastballs', apply: (f: PitchFilters): PitchFilters => ({ ...f, pitchTypes: ['FF', 'SI', 'FC', 'FA'] }) },
  { label: 'Breaking', apply: (f: PitchFilters): PitchFilters => ({ ...f, pitchTypes: ['SL', 'CU', 'ST', 'SV', 'KC', 'CS'] }) },
  { label: 'Two-Strike', apply: (f: PitchFilters): PitchFilters => ({ ...f, counts: ['0-2', '1-2', '2-2', '3-2'] }) },
  { label: 'First Pitch', apply: (f: PitchFilters): PitchFilters => ({ ...f, counts: ['0-0'] }) },
  { label: 'vs LHH', apply: (f: PitchFilters): PitchFilters => ({ ...f, batterHand: 'L' }) },
  { label: 'vs RHH', apply: (f: PitchFilters): PitchFilters => ({ ...f, batterHand: 'R' }) },
  { label: 'Behind', apply: (f: PitchFilters): PitchFilters => ({ ...f, counts: ['1-0', '2-0', '2-1', '3-0', '3-1'] }) },
  { label: 'Chase', apply: (f: PitchFilters): PitchFilters => ({ ...f, zone: 'chase' }) },
  { label: 'High Leverage', apply: (f: PitchFilters): PitchFilters => ({ ...f, innings: [7, 8, 9] }) },
  { label: 'Offspeed', apply: (f: PitchFilters): PitchFilters => ({ ...f, pitchTypes: ['CH', 'FS', 'SC', 'FO'] }) },
];

export function FilterPanel({
  filters,
  onChange,
  availablePitchTypes,
  pitchTypeNames,
  totalPitches,
  filteredPitches,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const activeCount = countActiveFilters(filters);

  function set<K extends keyof PitchFilters>(key: K, value: PitchFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function togglePitchType(pt: string) {
    const types = filters.pitchTypes.includes(pt)
      ? filters.pitchTypes.filter((t) => t !== pt)
      : [...filters.pitchTypes, pt];
    set('pitchTypes', types);
  }

  function toggleCount(count: string) {
    const counts = filters.counts.includes(count)
      ? filters.counts.filter((c) => c !== count)
      : [...filters.counts, count];
    set('counts', counts);
  }

  function applyCountGroup(groupCounts: string[]) {
    // If all counts in the group are selected, deselect them; otherwise select all
    const allSelected = groupCounts.every((c) => filters.counts.includes(c));
    if (allSelected) {
      set('counts', filters.counts.filter((c) => !groupCounts.includes(c)));
    } else {
      const merged = Array.from(new Set([...filters.counts, ...groupCounts]));
      set('counts', merged);
    }
  }

  function toggleInning(inn: number) {
    const innings = filters.innings.includes(inn)
      ? filters.innings.filter((i) => i !== inn)
      : [...filters.innings, inn];
    set('innings', innings);
  }

  function toggleOut(o: number) {
    const outs = filters.outs.includes(o)
      ? filters.outs.filter((x) => x !== o)
      : [...filters.outs, o];
    set('outs', outs);
  }

  const veloMin = filters.veloMin ?? 50;
  const veloMax = filters.veloMax ?? 105;

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <button
          className="filter-toggle-btn"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="active-filters-badge">{activeCount}</span>
          )}
          <span style={{ marginLeft: 'auto', color: '#606080', fontSize: 12 }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </button>
        <div className="filter-pitch-count">
          Showing{' '}
          <strong style={{ color: '#4a9eff' }}>{filteredPitches.toLocaleString()}</strong>
          {' '}of{' '}
          <strong>{totalPitches.toLocaleString()}</strong> pitches
        </div>
        {activeCount > 0 && (
          <button
            className="reset-filters-btn"
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
          >
            Reset All
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="filter-panel-body">
          {/* Quick Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => onChange(preset.apply({ ...DEFAULT_FILTERS }))}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  border: '1px solid #2a2a3e',
                  borderRadius: 12,
                  background: 'transparent',
                  color: '#a0a0b8',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4a9eff';
                  e.currentTarget.style.color = '#4a9eff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#2a2a3e';
                  e.currentTarget.style.color = '#a0a0b8';
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="filter-section">
            <div className="filter-section-title">Date Range</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                className="date-picker"
                value={filters.dateFrom ?? ''}
                onChange={(e) => set('dateFrom', e.target.value || null)}
              />
              <span style={{ color: '#606080' }}>to</span>
              <input
                type="date"
                className="date-picker"
                value={filters.dateTo ?? ''}
                onChange={(e) => set('dateTo', e.target.value || null)}
              />
            </div>
          </div>

          {/* Pitch Types */}
          {availablePitchTypes.length > 0 && (
            <div className="filter-section">
              <div className="filter-section-title">Pitch Type</div>
              <div className="filter-checkbox-group">
                {availablePitchTypes.map((pt) => {
                  const selected = filters.pitchTypes.includes(pt);
                  const color = pitchColor(pt);
                  return (
                    <label key={pt} className="filter-checkbox-label">
                      <input
                        type="checkbox"
                        className="filter-checkbox"
                        checked={selected}
                        onChange={() => togglePitchType(pt)}
                      />
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: selected ? '#e0e0e8' : '#a0a0b8' }}>
                        {pitchTypeNames[pt] ?? pt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Count Groups */}
          <div className="filter-section">
            <div className="filter-section-title">Count</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {COUNT_GROUPS.map((group) => {
                const allSelected = group.counts.every((c) => filters.counts.includes(c));
                return (
                  <button
                    key={group.label}
                    className={`count-group-btn${allSelected ? ' active' : ''}`}
                    onClick={() => applyCountGroup(group.counts)}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
            <div className="filter-checkbox-group" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ALL_COUNTS.map((count) => {
                const selected = filters.counts.includes(count);
                return (
                  <button
                    key={count}
                    className={`count-btn${selected ? ' active' : ''}`}
                    onClick={() => toggleCount(count)}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Batter Hand */}
          <div className="filter-section">
            <div className="filter-section-title">Batter Hand</div>
            <div className="filter-radio-group">
              {(['all', 'L', 'R'] as const).map((hand) => (
                <label key={hand} className="filter-radio-label">
                  <input
                    type="radio"
                    className="filter-radio"
                    name="batterHand"
                    checked={filters.batterHand === hand}
                    onChange={() => set('batterHand', hand)}
                  />
                  <span>{hand === 'all' ? 'All' : hand === 'L' ? 'Left' : 'Right'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Innings */}
          <div className="filter-section">
            <div className="filter-section-title">Inning</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {INNINGS.map((inn) => {
                const selected = filters.innings.includes(inn);
                return (
                  <button
                    key={inn}
                    className={`count-btn${selected ? ' active' : ''}`}
                    onClick={() => toggleInning(inn)}
                  >
                    {inn}
                  </button>
                );
              })}
              <button
                className={`count-btn${filters.innings.some((i) => i > 9) ? ' active' : ''}`}
                onClick={() => {
                  const hasExtra = filters.innings.some((i) => i > 9);
                  if (hasExtra) {
                    set('innings', filters.innings.filter((i) => i <= 9));
                  } else {
                    set('innings', [...filters.innings, 10, 11, 12]);
                  }
                }}
              >
                Extra
              </button>
            </div>
          </div>

          {/* Outs */}
          <div className="filter-section">
            <div className="filter-section-title">Outs</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map((o) => {
                const selected = filters.outs.includes(o);
                return (
                  <button
                    key={o}
                    className={`count-btn${selected ? ' active' : ''}`}
                    onClick={() => toggleOut(o)}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Zone */}
          <div className="filter-section">
            <div className="filter-section-title">Zone</div>
            <div className="filter-radio-group">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'in', label: 'In-Zone' },
                  { value: 'edge', label: 'Edge' },
                  { value: 'chase', label: 'Chase' },
                ] as const
              ).map(({ value, label }) => (
                <label key={value} className="filter-radio-label">
                  <input
                    type="radio"
                    className="filter-radio"
                    name="zone"
                    checked={filters.zone === value}
                    onChange={() => set('zone', value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="filter-section">
            <div className="filter-section-title">Result</div>
            <div className="filter-radio-group" style={{ flexWrap: 'wrap' }}>
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'swing', label: 'Swing' },
                  { value: 'take', label: 'Take' },
                  { value: 'whiff', label: 'Whiff' },
                  { value: 'in-play', label: 'In-Play' },
                ] as const
              ).map(({ value, label }) => (
                <label key={value} className="filter-radio-label">
                  <input
                    type="radio"
                    className="filter-radio"
                    name="result"
                    checked={filters.result === value}
                    onChange={() => set('result', value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Velocity Range */}
          <div className="filter-section">
            <div className="filter-section-title">
              Velocity: {veloMin}–{veloMax} mph
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#606080', fontSize: 11, width: 28 }}>Min</span>
                <input
                  type="range"
                  min={50}
                  max={105}
                  step={1}
                  value={veloMin}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    set('veloMin', v <= 50 ? null : v);
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ color: '#a0a0b8', fontSize: 12, width: 28, textAlign: 'right' }}>
                  {veloMin}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#606080', fontSize: 11, width: 28 }}>Max</span>
                <input
                  type="range"
                  min={50}
                  max={105}
                  step={1}
                  value={veloMax}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    set('veloMax', v >= 105 ? null : v);
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ color: '#a0a0b8', fontSize: 12, width: 28, textAlign: 'right' }}>
                  {veloMax}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
