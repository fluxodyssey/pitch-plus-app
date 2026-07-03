# Driveline App — React/TypeScript Context

## Stack

- React + TypeScript, Vite dev server
- **No Tailwind** — inline styles only
- Font: DM Sans (body), DM Mono (numbers/code)
- Charts: Recharts (most), Canvas (MovementProfileChart for per-pitch scatter performance)
- Run: `npm run dev` | Build: `npm run build` | Type check: `npx tsc -p tsconfig.app.json --noEmit`
- ⚠ Bare `tsc --noEmit` is a no-op here — see "Build before commit" below.

## Data Flow

Python pipeline writes `public/data/pitchers_{year}.json` → React fetches via `usePitchers` hook → typed as `Pitcher[]` from `src/types.ts`.

Other JSON files: `matchup_outcomes_{year}.json`, `tto_{year}.json`, `similarity_{year}.json`, `batter_outcomes_{year}.json`, `contact_profiles_{year}.json`, `sparklines.json`, `trajectories.json`, `arsenal_matchup_{year}.json`, `catchers_{year}.json`, `challenges_{year}.json` (2026+), `daily_matchups.json` (today's slate — refresh with `python models/daily_matchups.py`), `hr_slate.json` (today's HR chances — refresh with `python models/slate_hr_projection.py`).

## Type Discipline — Critical

`src/types.ts` is the contract between Python output and React. When Python adds new JSON fields:

1. Add to `Pitcher` interface as `field_name?: number | string | null`
2. If it's a scored metric: also add to `MetricKey` union
3. Run `npx tsc -p tsconfig.app.json --noEmit` (or `npm run build`) to confirm

Use the `sync-types` skill to detect drift automatically. The PostToolUse hook also runs sync-types after any `python models/*.py` invocation, so drift is surfaced in your next message context.

**Never add `MetricKey` entries without also updating `models/constants.py:PITCH_PLUS_DIMENSIONS`** — they must stay in sync.

## Key Files

| File                                      | Purpose                                            |
| ----------------------------------------- | -------------------------------------------------- |
| `src/types.ts`                            | `Pitcher`, `MetricKey`, `DimensionKey` interfaces  |
| `src/hooks/usePitchers.ts`                | Data fetch + cache (singleton)                     |
| `src/hooks/useTTOData.ts`                 | TTO data hook — singleton pattern reference        |
| `src/hooks/useSparklines.ts`              | Sparklines + trajectories                          |
| `src/pages/PlayerDetail.tsx`              | Player profile (overview/arsenal/grades/charts/…)  |
| `src/components/MetricsTable.tsx`         | Sortable comparison table                          |
| `src/components/MovementProfileChart.tsx` | Canvas-based per-pitch scatter w/ 1σ ellipses      |
| `src/pages/`                              | Route-level page components                        |
| `public/data/*.json`                      | App data (written by Python pipeline)              |

## Routes

Lazy-loaded, code-split. See `App.tsx` for the full list. As of the 2026-07 restructure:

`/` (Leaderboard hub — Pitchers | Batters tabs + Player Search; `/leaderboard` and `/batters` redirect here) · `/player/:id` (profile with Overview/Arsenal/Grades/Charts/Trends/Research/Game Log tabs — the old /plots and /grades pages live inside it now) · `/player/:id/start/:gameId` (StartReport) · `/teams` · `/team/:abbrev` · `/search` (AdvancedSearch) · `/compare`, `/compare/:id1`, `/compare/:id1/:id2` · `/matchup`, `/matchup/:pitcherId/:batterId` (searchable matchups + Best Matchups Today slate) · `/lineup`, `/lineup/:pitcherId` (arsenal-weighted lineup board) · `/catchers` (Catcher Framing Leaderboard + ABS challenge value) · `/faq` · `/glossary`

Removed 2026-07-02: `/spring`, `/design` (Design Lab), `/simulator`, `/plots`, `/grades` (the last two merged into the player profile).

Use the `add-app-page` skill to add a new route.

## Styling Conventions

