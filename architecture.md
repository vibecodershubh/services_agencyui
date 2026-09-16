# Services Agency — Architecture

> **Status:** Draft (v2 — corrected model) · **Owner:** Shubh
> **Companion docs:** [`design.md`](./design.md) · [`frontend.md`](./frontend.md)
> **Stack:** MongoDB · Razorpay · Docker  · *(Kafka deferred)*

This document describes the **structure and rationale** of the platform. For entities and
schemas see `design.md`; for the animated marketing site and portal UI see `frontend.md`.
Sections marked **⚠ Open decision** are not yet settled.

---

## 1. What this system is

A full-stack **services agency** website (TCS-style delivery model). It has two halves with
very different characteristics, and the architecture follows that split:

| Half | Traffic pattern | Data | Hosting shape |
|------|-----------------|------|---------------|
| **Marketing site** (public) | Read-heavy, cacheable, animated | Content **hardcoded in code** | Static/SSG behind a CDN |
| **Client portal** (private) | Low-volume, authenticated, dynamic | MongoDB | App server + database |

The important architectural consequence: the two halves have **different scaling and
deployment profiles**, so they are treated as separate deployable surfaces even if they
share one repo and design system.

---

## 2. Architectural principles

1. **Marketing is content, not compute.** Service pages are hardcoded and rendered
   statically — no database call to show a service. Fast, cheap, cacheable.
2. **The portal is a modest CRUD app, not a distributed system.** Build it simply; add
   infrastructure only when real load appears.
3. **Single-org, ownership-scoped.** We are one company; clients are customers. Isolation
   is by `clientId` ownership, not multi-tenancy.
4. **The server is the source of truth for money.** Invoices flip to paid only on a
   server-verified Razorpay webhook.
5. **No premature infrastructure.** No event bus, no workers, until a genuine async
   pipeline justifies them (see §9).

---

## 3. System context (C4 — Level 1)

```
   ┌───────────┐     ┌───────────┐     ┌────────────┐
   │ Prospects  │     │ Clients    │     │ Agency staff│
   │ (visitors) │     │ (signed)   │     │ (admin)     │
   └─────┬─────┘     └─────┬─────┘     └──────┬─────┘
         │ browse           │ portal          │ manage
         ▼                  ▼                 ▼
   ┌─────────────────────────────────────────────────┐
   │            Services Agency Platform               │
   │     marketing site  +  client portal              │
   └─────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
             ┌────────────┐       ┌──────────────┐
             │  Razorpay   │       │ Email / SMS   │
             │ (invoices)  │       │ (enquiry, etc)│
             └────────────┘       └──────────────┘
```

| Actor | Role |
|-------|------|
| Prospects | Browse services, submit an enquiry |
| Clients | View engagements, pay invoices, raise support |
| Agency staff | Work leads, manage engagements, issue invoices |
| Razorpay | Processes invoice payments, sends webhooks |
| Email/SMS provider | Enquiry notifications, invoice reminders |

---

## 4. Container view (C4 — Level 2)

```
┌──────────────────────────┐        ┌──────────────────────────┐
│   Marketing site          │        │   Client portal (SPA/SSR) │
│   (static / SSG, animated)│        │   authenticated app        │
└───────────┬──────────────┘        └───────────┬──────────────┘
            │ enquiry POST                        │ REST / HTTPS
            └──────────────┬──────────────────────┘
                          ▼
                  ┌──────────────┐
                  │  API server   │  auth · leads · clients ·
                  │  (modular)    │  engagements · invoices · payments
                  └──────┬───────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌─────────┐ ┌────────┐ ┌──────────┐
        │ MongoDB  │ │ Mailer  │ │ Razorpay  │
        └─────────┘ └────────┘ └──────────┘
```

| Container | Responsibility | Scaling |
|-----------|----------------|---------|
| Marketing site | Public animated pages; enquiry form | CDN / static replicas |
| Client portal | Authenticated client + staff UI | Stateless replicas |
| API server | All business logic and data access | Stateless, horizontal |
| MongoDB | Portal datastore | Vertical first; managed (Atlas) |
| Mailer | Enquiry + invoice emails | Managed provider |
| Razorpay | Payment gateway | External |

The marketing site and portal are implemented as one Next.js app in `web/`, using separate
route groups (`(marketing)` and `(portal)`) while keeping the API server independent.
This preserves shared design and navigation without coupling frontend rendering to MongoDB.

---

## 5. Component view (C4 — Level 3)

Inside the API server. Modules are separated but run as one deployable (a modular monolith
is right-sized here — this is not a system that needs microservices).

```
API server
├── auth          login, JWT, staff vs client roles
├── leads         enquiry intake, status tracking
├── clients       client records
├── engagements   the work: status, deliverables
├── invoices      billing against engagements
├── payments      Razorpay: create order, verify webhook
└── shared
    ├── db         Mongo connection + ownership-scope helper
    ├── mailer     email sending (enquiry, invoice)
    └── middleware auth, roles, error handling
```

Services (the offerings) are **not** a module here — they live as hardcoded data the
marketing frontend renders. The backend only references a `serviceSlug` string.

---

