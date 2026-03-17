import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { SEASON_LABELS, AVAILABLE_SEASONS, DEFAULT_SEASON, getGlobalSeason, setGlobalSeason, preloadSeason, useData } from './data/useData';
import { SearchAutocomplete } from './components/SearchAutocomplete';
import type { Season } from './data/useData';

// Code-split every page — only the current route's bundle is loaded
const PlayerBrowser  = lazy(() => import('./pages/PlayerBrowser').then(m => ({ default: m.PlayerBrowser })));
const PlayerDetail   = lazy(() => import('./pages/PlayerDetail').then(m => ({ default: m.PlayerDetail })));
const TeamBrowser    = lazy(() => import('./pages/TeamBrowser').then(m => ({ default: m.TeamBrowser })));
const TeamDetail     = lazy(() => import('./pages/TeamDetail').then(m => ({ default: m.TeamDetail })));
const Leaderboard    = lazy(() => import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })));
const BatterBrowser  = lazy(() => import('./pages/BatterBrowser').then(m => ({ default: m.BatterBrowser })));
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch').then(m => ({ default: m.AdvancedSearch })));
const StartReport    = lazy(() => import('./pages/StartReport').then(m => ({ default: m.StartReport })));

function PageLoader() {
  return <div className="loading">Loading…</div>;
}

// ── Season picker ─────────────────────────────────────────────────────────────

function SeasonPicker() {
  const [season, setSeason] = useState<Season>(getGlobalSeason());

  useEffect(() => {
    // Preload adjacent seasons on idle
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        AVAILABLE_SEASONS.forEach((s) => preloadSeason(s));
      });
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const num = parseInt(e.target.value, 10);
    const s = (AVAILABLE_SEASONS as readonly number[]).includes(num) ? (num as Season) : DEFAULT_SEASON;
    setSeason(s);
    setGlobalSeason(s);
  }

  return (
    <select
      value={season}
      onChange={handleChange}
      style={{
        background: '#1a1a2e',
        border: '1px solid #2a2a3e',
        color: '#e0e0e8',
        borderRadius: 6,
        padding: '5px 10px',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {[...AVAILABLE_SEASONS].reverse().map((yr) => (
        <option key={yr} value={String(yr)}>{SEASON_LABELS[yr]}</option>
      ))}
    </select>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  const { data } = useData();
  const pitchers = data?.pitchers?.pitchers ?? [];

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">
          <span>Pitch<span style={{ color: '#4a9eff' }}>+</span></span>
        </Link>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Pitchers
          </NavLink>
          <NavLink to="/batters" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Batters
          </NavLink>
          <NavLink to="/teams" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Teams
          </NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Leaderboard
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Search
          </NavLink>
        </div>
        {pitchers.length > 0 && (
          <SearchAutocomplete pitchers={pitchers} compact placeholder="Search..." />
        )}
        <SeasonPicker />
      </div>
    </nav>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                              element={<PlayerBrowser />} />
            <Route path="/player/:id"                   element={<PlayerDetail />} />
            <Route path="/player/:id/start/:gameId"     element={<StartReport />} />
            <Route path="/batters"                       element={<BatterBrowser />} />
            <Route path="/teams"                         element={<TeamBrowser />} />
            <Route path="/team/:abbrev"                  element={<TeamDetail />} />
            <Route path="/leaderboard"                   element={<Leaderboard />} />
            <Route path="/search"                        element={<AdvancedSearch />} />
          </Routes>
        </Suspense>
      </main>
    </BrowserRouter>
  );
}
