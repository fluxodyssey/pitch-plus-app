import { BrowserRouter, Routes, Route, Navigate, NavLink, Link } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { SEASON_LABELS, AVAILABLE_SEASONS, DEFAULT_SEASON, preloadSeason, useData, hasMatchupData } from './data/useData';
import type { Season } from './data/useData';
import { SearchAutocomplete } from './components/SearchAutocomplete';
import { CommandPaletteProvider } from './components/CommandPalette';
import { useCommandPalette } from './components/commandPaletteContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useKeyboardShortcuts, KEYBOARD_SHORTCUTS } from './hooks/useKeyboardShortcuts';

// Code-split every page — only the current route's bundle is loaded
const Leaderboard    = lazy(() => import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })));
const PlayerDetail   = lazy(() => import('./pages/PlayerDetail').then(m => ({ default: m.PlayerDetail })));
const TeamBrowser    = lazy(() => import('./pages/TeamBrowser').then(m => ({ default: m.TeamBrowser })));
const TeamDetail     = lazy(() => import('./pages/TeamDetail').then(m => ({ default: m.TeamDetail })));
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch').then(m => ({ default: m.AdvancedSearch })));
const StartReport    = lazy(() => import('./pages/StartReport').then(m => ({ default: m.StartReport })));
const ComparePage      = lazy(() => import('./pages/Compare').then(m => ({ default: m.Compare })));
const FAQ              = lazy(() => import('./pages/FAQ').then(m => ({ default: m.FAQ })));
const MatchupMachine   = lazy(() => import('./pages/MatchupMachine').then(m => ({ default: m.MatchupMachine })));
const Glossary         = lazy(() => import('./pages/Glossary').then(m => ({ default: m.Glossary })));
const LineupBoard      = lazy(() => import('./pages/LineupBoard').then(m => ({ default: m.LineupBoard })));
const CatcherFraming   = lazy(() => import('./pages/CatcherFraming').then(m => ({ default: m.CatcherFraming })));

function PageLoader() {
  return <div className="loading">Loading…</div>;
}

// ── Season picker ─────────────────────────────────────────────────────────────

function SeasonPicker() {
  const { season, setSeason } = useData();

  useEffect(() => {
    // Preload adjacent seasons on idle
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        AVAILABLE_SEASONS.forEach((s) => preloadSeason(s));
      });
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const num = parseInt(e.target.value, 10);
    const s = (AVAILABLE_SEASONS as readonly number[]).includes(num) ? (num as Season) : DEFAULT_SEASON;
    setSeason(s);
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
  const { data, season } = useData();
  const pitchers = data?.pitchers?.pitchers ?? [];
  const [menuOpen, setMenuOpen] = useState(false);
  const matchupAvailable = hasMatchupData(season);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link';

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">
          Pitch<span style={{ color: 'var(--accent)', fontWeight: 600 }}>+</span>
        </Link>

        {/* Hamburger button (mobile only) */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
        </button>

        <div className={`nav-links ${menuOpen ? 'nav-links-open' : ''}`}>
          <NavLink to="/" end className={navLinkClass} onClick={closeMenu}>Leaderboard</NavLink>
          <NavLink to="/teams" className={navLinkClass} onClick={closeMenu}>Teams</NavLink>
          {matchupAvailable && (
            <NavLink to="/matchup" className={navLinkClass} onClick={closeMenu}>Matchups</NavLink>
          )}
          <NavLink to="/lineup" className={navLinkClass} onClick={closeMenu}>Lineups</NavLink>
          <NavLink to="/catchers" className={navLinkClass} onClick={closeMenu}>Catcher Framing</NavLink>
          <NavLink to="/compare" className={navLinkClass} onClick={closeMenu}>Compare</NavLink>
          <NavLink to="/search" className={navLinkClass} onClick={closeMenu}>Search</NavLink>
          <NavLink to="/faq" className={navLinkClass} onClick={closeMenu}>FAQ</NavLink>
          <NavLink to="/glossary" className={navLinkClass} onClick={closeMenu}>Glossary</NavLink>
        </div>
        {pitchers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SearchAutocomplete pitchers={pitchers} compact placeholder="Search..." />
            <kbd className="kbd-hint" style={{
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

// ── Keyboard shortcuts + help overlay ────────────────────────────────────────

function AppShell() {
  const [showHelp, setShowHelp] = useState(false);
  const { open: openCmdPalette } = useCommandPalette();
  useKeyboardShortcuts(() => setShowHelp(h => !h), openCmdPalette);

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav />
      <main id="main" className="main-content">
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                              element={<Leaderboard />} />
            <Route path="/leaderboard"                   element={<Navigate to="/" replace />} />
            <Route path="/batters"                       element={<Navigate to="/?tab=batters" replace />} />
            <Route path="/player/:id"                   element={<PlayerDetail />} />
            <Route path="/player/:id/start/:gameId"     element={<StartReport />} />
            <Route path="/teams"                         element={<TeamBrowser />} />
            <Route path="/team/:abbrev"                  element={<TeamDetail />} />
            <Route path="/search"                        element={<AdvancedSearch />} />
            <Route path="/compare"                       element={<ComparePage />} />
            <Route path="/compare/:id1"                  element={<ComparePage />} />
            <Route path="/compare/:id1/:id2"             element={<ComparePage />} />
            <Route path="/faq"                           element={<FAQ />} />
            <Route path="/matchup"                       element={<MatchupMachine />} />
            <Route path="/matchup/:pitcherId/:batterId"  element={<MatchupMachine />} />
            <Route path="/glossary"                      element={<Glossary />} />
            <Route path="/lineup"                        element={<LineupBoard />} />
            <Route path="/lineup/:pitcherId"             element={<LineupBoard />} />
            <Route path="/catchers"                      element={<CatcherFraming />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      {/* Keyboard shortcuts overlay */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 'min(480px, 90vw)', background: 'var(--bg-surface)', border: '1px solid var(--border-plus)',
              borderRadius: 12, padding: '20px 24px', zIndex: 9999,
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-1)' }}>Keyboard Shortcuts</h3>
              <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
              {KEYBOARD_SHORTCUTS.map(({ key, description }) => (
                <>
                  <kbd key={`k-${key}`} style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-plus)', borderRadius: 4,
                    padding: '2px 6px', fontSize: 12, fontFamily: 'var(--mono)',
                    color: 'var(--text-2)', whiteSpace: 'nowrap', justifySelf: 'start',
                  }}>{key}</kbd>
                  <span key={`d-${key}`} style={{ fontSize: 13, color: 'var(--text-2)', alignSelf: 'center' }}>{description}</span>
                </>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CommandPaletteProvider>
        <AppShell />
      </CommandPaletteProvider>
    </BrowserRouter>
  );
}
