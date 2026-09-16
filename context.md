# context.md — read this before touching the codebase

> Give this file to any AI agent (Claude Code, Cursor, Copilot, etc.) as the first thing it
> reads on this repo. It exists to prevent scope drift — the model below was arrived at
> after an earlier design pass got it wrong (built e-commerce concepts for a services
> business), so treat the "do NOT build" list as load-bearing, not boilerplate.

---

## 1. What this project is

A **full-stack services agency** (TCS-style delivery model). We are one company; clients
hire us to build and run things for them.

- **Services offered:** AI agents, SaaS products, cloud services, DevOps.
- **Target customers:** small businesses, struggling businesses, and individuals building
  their own startup.
- **This repo:** the agency's website — an animated multi-page marketing site + a client
  portal with payments/invoicing.

## 2. The core model (memorize this)

```
Prospect → browses marketing site → submits enquiry → Lead
Lead → staff qualifies offline → Client (+ portal login issued)
Client → gets an Engagement (the work) → staff issues an Invoice
Invoice → client pays via Razorpay → server-verified webhook marks it paid
```

**Entities:** `Lead`, `Client`, `User` (staff | client), `Engagement`, `Invoice`, `Payment`.
Services themselves are **not a database entity** — they're hardcoded data
(`content/services.js`) that the marketing pages render.

## 3. Do NOT build (this was tried and reverted)

- ❌ No `Order`, `Cart`, `CatalogItem`, or checkout flow — we don't sell products, we
  deliver services against invoices.
- ❌ No multi-tenancy — this is **single-org**. "Clients" are our customers, not tenants
  running their own instance. Isolation is `clientId` ownership, not a tenant model.
- ❌ No Kafka / event bus — traffic is too low to justify it (lead forms + a small portal).
  If you think you need one, stop and ask; don't add it silently.
- ❌ No CMS for service content — it's hardcoded in code on purpose (devs edit + deploy).
- ❌ Don't trust the client for payment state, ever. An invoice is `paid` only when the
  Razorpay webhook signature is verified server-side. Never on a client callback.

## 4. Stack

MongoDB · Razorpay · Docker · Node.js/Express (backend, `type: module`, ESM).
Frontend: Next.js + Framer Motion (proposed; not yet built — see `frontend.md`).

## 5. Non-negotiable rules

1. **Ownership scoping is centralized.** Every query for a `client`-role user goes through
   `shared/db/ownScope.js` (`ownScope()` / `requireOwnership()`). Never write a raw query
   that skips it — a missed filter is a data leak between clients.
2. **Payments only flip state via the verified webhook** (`modules/payments`, HMAC-checked,
   idempotent on `razorpayPaymentId`). The `/payments/create` endpoint only creates a
   Razorpay order; it never marks anything paid.
3. **Services live in `content/services.js`.** Reference them by `slug` string from the
   backend; don't create a `services` collection in Mongo.
4. **Modular monolith.** Don't split into microservices without a measured reason
   (see `architecture.md` §8.2 equivalent reasoning — extract on evidence, not anticipation).

## 6. Repo map

```
content/services.js       hardcoded service offerings (the only "catalog")
src/modules/
  auth/                    login (staff + client), staff provisions client logins
  leads/                   PUBLIC enquiry intake + staff pipeline
  clients/                 staff converts a lead → client
  engagements/             the work: proposal → active → completed
  invoices/                staff bills an engagement
  payments/                Razorpay create + webhook verify
src/shared/
  db/ownScope.js           the ownership guard — read rule 5.1 above
  db/mongo.js              connection + indexes
  mailer/                  email stub (enquiry + invoice notifications)
  middleware/              auth (JWT), roles, error handling
```

## 7. Full documentation

For anything beyond this quick-start, read in this order:

| Doc | Covers |
|-----|--------|
| `architecture.md` | System structure, C4 views, reliability, why no event bus |
| `design.md` | Entity schemas, ERD, lead-to-cash flow, security |
| `frontend.md` | Marketing-site animation system, navigation, portal UI |

## 8. Open decisions (don't assume these are settled)

- Exact backend framework (Express now; NestJS/other possible)
- Frontend route groups are resolved as one Next.js app; token storage remains open
- Token storage strategy (cookie vs header)
- Mailer provider, spam protection on the enquiry form
- Whether/when a proposal needs explicit client approval before `engagement.status = active`

If a task depends on one of these, ask rather than guessing a default silently.

## 9. Current status

The Express modular-monolith API is running against the configured MongoDB deployment and
has smoke-tested auth, leads, ownership, and invoice flows. The frontend is implemented as
one Next.js App Router app in `web/`, with separate marketing and portal route groups.
Razorpay checkout remains configuration-dependent because live payment keys are not present.
