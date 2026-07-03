/**
 * Leaderboard — the app's home page.
 *
 * Two tabs (Pitchers | Batters) + a Player Search tool that jumps straight to
 * a player profile (plots, grades, game logs all live on the profile page).
 * Tab state is URL-driven (?tab=batters) so /batters can redirect here.
 */
import { useSearchParams } from 'react-router-dom';
import { useData } from '../data/useData';
import { SearchAutocomplete } from '../components/SearchAutocomplete';
import { PitchersPanel } from './PlayerBrowser';
import { BattersPanel } from './BatterBrowser';

type Tab = 'pitchers' | 'batters';

export function Leaderboard() {
  const { data, season } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'batters' ? 'batters' : 'pitchers';
  const pitchers = data?.pitchers?.pitchers ?? [];

  function setTab(t: Tab) {
    setSearchParams(t === 'pitchers' ? {} : { tab: t }, { replace: true });
  }

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1>Leaderboard</h1>
            <span style={{
              background: 'var(--accent-dim)', border: '1px solid var(--accent-line)',
              color: 'var(--accent)', borderRadius: 4, padding: '2px 8px', fontSize: 11,
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
            }}>
              {season} MLB
            </span>
          </div>

          {/* Player Search — jump straight to a full player profile */}
          {pitchers.length > 0 && (
            <div style={{ marginLeft: 'auto', minWidth: 260 }}>
              <SearchAutocomplete pitchers={pitchers} placeholder="Player Search — open a profile…" />
            </div>
          )}
        </div>
      </div>

      {/* Pitchers | Batters toggle */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {(['pitchers', 'batters'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 22px', border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? 'var(--bg-base)' : 'var(--text-2)',
              fontWeight: tab === t ? 700 : 400,
              borderRadius: '6px 6px 0 0', fontSize: 14,
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'pitchers' ? <PitchersPanel /> : <BattersPanel />}
    </div>
  );
}
