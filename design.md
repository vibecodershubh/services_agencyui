# Services Agency — Website & Client Portal · Design

> **Status:** Draft (v2 — corrected model) · **Owner:** Shubh
> **Stack:** MongoDB · Razorpay · Docker  · *(Kafka deferred — see §9)*
> **Model:** Single-org agency site + client portal (NOT a multi-tenant store)

We are a full-stack **services agency** (TCS-style): clients hire us to build and run things
— AI agents, SaaS products, cloud, and DevOps — mostly for small businesses, struggling
businesses, and individuals starting up. This website is our **shopfront and delivery
portal**, not an e-commerce product. There are no carts or orders; the objects that matter
are **services, leads, clients, engagements, and invoices**.

Sections marked **⚠ Open decision** are not yet settled.

---

## 1. The two halves

| Half | Audience | Nature | Content source |
|------|----------|--------|----------------|
| **Marketing site** (public) | Visitors / prospects | Animated, multi-page shopfront | **Hardcoded in code** (devs edit) |
| **Client portal** (private) | Signed clients + agency staff | Data-driven app | MongoDB |

The marketing site sells; the portal delivers. They share a design system but are otherwise
distinct — the marketing site is mostly static/animated pages, the portal is an
authenticated application.

---

## 2. Services (what we offer)

Services are **defined in code**, not the database (per your choice — devs edit, no CMS).
Each lives as structured data the marketing pages render, and the enquiry form references.

```
service = {
  slug, title, area, summary, description,
  features: [...],
  tiers: [{ name, priceHint, includes: [...] }],   // priceHint is indicative, not a checkout
  faqs: [{ q, a }]
}

areas = ["ai-agents", "saas", "cloud", "devops"]   // extend freely
```

Because this is code, adding/editing a service is a code change + deploy — no runtime admin
needed. If non-devs ever need to edit copy, revisit a CMS (**⚠ future option**).

---

## 3. Core entities (portal database)

Only the portal needs a database. Note: this is **single-org** — we are the only company;
clients are our customers. Isolation is by record ownership (`clientId`), not multi-tenancy.

### 3.1 Lead — an enquiry from the marketing site
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `name` | String | Contact name |
| `email` | String | Contact email |
| `phone` | String | Optional |
| `company` | String | Optional |
| `serviceSlug` | String | Which service they enquired about |
| `message` | String | Free text |
| `budgetHint` | String | Optional |
| `status` | Enum | `new` \| `contacted` \| `qualified` \| `converted` \| `closed` |
| `createdAt` | Date | Timestamp |

### 3.2 User — a portal login (client-side or staff)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `email` | String | Unique, indexed |
| `passwordHash` | String | Hashed; never plaintext |
| `role` | Enum | `staff` \| `client` |
| `clientId` | ObjectId → Client | Null for staff |
| `createdAt` | Date | Timestamp |

### 3.3 Client — a company/individual we serve
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `name` | String | Client / company name |
| `primaryContact` | Object | name, email, phone |
| `sourceLeadId` | ObjectId → Lead | Lead they came from |
| `status` | Enum | `active` \| `paused` \| `closed` |
| `createdAt` | Date | Timestamp |

### 3.4 Engagement — the work we deliver for a client
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `clientId` | ObjectId → Client | Owner; ownership-scoped |
| `serviceSlug` | String | Which service |
| `title` | String | e.g. "Support chatbot build" |
| `status` | Enum | `proposal` \| `active` \| `paused` \| `completed` |
| `deliverables` | Array<{title, status, url?}> | Milestones / outputs |
| `startedAt` | Date | Timestamp |

### 3.5 Invoice — billing against an engagement
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `clientId` | ObjectId → Client | Owner |
| `engagementId` | ObjectId → Engagement | What it bills for |
| `lineItems` | Array<{desc, amount}> | Amounts in paise |
| `amount` | Number | Total in paise |
| `status` | Enum | `draft` \| `sent` \| `paid` \| `overdue` |
| `dueDate` | Date | Payment due |

