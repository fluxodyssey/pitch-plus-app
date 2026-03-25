import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { SEASON_LABELS, AVAILABLE_SEASONS, DEFAULT_SEASON, getGlobalSeason, setGlobalSeason, preloadSeason, useData } from './data/useData';
import { SearchAutocomplete } from './components/SearchAutocomplete';
import { CommandPaletteProvider } from './components/CommandPalette';
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
const ComparePage      = lazy(() => import('./pages/Compare').then(m => ({ default: m.Compare })));
const SpringTraining   = lazy(() => import('./pages/SpringTraining').then(m => ({ default: m.SpringTraining })));
const PitchDesign      = lazy(() => import('./pages/PitchDesign').then(m => ({ default: m.PitchDesign })));

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
        background: 'var(--bg-input)',
        border: '1px solid var(--border-plus)',
        color: 'var(--text-1)',
        borderRadius: 'var(--radius-sm)',
        padding: '5px 10px',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'var(--sans)',
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
          Pitch<span style={{ color: 'var(--accent)', fontWeight: 600 }}>+</span>
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
          <NavLink to="/compare" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Compare
          </NavLink>
          <NavLink to="/design" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Design Lab
          </NavLink>
          <NavLink to="/spring" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} style={{ position: 'relative' }}>
            Spring
            <sup style={{ color: '#ef4444', fontSize: 8, fontWeight: 700, marginLeft: 2 }}>TEST</sup>
          </NavLink>
        </div>
        {pitchers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SearchAutocomplete pitchers={pitchers} compact placeholder="Search..." />
            <kbd style={{
              fontSize: 9, color: 'var(--text-4)', background: 'var(--bg-input)',
              border: '1px solid var(--border)', borderRadius: 3, padding: '2px 5px',
              fontFamily: 'var(--mono)', whiteSpace: 'nowrap', letterSpacing: '0.05em',
            }}>⌘K</kbd>
          </div>
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
      <CommandPaletteProvider>
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
            <Route path="/compare"                       element={<ComparePage />} />
            <Route path="/compare/:id1"                  element={<ComparePage />} />
            <Route path="/compare/:id1/:id2"             element={<ComparePage />} />
            <Route path="/spring"                        element={<SpringTraining />} />
            <Route path="/design"                        element={<PitchDesign />} />
          </Routes>
        </Suspense>
      </main>
      </CommandPaletteProvider>
    </BrowserRouter>
  );
}