- Inline styles throughout — no CSS modules, no Tailwind classes
- **Always use CSS variables defined in `src/index.css`** — never hardcode hex. Exception: canvas components (`MovementProfileChart`, `PitchHeatmap`, `StuffDNA`, `VelocityDistribution`) can't resolve `var()` in `fillStyle` — they use neutral-gray literals matching the tokens.
- Palette (defined at `:root` in `index.css`): neutral dark — `--bg-base: #0b0b0c` (near-black), surface `--bg-surface: #141416`, accent steel blue `--accent: #4b96e6`
- Text scale: `--text-1` (soft off-white), `--text-2` (secondary gray), `--text-3` (muted), `--text-4` (very muted)
- Semantic colors: `--positive` (emerald), `--negative` (rose), `--amber` (warning)
- Fonts: `--sans` (DM Sans, body), `--mono` (DM Mono, numbers)
- Radii: `--radius-sm` (6px), `--radius` (8px), `--radius-lg` (12px)
- Grade colors follow the standard A+/A/B/C/D scale from `constants.py:GRADE_THRESHOLDS`
- `N/A` display for missing optional fields — never show `null` or `undefined` to user

## Component Patterns

- **Singleton hooks**: data hooks (`usePitchers`, `useTTOData`, `useSparklines`) cache JSON at module level, not via React state. First call fetches; subsequent calls return cached. See `useTTOData.ts` for the canonical pattern.
- **useMemo on per-render lookups**: `SeasonHistory.tsx` and `SimilarPitchers.tsx` use `useMemo` for pitcher lookup tables. Without it, O(n) lookup runs every render.
- **Canvas vs Recharts**: Recharts for aggregate charts (bars, lines, ≤100 points). Canvas for per-pitch scatter (1000+ points, custom rendering like 1σ ellipses via covariance eigendecomposition). See `MovementProfileChart.tsx`.
- **Screen-space vs data-space math**: When drawing geometric shapes over scatter plots, do the math in screen pixels, not data units — HB and IVB have non-uniform pixel scales after axis stretching. See the ellipse eigendecomposition in `MovementProfileChart.tsx`.

## Dev workflow

- **Start**: `cd pitch-plus-app && npm run dev` — Vite on localhost:5173
- **JSON not loading**: DevTools → Network tab → look for 404 on `/data/*.json`. Either the file isn't in `public/data/` (rerun pipeline) or it's misspelled.
- **Cannot read property of undefined**: a Pitcher field is referenced in JSX but not present in the JSON. Run `sync-types`; if drift exists, fix `types.ts` or rerun the relevant model with `--merge`.
- **Console log a Pitcher**: `console.log(JSON.parse(JSON.stringify(pitcher)))` — bypasses React's lazy proxy for full inspection.
- **Build before commit**: `npm run build` catches type errors that `npx tsc --noEmit` might miss in lazy imports. `npm run build` runs `tsc -b` against project references (`tsconfig.app.json`); bare `tsc --noEmit` against the root config does not, so flags-only errors can slip through.

## TypeScript strict flags

`tsconfig.app.json` has `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled. Two idioms to know:

- **Indexed access** (`arr[i]`, `record[key]`) returns `T | undefined`. Fix with `?? default` at the call site, a `const x = arr[i]; if (!x) continue` guard, or `arr[i]!` inside loops where the bound proves safety.
- **Optional props** (`badge?: number`) cannot accept an explicit `undefined` — use **conditional spread** to omit the key: `<Tab {...(badge !== undefined && { badge })} />`. Spreading `false` is a no-op, so the pattern is safe.

## Testing

`npm test` runs vitest. Tests live in `src/data/__tests__/`. The current suite covers data-transform utilities (`constants`, `percentiles`, `filterPitches`, `computeSpringDeltas`). Add a `.test.ts` alongside any new pure function in `src/data/`.

## Verifying a change

Use the `verify-app-change` skill. Quick version:

1. `npm run dev` is running
2. Navigate to the page you changed
3. DevTools console clean (no red errors)
4. The visible field updated as expected
5. Other pages still render (smoke test 2-3 of the 9 routes)

## Environment

`cd pitch-plus-app && npm run dev` — Vite on localhost:5173. Type check: `npx tsc -p tsconfig.app.json --noEmit` (bare `tsc --noEmit` is a no-op).