### 3.6 Payment — Razorpay transaction against an invoice
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `invoiceId` | ObjectId → Invoice | One-to-one on capture |
| `razorpayOrderId` | String | From Razorpay API |
| `razorpayPaymentId` | String | Set on capture |
| `status` | Enum | `created` \| `captured` \| `failed` |
| `amount` | Number | Paise |

---

## 4. Relationships (ERD)

| Parent | Cardinality | Child | Via |
|--------|-------------|-------|-----|
| Lead | 1 → 1 | Client | `client.sourceLeadId` |
| Client | 1 → N | User | `user.clientId` |
| Client | 1 → N | Engagement | `engagement.clientId` |
| Client | 1 → N | Invoice | `invoice.clientId` |
| Engagement | 1 → N | Invoice | `invoice.engagementId` |
| Invoice | 1 → 1 | Payment | `payment.invoiceId` |

---

## 5. The lead-to-cash flow

1. Visitor browses the marketing site, clicks a service, submits the **enquiry form** → a
   `Lead` is created (`status: new`). The team is notified.
2. Team follows up **offline**, qualifies, and converts: creates a `Client` + first
   `Engagement`, and issues a portal login (`User`, role `client`).
3. Client logs into the portal, sees their engagement status and deliverables.
4. Staff issue an `Invoice` against the engagement.
5. Client pays via **Razorpay**; the server-verified webhook marks the invoice `paid`
   (never the client callback — see §7).

---

## 6. Marketing site pages

| Page | Purpose |
|------|---------|
| Home | Animated landing; overview of all service areas; entry to everything |
| Service area (×4) | AI agents · SaaS · Cloud · DevOps — each an animated section/page |
| Service detail | Scope, tiers, FAQ, enquiry CTA |
| Case studies / portfolio | Proof of work |
| About / Contact | Company + general enquiry |
| Enquiry form | Per-service or general; creates a Lead |

Navigation is home-first: the landing page routes into every area, and each area routes into
its detail pages — the multi-page, click-through structure you want, carried by animated
page transitions (see `frontend.md`).

---

## 7. Payments (Razorpay)

Payments bill **invoices**, not carts.

1. Client opens an unpaid invoice in the portal → server creates a Razorpay order.
2. Razorpay checkout widget opens; client pays.
3. Razorpay fires a **server-to-server webhook**; the server verifies the HMAC signature.
4. Only then does the invoice flip to `paid`.

> **⚠ Critical:** never mark an invoice paid on the client-side callback — it can be
> spoofed. Only the verified webhook is authoritative.

---

## 8. Security

| Area | Requirement |
|------|-------------|
| Secrets | Razorpay keys / webhook secret in a secrets manager — never in repo or client |
| Ownership | Clients see only their own records (scope every portal query by `clientId`) |
| Auth | Hash passwords; short-lived JWT + refresh; staff vs client roles |
| Payments | Verify every webhook signature |
| Transport | HTTPS everywhere; no sensitive data in query strings |

---

## 9. Why no Kafka (yet)

Kafka was added when we both thought this was a high-throughput multi-tenant product. For a
services-agency site — lead forms, a portal, and invoicing at small-business scale — an
event bus is over-engineering. The few async needs (notify team on a lead, invoice
reminders) are low-volume and handled by a simple mailer or lightweight job.

**Add an event bus later only if** genuinely async pipelines appear (e.g. automated client
onboarding/provisioning across services). Until then: MongoDB + Razorpay + Docker.

---

## 10. Open decisions

| # | Decision | Notes |
|---|----------|-------|
| 1 | Backend language / framework | Node.js + Express/NestJS leading |
| 2 | Auth token storage | Cookie vs header |
| 3 | Enquiry notifications | Email now; queue later if needed |
| 4 | CMS | Not now (hardcoded); revisit if non-devs must edit |
| 5 | Scheduling/booking a call | Out of scope for v1 (enquiry form only) |

---

## 11. See also
- `architecture.md` — system structure & deployment *(to be regenerated for this model)*
- `frontend.md` — marketing-site animation + portal *(to be regenerated for this model)*
