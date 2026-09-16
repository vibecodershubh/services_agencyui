# Services Agency — Frontend Architecture

> **Status:** Implemented v1 route foundation · **Owner:** Shubh
> **Companion docs:** [`architecture.md`](./architecture.md) · [`design.md`](./design.md)
> **Talks to:** API server (REST/HTTPS) · Razorpay checkout (portal only)

The frontend is the heart of this product: an **animated, multi-page marketing site** that
sells the agency's services, plus a **client portal** for delivery and payment. This doc
covers structure, the motion system, navigation, content-as-code, and portal integration.
Sections marked **⚠ Open decision** are not yet settled.

---

## 1. Two surfaces, one codebase

| Surface | Purpose | Rendering | Auth |
|---------|---------|-----------|------|
| **Marketing site** | Sell services; capture enquiries | Static/SSG, animation-heavy | Public |
| **Client portal** | Show engagements, pay invoices, support | Client-side / SSR, dynamic | Required |

Decision: **one Next.js app** — public routes statically generated, `/portal/*` routes
authenticated. Shared design system, one deploy. The implementation lives in `web/`.

---

## 2. Technology

| Concern | Proposed | Actually shipped (v1) |
|---------|----------|------------------------|
| Framework | React + **Next.js** | ✅ Next.js 15 App Router, `web/` |
| Animation | **Framer Motion** | ❌ not added — no animation library in `web/package.json` |
| Scroll effects | Lenis + Intersection Observer | ❌ not added |
| Styling | Tailwind + design tokens | ❌ hand-written CSS instead (`web/app/globals.css`) |
| Server state (portal) | TanStack Query | ❌ plain `fetch` + `useState`/`useEffect` |
| Forms | React Hook Form + Zod | ❌ plain `<form>` + `FormData`, no schema validation |
| Heavy visuals | Three.js / Spline / Lottie / webgl | ❌ not added |

v1 shipped the full route structure and a real (CSS-only, non-animated) design system —
functionally complete, but the "animated" part of "animated marketing site" (§5 below) is
still unbuilt. Treat §5–§7's motion system as a spec for future work, not a description of
what's live.

---

## 3. Content as code (services)

Per your choice, services are **hardcoded** — no CMS. They live as typed data the pages map
over, so adding a service is an edit + deploy.

```
/content/services.ts
export const services = [
  {
    slug: "support-chatbot",
    area: "ai-agents",
    title: "AI Support Agent",
    summary: "A chatbot that handles tier-1 support.",
    description: "...",
    features: ["24/7", "Trained on your docs", "Handoff to human"],
    tiers: [{ name: "Starter", priceHint: "from ₹X", includes: [...] }],
    faqs: [{ q: "...", a: "..." }],
  },
  // ...
];
export const areas = ["ai-agents", "saas", "cloud", "devops"];
```

Marketing pages are generated from this at build time (`getStaticPaths` over `slug`), so
every service page is static and instant.

---

## 4. Structure

```
/src
  /app
    /(marketing)
      page.tsx                # Home (animated landing)
      /services
        page.tsx              # All areas overview
        /[area]/page.tsx      # Area page (ai-agents, saas, …)
        /[area]/[slug]/page.tsx  # Service detail
      /work/page.tsx          # Case studies
      /about/page.tsx
      /contact/page.tsx
    /(portal)
      /portal
        /dashboard/page.tsx
        /engagements/[id]/page.tsx
        /invoices/[id]/page.tsx
        /support/page.tsx
  /components
    /marketing               # hero, service card, section reveals
    /portal                  # tables, invoice view, status badges
    /ui                      # shared design system (buttons, inputs…)
    /motion                  # reusable animation primitives (§5)
  /content
    services.ts              # the hardcoded services (§3)
  /lib
    /api                     # API client, enquiry + portal calls
    /auth                    # token handling, route guards
  /styles                    # tokens, theme
```

Route groups keep marketing and portal cleanly separated while sharing components.

---

## 5. Motion system

Animation is a feature here, so treat it as a **system**, not ad-hoc per page — consistency
is what makes it feel designed rather than busy.

### 5.1 Reusable primitives (`/components/motion`)
| Primitive | Use |
|-----------|-----|
| `<PageTransition>` | Wraps route changes — fade/slide between pages |
| `<Reveal>` | Fade-up on scroll into view (Intersection Observer) |
| `<Stagger>` | Children animate in sequence (cards, lists) |
| `<Parallax>` | Background/foreground depth on scroll |
| `<Magnetic>` | Buttons/links that lean toward the cursor |

