# Services Agency — Repo Scaffold

Starter API server for the agency website + client portal (corrected model). Implements the
**lead-to-cash** backend: enquiry intake → client → engagement → invoice → Razorpay payment.

> **⚠ Language note:** Node.js + Express, chosen because backend language is still open and
> Node pairs cleanly with MongoDB + Razorpay. Module boundaries match the design docs, so a
> port to NestJS is mechanical.
>
> **No Kafka / no event bus** — deliberately (see `architecture.md` §9). This is a modest
> CRUD app; an event bus would be over-engineering at this scale.

## Layout
```
.
├── docker-compose.yml     # app + mongo (that's all you need)
├── Dockerfile
├── .env.example
├── content/
│   └── services.js        # HARDCODED services (devs edit) — the offerings
└── src/
    ├── index.js           # wires modules + a public /services endpoint
    ├── config/
    ├── modules/
    │   ├── auth/          # login + staff-provisions-client
    │   ├── leads/         # PUBLIC enquiry intake + staff pipeline
    │   ├── clients/       # staff convert lead → client
    │   ├── engagements/   # the work: proposal → active → completed
    │   ├── invoices/      # staff bill engagements
    │   └── payments/      # Razorpay + webhook verify → invoice paid
    └── shared/
        ├── db/            # mongo + ownScope (client sees only own records)
        ├── mailer/        # email stub (swap for Resend/SES/SendGrid)
        └── middleware/    # auth, roles, errors
```

## Run it
```bash
cp .env.example .env
docker compose up
curl localhost:3000/health
curl localhost:3000/services      # the hardcoded offerings

# In a second terminal, run the Next.js frontend:
cd web
npm install
npm run dev
```

The Express API runs at `http://localhost:3000`; the Next.js frontend runs at
`http://localhost:3001`. Set `API_ORIGIN` if the API is running on another host or port;
`/api/*` is proxied to the API server.

## The flow, end to end
```bash
# 1. A visitor submits the enquiry form (PUBLIC — no auth)
curl -X POST localhost:3000/leads -H 'Content-Type: application/json' \
  -d '{"name":"Asha","email":"asha@startup.in","serviceSlug":"saas-mvp","message":"Need an MVP"}'

# 2. Staff log in, see the lead, convert it to a client, provision a client login,
#    create an engagement, then issue an invoice. (Seed a staff user first — see below.)

# 3. Client logs in → GET /engagements, GET /invoices (sees only their own)

# 4. Client pays an invoice:
#    POST /payments/create -> opens Razorpay widget -> Razorpay webhook -> invoice `paid`
#    (only the verified server webhook flips it — never the client callback)
```

### Seed a staff user (once)
```js
// node one-off, or a small seed script:
// hash a password with bcryptjs and insert { email, passwordHash, role: "staff" } into users
```

## Real vs stubbed
| Real | Stubbed / TODO |
|------|----------------|
| Auth (bcrypt + JWT), roles | Refresh tokens |
| Ownership scoping (client isolation) | — |
| Webhook HMAC verify + idempotency | Live Razorpay API call (stub id) |
| Leads/clients/engagements/invoices CRUD | Payment reconciliation job |
| Services-as-code + public endpoint | Mailer send (logs only) |

## Design references
- `design.md` — entities, ERD, lead-to-cash flow
- `architecture.md` — structure, why no event bus, deployment
- `frontend.md` — animated marketing site + portal UI
