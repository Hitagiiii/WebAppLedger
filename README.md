# Sakura Ledger 🌸

An anime-inspired personal finance web app: a single-account ledger for income, expenses, budgets, savings goals, debts, analytics, reports, and a calendar — all persisted in your browser.

Built with **React 19 + TypeScript + Vite 8**, routed with **React Router 7**, charted with **Recharts**, icons from **lucide-react**, linted with **Oxlint**, tested with **Vitest + Testing Library**.

## Quick start

```bash
npm install       # install dependencies
npm run dev       # start dev server (http://localhost:5173)
npm run build     # type-check (tsc -b) + production build to dist/
npm run preview   # serve the production build locally
npm run lint      # Oxlint
npm test          # Vitest, full suite (71 tests)
npm run test:watch  # Vitest in watch mode
```

## Features

| Area | What you get |
| --- | --- |
| **Dashboard** | KPIs (net balance, income/expense this month, budgets at risk), monthly cash-flow chart, spending by category, budget/goal/debt summaries, upcoming bills, recent activity, quick actions |
| **Transactions** | Full CRUD, filters (date range, type, category, payment method, min/max, text search), sortable table, pagination, CSV import/export, detail drawer |
| **Ledger** | Chronological running-balance ledger, newest first, with filters and CSV export |
| **Budgets** | Monthly category budgets, pace/spent/remaining, overspend warnings, month picker |
| **Goals** | Savings goals with target/date, progress, deposits (withdrawals supported) |
| **Debts** | Debt accounts with principal/APR/min-payment, payment history, payoff progress; payments recorded separately from cash unless you opt in to ledger posting |
| **Analytics** | Trend lines, category breakdown, budget accuracy, goal momentum, debt reduction, weekday/weekend patterns |
| **Reports** | Monthly summaries, year overview, category comparisons, CSV export, printable view |
| **Calendar** | Month grid of transaction days, budget due markers, goal deadlines, debt due dates |
| **Settings** | Profile, theme (light/dark), currency display, opening balance, backup/restore JSON, CSV template, danger zone (reset to seed / clear all data) |
| **Auth (demo)** | Local register/login with salted SHA-256 digests, session in localStorage |

## Data model & money handling

- **All amounts are integer centavos** (e.g. ₱1,250.50 → `125050`). No floating-point money math anywhere; formatting/parsing lives in `src/utils/format.ts`.
- **One aggregate ledger account** for cash. Income credits, expenses debit. **Transfers are not modeled** (documented limitation) — use categories or two transactions.
- **Running balances** are computed chronologically (date asc → createdAt asc → id asc) and displayed newest-first.
- **Opening balance** (`settings.openingBalance`, seeded at ₱120,000) anchors every balance.
- **All financial math** (periods, budgets, goals, debt status, cash-flow series) is centralized in `src/utils/finance.ts`; validation throws `ValidationError` with field-level details from `src/utils/validate.ts`.

## Persistence

- Storage key: `sakura-ledger:db:v1` (see `src/constants/index.ts` → `STORAGE_KEYS.database`).
- Auth session key: `sakura-ledger:auth:v1`.
- Malformed/corrupt data **falls back to the seed dataset** instead of crashing (`src/services/repository.ts`).
- Seed data comes from `src/mock-data/*.json` plus generated June–October 2026 history (`src/data/seed.ts`).
- Settings → Backup/Restore exports/imports the full database as JSON.

## Auth: demo mode vs. production

The auth system is **explicitly a local demo**, not production security:

- Credentials are stored in your browser's localStorage, hashed with a salted SHA-256 digest (Web Crypto, with a synchronous fallback hash).
- There is **no server**, no HTTPS-only cookies, no rate limiting, no email verification.
- Anyone with access to your browser profile can read the data.

For a real deployment you would replace `src/context/AuthContext.tsx` with a server-backed session (HTTP-only cookies, proper password hashing such as argon2/bcrypt server-side) and move the ledger to an API with per-user authorization.

## Project structure

```
src/
  app/           router, ErrorBoundary, route tests
  components/    UI primitives (ui/), Navbar, Sidebar, charts, layout helpers
  constants/     nav items, categories, payment methods, storage keys
  context/       LedgerContext (data + mutations), AuthContext, ToastContext
  data/          seed generation
  features/      transaction form
  layouts/       AppLayout (auth shell), AuthLayout
  pages/         Dashboard, Transactions, Ledger, Budgets, Goals, Debts,
                 Analytics, Reports, Calendar, Settings, NotFound, auth/
  routes/        ProtectedRoute
  services/      localStorage repository, backup validation
  styles/        design tokens (variables.css), app.css, ui.css
  utils/         finance, format, validate, csv, id, notifications
  test/          vitest setup
```

## Routing

- `/` → redirects to `/dashboard`.
- Auth shell: `/login`, `/register`.
- Protected shell: `/dashboard`, `/transactions`, `/ledger`, `/budgets`, `/goals`, `/debts`, `/analytics`, `/reports`, `/calendar`, `/settings`.
- Legacy aliases: `/budget` → `/budgets`, `/debt-loans` → `/debts`, `/protected` → `/dashboard`.
- Unknown paths render a 404 page.
- Unauthenticated visitors hitting protected routes are sent to `/login`.

Routes are **code-split** (`React.lazy`) so the heavy Recharts bundle only loads on Analytics/Reports/Dashboard.

## Styling

- Anime-inspired "Sakura" palette: deep navy text, cherry-blossom pinks, lavender accents.
- Design tokens in `src/styles/variables.css`; dark theme via `html[data-theme="dark"]` (theme is applied before first paint by a small inline script in `index.html`).
- No CSS framework — hand-rolled CSS in `src/styles/app.css`, `src/components/ui/ui.css`, and component stylesheets.

## Testing

```bash
npm test
```

4 suites / 71 tests: financial math (`finance.test.ts`), validation (`validate.test.ts`), persistence & backup safety (`repository.test.ts`), and full route/auth/CRUD interactions (`router.test.tsx`).

## Known limitations

1. **No transfers** between accounts — a single aggregate cash account only.
2. **No recurring transactions** — each occurrence is entered manually.
3. **Auth is local/demo only** (see above).
4. **Debt payments** are tracked in debt records; they post to the cash ledger only when "post to ledger" is checked (otherwise cash balance and debt payoff can drift apart — intentional, documented).
5. **No multi-device sync** — data lives in one browser's localStorage until exported.
6. `src/components/StatCard`, `UserCard`, `LineGraph`, `ReChartsPlaceholder`, `PieChart` are legacy/template components superseded by the live pages; kept for reference (they are not routed).
7. Chart bundle size (~400 kB gzipped chunk) comes from Recharts; loaded lazily.

## License

Private / OJT project. Not licensed for redistribution.