### 5.2 Navigation as animated transitions
Your core ask — click from home into any service page — is built with animated route
transitions: the home page's service cards animate out, the target page animates in
(optionally a shared-element transition where the clicked card morphs into the page hero).
Framer Motion's `AnimatePresence` + layout animations handle this.

### 5.3 Motion budget (so it stays fast)
- Animate only `transform` and `opacity` (GPU-friendly); avoid animating layout properties.
- Respect `prefers-reduced-motion` — provide a calm fallback.
- Lazy-load heavy visuals (Three.js/Lottie) below the fold; never block first paint.
- Target: interactive hero in < 2.5s on mid-range mobile. **⚠ set a hard asset budget.**

---

## 6. Navigation & routing

- **Home-first:** the landing page is the hub; it routes into every service area, and each
  area routes into its detail pages — the multi-page click-through you described.
- Persistent animated nav (header) + a mobile menu with transitions.
- Breadcrumb sense: Home → Area → Service, so users never feel lost in the depth.
- Every service detail page ends in an **enquiry CTA** scoped to that service.

---

## 7. Enquiry flow (the one public write)

```
service page → "Get this service" → enquiry form
   (name, email, company, message; serviceSlug prefilled)
        → POST /leads
        → success animation / thank-you state
```
- The form is the only public write — validate hard, rate-limit, honeypot/captcha.
- `serviceSlug` is prefilled from the page so the lead knows what they asked about.

---

## 8. Client portal

| Screen | Shows |
|--------|-------|
| Login | Email + password → JWT |
| Dashboard | Their engagements at a glance, unpaid invoices |
| Engagement detail | Status, deliverables, timeline |
| Invoice detail | Line items, amount, **Pay** (Razorpay) |
| Support | Tickets / messages **⚠ scope TBD** |

- Portal data via the API client + TanStack Query (loading/error states, caching).
- Route guards redirect unauthenticated users to login; **server authorizes every call**.
- Far less animation than marketing — the portal favors clarity and speed.

---

## 9. Razorpay checkout (portal)

Mirrors the server rule from `architecture.md` §8.2 — **the client is never the authority
on payment.**

```
open invoice → POST /payments/create → { razorpayOrderId, keyId }
   → open Razorpay checkout widget
   → user pays
   → widget success callback  ✗ NOT trusted
   → show "confirming…" → poll invoice status
   → render "Paid" only when the SERVER (via verified webhook) says paid
```
The Razorpay **key id** is public and safe in the client; the **secret and webhook secret
never leave the server**.

---

## 10. Auth (client)

- Login → `{ accessToken }`; refresh on 401; clear + redirect on refresh failure.
- **Web:** httpOnly cookie for refresh token preferred; access token in memory. **⚠ Open
  decision** pending the API session model.
- Role (`staff` vs `client`) drives which routes/controls render — UX only, server is the gate.

---

## 11. Performance

| Technique | Applies to |
|-----------|------------|
| Static generation (SSG) | All marketing pages — instant, cacheable |
| CDN | Marketing assets globally |
| Code splitting / lazy motion | Keep initial bundle small |
| Image optimization | Visual-heavy service pages |
| `prefers-reduced-motion` | Accessibility + perf fallback |
| Query caching | Portal data |

Marketing speed is a conversion feature; the portal optimizes for correctness over polish.

---

## 12. Accessibility

Animation must not break usability: honor reduced-motion, keep focus order sane through
transitions, maintain WCAG 2.1 AA contrast, keyboard-navigable menus, labelled forms.

---

## 13. Testing

| Level | Scope |
|-------|-------|
| Unit | Components, motion primitives, utils |
| Integration | Enquiry form, portal flows (mocked API) |
| E2E | Enquiry submit, login, invoice pay **⚠ tooling TBD** |
| Visual/motion | Snapshot key pages; check reduced-motion path |

---

## 14. Open decisions

| # | Decision | Notes |
|---|----------|-------|
| 1 | One app or two | Single Next.js app recommended |
| 2 | Framework/animation libs | Next.js decided and shipped; Framer Motion still proposed, not yet added |
| 3 | Heavy 3D/Lottie hero | Only if a page truly needs it (perf cost) |
| 4 | Token storage | Cookie vs header |
| 5 | Support module scope | Tickets vs simple contact |
| 6 | Asset/motion budget numbers | Set hard limits early |

---

## 15. See also
- [`architecture.md`](./architecture.md) — system structure, deployment, reliability.
- [`design.md`](./design.md) — entities, ERD, schemas, lead-to-cash flow.
