# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Node --watch dev server (hot reload) — API on :3000
npm start            # Production run
docker compose up    # Start API + MongoDB together (recommended for local dev)

npm run dev:web      # Next.js dev server (web/) — frontend on :3001
npm run build:web    # Next.js production build
npm run start:web    # Next.js production run
```

No linter, no test framework, no build step — the backend is plain JavaScript running on Node 20+ with ESM. The frontend (`web/`) is a separate Next.js app; run both dev servers together for local frontend work. `web/next.config.mjs` rewrites `/api/:path*` to `API_ORIGIN` (defaults to `http://localhost:3000`), so the frontend calls its own `/api/...` paths rather than the API's absolute URL.

To verify the server is running: `curl localhost:3000/health`

Copy `.env.example` to `.env` before first run.

## Architecture

**Modular monolith** — single Express process, six feature modules, one shared layer. Not microservices; do not introduce service-to-service HTTP calls.

**Single-org, not multi-tenant.** There is only one agency. Client isolation is by `clientId` field within a shared database, not by tenant subtrees. Do not add tenant-level scoping.

**Not e-commerce.** Services are B2B consulting engagements billed per engagement, not a shopping cart. Do not model products, inventory, or SKUs.

### Module layout (`src/modules/`)

| Module | Role |
|--------|------|
| `auth` | Login + user provisioning (staff creates client logins) |
| `leads` | Public enquiry intake + staff status pipeline |
| `clients` | Convert a lead into a managed client record |
| `engagements` | Track work delivery (proposal → active → paused → completed) |
| `invoices` | Bill against an engagement |
| `payments` | Razorpay order creation + HMAC-verified webhook |

### Shared layer (`src/shared/`)

- **`db/ownScope.js`** — Central ownership guard. Exports `ownScope(req.context, filter)` and `requireOwnership(req.context, record)`. Client-role queries always go through `ownScope` so clients only see their own records. Staff bypass it. This must never be skipped for client-facing list/detail endpoints.
- **`db/mongo.js`** — MongoDB connection + index creation on startup. Collections: `users`, `leads`, `clients`, `engagements`, `invoices`, `payments`.
- **`middleware/auth.js`** — JWT verification (`authenticate`) and `requireRole(...roles)` helper. Sets `req.context = { userId, role, clientId }`.
- **`mailer/index.js`** — Stub; swap the send function for Resend/SES/SendGrid without changing call sites.

### Route access matrix

| Route | Access |
|-------|--------|
| `POST /leads` | **Public** — the only unauthenticated write |
| `GET /services` | **Public** |
| `GET /health` | **Public** |
| `GET /leads`, `PATCH /leads/:id` | Staff only |
| `POST /clients`, `GET /clients` | Staff only |
| `POST /engagements` | Staff only |
| `GET /engagements`, `GET /engagements/:id` | Any authenticated; client-scoped via `ownScope` |
| `POST /invoices` | Staff only |
| `GET /invoices`, `GET /invoices/:id` | Any authenticated; client-scoped via `ownScope` |
| `POST /payments/create` | Any authenticated; ownership-checked per invoice |
| `POST /payments/webhook` | Unauthenticated — HMAC-verified only |
| `POST /auth/login` | Public |
| `POST /auth/users` | Staff only (provisions client logins) |

### User roles

Two roles exist: `staff` and `client`. The role is embedded in the JWT (`p.role`). Staff bypass `ownScope`; clients are scoped by their `clientId`. There is no admin/superadmin distinction.

### Status enumerations

| Domain | Valid statuses |
|--------|---------------|
| Lead | `new` → `contacted` → `qualified` → `converted` / `closed` |
| Engagement | `proposal` → `active` → `paused` → `completed` |
| Invoice | `sent` → `paid` (set only by verified webhook) |
| Payment | `created` → `captured` |

### Data flow: lead → cash

Public lead form → `POST /leads` → staff qualifies → `POST /clients` (converts lead, provisions user login) → `POST /engagements` → `POST /invoices` → `POST /payments/create` (Razorpay order) → `POST /payments/webhook` (HMAC-verified; marks invoice `paid`).

Invoice status changes to `paid` **only** on a verified Razorpay webhook, never on client callback.

### Services catalog

`content/services.js` is a hardcoded array — not a database collection. Exports `services`, `areas`, and `serviceSlugs` (a `Set`). The backend validates `serviceSlug` references against `serviceSlugs`. Do not move it to a database unless there is an explicit requirement to let staff edit services via UI.

### Webhook body parser ordering

`POST /payments/webhook` is mounted with `express.raw()` **before** `express.json()` in `src/index.js`. This ordering is required for HMAC verification. Do not reorder the middleware registrations.

## Key design constraints (from `context.md` and `architecture.md`)

- **No event bus, no background workers** at v1. Email sends and invoice reminders are fire-and-forget. Do not introduce Redis, Kafka, or job queues for CRUD-volume operations.
- **Stateless app layer** — no in-process sessions or state. JWT carries identity. Multiple app replicas are safe.
- **Payments are HMAC-gated** — `razorpayPaymentId` is idempotent; the webhook handler deduplicates replays. Never trust client-side payment confirmation.
- **Frontend is implemented** in `web/` — a Next.js 15 App Router app with a `(marketing)` route group (home, services index/`[area]`/`[slug]`, work, about, contact) and a `(portal)` route group (`/portal/login`, `/dashboard`, `/engagements/[id]`, `/invoices/[id]`, `/support`) gated by a JWT kept in `sessionStorage`. Styling is hand-written CSS in `web/app/globals.css` — no Tailwind, and no animation library (Framer Motion) is wired in yet, despite being proposed in `frontend.md`'s Technology section. Treat that section of `frontend.md` as aspirational, not current, until an animation library is actually added.
- The legacy static prototype (`public/` + `express.static` in `src/index.js`) has been removed now that `web/` is the real frontend — do not resurrect it as a second marketing site.

## Environment variables

All config is in `src/config/index.js` sourced from env. Key vars: `MONGO_URI`, `MONGO_DB`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

The Razorpay live order creation in `payments/index.js` is stubbed with a placeholder order ID pending API key setup.
