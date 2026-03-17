import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RawPitch, GameInfo, GameAppearance } from '../types';

interface Props {
  pitches: RawPitch[];
  games: Record<string, GameInfo>;
  pitcherTeam: string;
  pitcherId: number;
  selectedGameId: number | null;
  onSelectGame: (gameId: number | null) => void;
}

type SortCol = 'date' | 'pitchCount' | 'innings' | 'strikeouts' | 'walks' | 'hits' | 'homeRuns' | 'runs';

export function computeGameLog(
  pitches: RawPitch[],
  games: Record<string, GameInfo>,
  pitcherTeam: string
): GameAppearance[] {
  const byGame = new Map<number, RawPitch[]>();
  pitches.forEach((p) => {
    if (!byGame.has(p.gid)) byGame.set(p.gid, []);
    byGame.get(p.gid)!.push(p);
  });

  return Array.from(byGame.entries())
    .map(([gid, gPitches]) => {
      const game = games[String(gid)];
      const events = gPitches.filter((p) => p.et);
      const opponent = game
        ? game.away === pitcherTeam
          ? game.home
          : game.away
        : '???';
      const isHome = game ? game.home === pitcherTeam : false;
      return {
        gameId: gid,
        date: game?.date ?? gPitches[0].gd,
        opponent,
        isHome,
        pitchCount: gPitches.length,
        innings: new Set(gPitches.map((p) => `${p.inn}-${p.ih}`)).size,
        strikeouts: events.filter((p) => p.et === 'strikeout').length,
        walks: events.filter((p) => p.et === 'walk').length,
        hits: events.filter((p) =>
          ['single', 'double', 'triple', 'home_run'].includes(p.et ?? '')
        ).length,
        homeRuns: events.filter((p) => p.et === 'home_run').length,
        runs: 0, // not computable from pitch data alone
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function GameLog({ pitches, games, pitcherTeam, pitcherId, selectedGameId, onSelectGame }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortAsc, setSortAsc] = useState(true);

  const appearances = computeGameLog(pitches, games, pitcherTeam);

  const sorted = [...appearances].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case 'date':
        cmp = a.date.localeCompare(b.date);
        break;
      case 'pitchCount':
        cmp = a.pitchCount - b.pitchCount;
        break;
      case 'innings':
        cmp = a.innings - b.innings;
        break;
      case 'strikeouts':
        cmp = a.strikeouts - b.strikeouts;
        break;
      case 'walks':
        cmp = a.walks - b.walks;
        break;
      case 'hits':
        cmp = a.hits - b.hits;
        break;
      case 'homeRuns':
        cmp = a.homeRuns - b.homeRuns;
        break;
      case 'runs':
        cmp = a.runs - b.runs;
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortAsc((a) => !a);
    } else {
      setSortCol(col);
      setSortAsc(col === 'date');
    }
  }

  function sortIndicator(col: SortCol) {
    if (sortCol !== col) return <span style={{ color: '#333344' }}> ⇅</span>;
    return <span style={{ color: '#4a9eff' }}>{sortAsc ? ' ↑' : ' ↓'}</span>;
  }

  const thStyle = (col: SortCol) => ({
    padding: '8px 10px',
    color: '#a0a0b8',
    borderBottom: '2px solid #1e1e2e',
    background: '#14141f',
    fontWeight: 500 as const,
    cursor: 'pointer' as const,
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    fontSize: 12,
  });

  if (appearances.length === 0) {
    return (
      <div className="game-log">
        <div style={{ color: '#606080', padding: 16, fontSize: 13 }}>No game appearances found.</div>
      </div>
    );
  }

  return (
    <div className="game-log">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#a0a0b8', fontSize: 12 }}>
          {appearances.length} game{appearances.length !== 1 ? 's' : ''}
        </span>
        {selectedGameId != null && (
          <button
            className="view-all-btn"
            onClick={() => onSelectGame(null)}
          >
            View All Games
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle('date'), textAlign: 'left' }} onClick={() => handleSort('date')}>
                Date{sortIndicator('date')}
              </th>
              <th style={{ ...thStyle('date'), textAlign: 'left' }}>Opp</th>
              <th style={{ ...thStyle('pitchCount'), textAlign: 'right' }} onClick={() => handleSort('pitchCount')}>
                P{sortIndicator('pitchCount')}
              </th>
              <th style={{ ...thStyle('innings'), textAlign: 'right' }} onClick={() => handleSort('innings')}>
                IP{sortIndicator('innings')}
              </th>
              <th style={{ ...thStyle('strikeouts'), textAlign: 'right' }} onClick={() => handleSort('strikeouts')}>
                K{sortIndicator('strikeouts')}
              </th>
              <th style={{ ...thStyle('walks'), textAlign: 'right' }} onClick={() => handleSort('walks')}>
                BB{sortIndicator('walks')}
              </th>
              <th style={{ ...thStyle('hits'), textAlign: 'right' }} onClick={() => handleSort('hits')}>
                H{sortIndicator('hits')}
              </th>
              <th style={{ ...thStyle('homeRuns'), textAlign: 'right' }} onClick={() => handleSort('homeRuns')}>
                HR{sortIndicator('homeRuns')}
              </th>
              <th style={{ ...thStyle('date') }}>Report</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((app) => {
              const isSelected = selectedGameId === app.gameId;
              return (
                <tr
                  key={app.gameId}
                  className="table-row-hover"
                  style={{
                    borderBottom: '1px solid #1e1e2e',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(74,158,255,0.12)' : undefined,
                  }}
                  onClick={() => onSelectGame(isSelected ? null : app.gameId)}
                >
                  <td style={{ padding: '7px 10px', color: '#e0e0e8' }}>{app.date}</td>
                  <td style={{ padding: '7px 10px', color: '#a0a0b8' }}>
                    {app.isHome ? 'vs' : '@'} {app.opponent}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e0e0e8' }}>
                    {app.pitchCount}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#a0a0b8' }}>
                    {app.innings}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e0e0e8', fontWeight: 600 }}>
                    {app.strikeouts}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#a0a0b8' }}>
                    {app.walks}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#a0a0b8' }}>
                    {app.hits}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: app.homeRuns > 0 ? '#c85a5a' : '#a0a0b8' }}>
                    {app.homeRuns}
                  </td>
                  <td style={{ padding: '7px 10px' }} onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/player/${pitcherId}/start/${app.gameId}`}
                      style={{ color: '#4a9eff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
                    >
                      Report →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