## 6. Architectural style & rationale

| Choice | Chosen | Rejected | Why |
|--------|--------|----------|-----|
| Backend shape | Modular monolith | Microservices | Modest CRUD scope; one deployable is simplest |
| Marketing content | Hardcoded + static | CMS / DB-driven | Your call; fastest and cheapest, full animation control |
| Tenancy | Single-org, `clientId` scoping | Multi-tenant isolation | One company, not a platform for many businesses |
| Async | None at v1 | Kafka / queue | No high-volume async pipeline exists yet (§9) |
| Payments | Razorpay per invoice | Cart/checkout | We bill for engagements, not sell products |

---

## 7. Ownership & authorization

The one data-isolation rule: **a client sees only their own records.** Every portal query
for a client is scoped by `clientId`, enforced in a shared helper rather than per endpoint.

| Role | Can see |
|------|---------|
| `client` | Only records where `clientId` = their own |
| `staff` | All records (leads, clients, engagements, invoices) |

Client-side role checks are UX only; the server authorizes every request.

---

## 8. Key flows

### 8.1 Enquiry (public → lead)
```
visitor submits enquiry form
   → API validates, creates Lead (status: new)
   → mailer notifies staff
   → visitor sees a thank-you state
```
No auth, but rate-limit and validate to stop spam. **⚠** add a captcha/honeypot if abused.

### 8.2 Invoice payment (portal → Razorpay)
```
client opens unpaid invoice
   → API creates a Razorpay order
   → checkout widget; client pays
   → Razorpay webhook → API verifies HMAC signature
   → invoice status: paid   (ONLY on verified webhook)
   → mailer sends receipt
```

> **Critical:** the client-side success callback is never trusted. Only the verified
> server-to-server webhook flips an invoice to paid.

---

## 9. Reliability & why no event bus

At this scale the reliability needs are ordinary:

| Concern | Handling |
|---------|----------|
| Enquiry email fails | Lead is already saved in Mongo; retry send, or staff see it in the admin list anyway |
| Payment webhook missed | Reconciliation: a periodic job polls Razorpay for invoices stuck `sent` past due |
| Duplicate webhook | Idempotent on `razorpayPaymentId` |
| DB write fails | Standard transaction / error handling; nothing spans two systems |

Because **no operation spans two systems that must stay in sync** (the way a DB+Kafka write
would), there is no dual-write problem and no need for an outbox or event bus. If automated
cross-service provisioning appears later, revisit — that's when events earn their place.

---

## 10. Deployment topology

| Environment | Composition |
|-------------|-------------|
| Dev | `docker-compose`: API server + MongoDB (+ optional local mailer) |
| Prod | Marketing/portal on a static/SSR host (e.g. Vercel/Netlify) or CDN; API server on a container host or managed platform; MongoDB Atlas |

- Frontends are stateless; the marketing half is cache-friendly and CDN-served.
- Secrets (Razorpay keys, webhook secret, mailer keys) come from a secrets manager.

---

## 11. Technology decisions (ADR summary)

| # | Decision | Rationale | Trade-off |
|---|----------|-----------|-----------|
| 1 | MongoDB | Flexible, simple for this CRUD | Fewer relational guarantees; fine here |
| 2 | Razorpay per invoice | India-first, webhook model | Vendor lock-in; isolate in payments module |
| 3 | Docker | Reproducible dev/prod | Small learning curve |
| 4 | Modular monolith | Right-sized; one deploy | Keep module lines clean if it ever grows |
| 5 | Hardcoded services | Speed, animation control, no CMS ops | Devs edit copy; revisit if non-devs must |
| 6 | **No Kafka at v1** | No async pipeline to justify it | Add later if provisioning automation appears |

---

## 12. Scalability

This is not a high-throughput system, so scaling is modest and mostly free:

| Tier | Strategy |
|------|----------|
| Marketing | Static + CDN — scales to any traffic essentially for free |
| Portal / API | Stateless replicas behind a load balancer |
| MongoDB | Vertical first; the portal's data volume is small |

Optimize for **fast marketing pages** (first impression) over backend throughput.

---

## 13. Risks & mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Client sees another client's data | High | Central `clientId` scoping + tests |
| Spoofed/missed payment events | High | Webhook signature verify + reconciliation (§9) |
| Enquiry-form spam | Medium | Rate limit, honeypot/captcha, validation |
| Over-engineering v1 | Medium | Keep it a monolith; no premature infra |
| Marketing page slowness hurts conversion | Medium | Static generation + asset/animation budget |

---

## 14. Open decisions

| # | Decision | Notes |
|---|----------|-------|
| 1 | One app or two (marketing + portal) | Same Next.js app vs separate |
| 2 | Backend language/framework | Node.js + Express/NestJS leading |
| 3 | Mailer provider | e.g. Resend / SES / SendGrid |
| 4 | Auth token storage | Cookie vs header |
| 5 | Spam protection on enquiry | captcha vs honeypot |

---

## 15. See also
- [`design.md`](./design.md) — entities, ERD, schemas, lead-to-cash flow.
- [`frontend.md`](./frontend.md) — marketing-site animation, navigation, portal UI.
