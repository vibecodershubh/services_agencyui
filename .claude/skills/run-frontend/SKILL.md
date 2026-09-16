---
name: run-frontend
description: Build, run, and drive the services-agency web app (Next.js frontend + Express API). Use when asked to start, run, or screenshot the frontend/portal, or to confirm a frontend change works in the real app.
---

The frontend (`web/`, Next.js App Router) needs the API (`src/`) running
alongside it — pages fetch `/api/services`, `/api/leads`, `/api/auth/login`
etc., proxied to the API by `web/next.config.mjs`. Drive both together with
`.claude/skills/run-frontend/driver.mjs` (Node + `playwright-core`, launched
against system Chrome — see Gotchas for why).

All paths below are relative to the repo root.

## Prerequisites

- Node 20+ (repo requirement).
- `.env` at repo root with a working `MONGO_URI` (Atlas or local — the API
  needs a real DB connection to boot; `MONGO_URI` from `.env.example` alone
  won't connect).
- A system Chrome or Edge install (Windows paths already in
  `driver.mjs`'s `CHROME_CANDIDATES` — this environment has no network
  access to `cdn.playwright.dev` to fetch Playwright's own browser build,
  so the driver launches the OS browser instead).

## Setup

```bash
npm install          # installs playwright-core (devDependency) + API deps
npm --prefix web install
```

## Run (agent path)

```bash
node .claude/skills/run-frontend/driver.mjs demo
```

This starts the API (`npm run dev`, :3000) and the frontend
(`npm run dev:web`, :3001) in the background if they aren't already up,
waits for both to respond, then visits the home page, `/services`, and
`/portal/login`, screenshotting each and reporting console errors +
failed network requests. It leaves both servers running afterward.

Screenshots -> `%TEMP%\services-agency-run\shots\`. Logs ->
`%TEMP%\services-agency-run\backend.log` / `frontend.log`.

| command | what it does |
|---|---|
| `node driver.mjs up` | start API + frontend in the background, wait until both respond |
| `node driver.mjs shot <path> <name>` | screenshot `http://localhost:3001<path>` to `shots/<name>.png`, print console + failed-request diagnostics |
| `node driver.mjs demo` | `up`, then shoot home / `/services` / `/portal/login` (one browser launch, reused across all three) |
| `node driver.mjs down` | kill whatever's listening on :3000 and :3001 |

Example — screenshot one specific page once the app is already up:

```bash
node .claude/skills/run-frontend/driver.mjs shot "/services/ai-agents/support-chatbot" "service-detail"
```

**Git Bash on Windows will mangle that command** — see Gotchas.

Always call `down` when you're done so the next run starts clean.

## Run (human path)

```bash
npm run dev       # API, :3000 — separate terminal
npm run dev:web   # frontend, :3001 — separate terminal
```

Open `http://localhost:3001` in a browser. `Ctrl-C` each terminal to stop.

## Test

No test suite for the frontend or API (per CLAUDE.md — no linter, no test
framework, no build step). `npm run test:mongo` / `npm run test:invoices`
exercise the API against a live Mongo connection, not the frontend.

---

## Gotchas

- **Git Bash mangles leading-`/` CLI args into Windows paths.** Running
  `node driver.mjs shot "/services/x" name` from Git Bash silently rewrites
  `/services/x` to `C:/Program Files/Git/services/x`, and Playwright then
  fails with `Cannot navigate to invalid URL`. Fix: prefix the command with
  `MSYS_NO_PATHCONV=1`, e.g.
  `MSYS_NO_PATHCONV=1 node .claude/skills/run-frontend/driver.mjs shot "/services/ai-agents/support-chatbot" service-detail`.
  This only bites the `shot` subcommand's path argument, not `up`/`down`/`demo`.
- **Playwright's own Chromium download is blocked here.** `npx playwright
  install` times out hitting `cdn.playwright.dev`. Don't try to fix this by
  re-installing browsers — the driver already routes around it by launching
  system Chrome/Edge via `executablePath`. If neither is at the paths in
  `CHROME_CANDIDATES`, add the real path there rather than chasing the
  Playwright download.
- **`spawn(..., { detached: true })` throws `EINVAL` on Windows** when
  spawning `npm` with a separate `args` array and `detached: true` together.
  The driver spawns `npm run <script>` as a single string with `shell: true`
  and skips `detached` — `unref()` alone is enough to let the parent
  process exit while the child keeps running.
- **`npm run dev` on :3000 needs a real MongoDB connection to finish
  booting** — `connectMongo()` runs before the server starts listening, so
  a bad/missing `MONGO_URI` makes `/health` never come up and `driver.mjs
  up` times out after 40s with no useful error in the console (check
  `backend.log`).
- **A `/favicon.ico` 404 is expected**, not a bug — `web/app/` ships no
  icon file yet. The driver already filters it out of `failed requests`;
  don't re-report it as a finding.
- **A `taskkill /F` mid-compile can corrupt `web/.next`**, especially on
  this repo (it lives under OneDrive, which locks/syncs files mid-write).
  Symptom: the frontend never becomes ready and `frontend.log` shows
  `EINVAL: invalid argument, readlink '...\.next\server\app\(marketing)\...'`
  right after `✓ Starting...`. Fix: `driver.mjs down`, then
  `rm -rf web/.next`, then retry — Next.js rebuilds the cache from scratch.
- **`$!` after backgrounding `npm run dev &` is the npm wrapper's PID, not
  the server's** — npm doesn't forward `SIGTERM` to the process it spawns.
  Stop by killing whatever's listening on the port, which is what
  `driver.mjs down` does (parses `netstat -ano` + `taskkill /F`).

## Troubleshooting

- **`driver.mjs up` reports `backend ready: false`**: check
  `%TEMP%\services-agency-run\backend.log` — almost always a Mongo
  connection failure (wrong/missing `MONGO_URI` in `.env`, or an Atlas IP
  allowlist issue).
- **`Error: spawn EINVAL` from `driver.mjs`**: you reverted the spawn call
  to use an `args` array with `detached: true`. Use the single-string
  `shell: true` form instead (see Gotchas).
- **`Cannot navigate to invalid URL` / URL contains `C:/Program Files/Git`**:
  Git Bash path-mangled your `shot` argument — rerun with
  `MSYS_NO_PATHCONV=1` (see Gotchas).
- **`frontend ready: false` and `frontend.log` shows `EINVAL: ...
  readlink ...\.next\...`**: corrupted `.next` cache, usually from a prior
  forced kill. `driver.mjs down`, `rm -rf web/.next`, retry.
