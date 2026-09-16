# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — prospects:** small businesses, struggling businesses, and individuals building
their own startup who need AI agents, SaaS products, cloud infrastructure, or DevOps work
built and run for them, but lack the in-house capability to do it themselves.

**Secondary — signed clients:** use the client portal to track engagement status and pay
invoices once they've converted from a lead.

**Internal — agency staff:** qualify leads, manage engagements, and issue invoices through
the same authenticated system rather than a separate admin surface.

## Product Purpose

ETDOX is a full-stack services agency (TCS-style delivery model): one company that builds
*and then runs* technical systems for its clients — AI agents, SaaS products, cloud
infrastructure, DevOps — rather than selling a packaged product. This repo is both the
agency's shopfront (marketing site) and its delivery mechanism (client portal): it exists to
turn visitor enquiries into paying, ongoing engagements, and to give signed clients
visibility into what's being delivered and what they owe.

## Positioning

Unlike a freelancer or a typical dev shop that builds and hands off, ETDOX builds *and*
continues to own and run what it builds — the client portal itself is the proof: clients
don't just receive delivered software, they get an ongoing relationship where engagement
status, deliverables, and billing all live in one place. Unlike a no-code/DIY tool, delivery
is hands-on and senior-led, not self-serve.

## Operating Context

Lead-to-cash is the core workflow: a visitor submits an enquiry against a specific service →
staff qualify it offline → staff convert a qualified lead into a Client and provision a
portal login → staff create an Engagement (`proposal → active → paused → completed`) → staff
issue an Invoice against it → the client pays via Razorpay, with the invoice flipping to
`paid` only on a server-verified webhook, never a client-side callback. Staff and clients
share one authenticated portal, scoped by role.

## Capabilities and Constraints

- **Single-org, not multi-tenant.** "Clients" are ETDOX's customers, not tenants running
  their own instance. Isolation is by `clientId` ownership, enforced centrally (`ownScope()`),
  never a per-query judgment call.
- **Not e-commerce.** No Order/Cart/CatalogItem/checkout — billing is per-engagement
  invoices, not a shopping cart.
- **Services are code, not data.** AI agents / SaaS / cloud / DevOps offerings are hardcoded
  in `content/services.js`, not a database collection or CMS — devs edit and deploy to
  change the catalog.
- **No event bus / background workers at this scale.** Email and invoice reminders are
  fire-and-forget.
- **Payment state changes only on a verified Razorpay webhook** — the client is never
  trusted for payment confirmation.
- **Undecided:** exact backend framework long-term (Express now, NestJS possible), auth
  token storage (cookie vs header), mailer provider and enquiry-form spam protection,
  whether an engagement needs explicit client approval before going `active`.

## Brand Commitments

- **Confirmed name: ETDOX.** Earlier frontend work had shipped placeholder "Asterline"
  branding (site title, header mark, footer, contact email); this has been corrected
  throughout `web/` to ETDOX. Contact email is `etdoxorg@gmail.com` until a branded domain
  exists.

## Evidence on Hand

No real case studies, client logos, testimonials, or proof-of-work exist yet. The `/work`
page already states this explicitly ("Case studies will be added as engagements are
completed."). Future work must not fabricate any of these.

## Product Principles

1. Build **and** run — the relationship doesn't end at delivery; the portal is where that
   ongoing ownership lives.
2. Trust the server, never the client, for anything that moves money.
3. Own client data isolation centrally, not per-query.
4. Keep the offerings as code, not data — no CMS, no database catalog, deliberately.
5. Don't scale infrastructure ahead of evidence — no multi-tenancy, no event bus, no
   microservices until a measured need appears.

## Accessibility & Inclusion

No product-specific requirement established yet.
