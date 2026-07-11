# Answerspot

AI answer-monitoring platform for local service businesses. Track whether ChatGPT, Perplexity, and Gemini recommend a business — score visibility, show real answers, and ship plain-language fix-it recommendations.

**Product codename / GitHub:** ANSWERSBOT  
**Stack:** Next.js · NestJS · Prisma · Postgres · Redis · Python/Celery · Docker

## Quick start (local)

### Prerequisites

- Node.js 20+
- Docker Desktop (Postgres + Redis + MinIO)
- Python 3.12+ (workers only)

### Boot

```powershell
cd D:\GITHUBCLONES\ANSWERSBOT
copy .env.example .env
# edit JWT_SECRET to a long random string

# Infrastructure only (recommended first)
docker compose up -d postgres redis minio

npm install
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate dev --name init --schema apps/api/prisma/schema.prisma
npm run prisma:seed

# Terminal A — API
npm run dev:api

# Terminal B — Web
npm run dev:web
```

Open:

| Surface | URL |
|---------|-----|
| Marketing home | http://localhost:3000 |
| Login (demo JWT) | http://localhost:3000/login → **Continue as Demo Owner** |
| Dashboard | http://localhost:3000/dashboard |
| API health | http://localhost:4000/api/v1/health |
| Swagger | http://localhost:4000/docs |

Demo auth: `POST /api/v1/auth/session` with `{ "token": "demo" }`.

### Full stack via Docker

```powershell
docker compose up --build
```

Then migrate + seed inside the API container:

```powershell
docker compose exec api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose exec api node apps/api/prisma/seed.js
```

## Repo layout

```
apps/web          Next.js dashboard
apps/api          NestJS API + Prisma
apps/workers      Celery workers (scan → parse → recs)
packages/shared-types
infra/docker
docs/             Design PDFs + generated DESIGN_SPEC pointer
```

## MVP milestones

| Milestone | Goal |
|-----------|------|
| M0 | Scaffold boots, health, auth stub |
| M1 | Onboarding + auto queries |
| M2 | Scan runner (Perplexity first) |
| M3 | Parser (mention/rank/competitors) |
| M4 | Dashboard + Answer Explorer |
| M5 | Recommendation engine + competitor radar |
| M6 | Stripe billing |
| M7 | White-label reports |

## Engineering notes

- **Tenant isolation:** JWT carries `organizationId`; `OrgScopeGuard` enforces business ownership.
- **AI Overview:** blocked (ADR-0004) until legal review — do not implement in M0–M4.
- **Prisma owns migrations.** Python workers read via SQLAlchemy; they must not migrate.
- **Visibility score weights** are snapshotted inside each score row (ADR-0005).
- Design handoff PDFs remain in repo root; runtime code is under `apps/`.

## Commands

| Command | Action |
|---------|--------|
| `npm run dev:api` | Nest watch on :4000 |
| `npm run dev:web` | Next on :3000 |
| `npm run prisma:seed` | Seed platforms + demo org |
| `docker compose up -d postgres redis` | Data plane only |

## Alerts

After each scan, Answerspot evaluates:

| Type | Trigger |
|------|---------|
| `SCORE_DROP` | Score falls by ≥ `SCORE_DROP_THRESHOLD` (default 5) |
| `SENTIMENT_NEGATIVE` | Negative AI descriptions in last 2h (max 1/day) |
| `COMPETITOR_OVERTAKE` | Open HIGH/CRITICAL competitor rec (max 1/day) |

Delivery: **Resend** when `RESEND_API_KEY` is set; otherwise **console stub** (still stored in DB).

```
GET /api/v1/alerts
GET /api/v1/alerts/business/:businessId
```

## Billing (M6)

| Tier | Limits |
|------|--------|
| **Free** | 1 business · 1 scan run (first insight) |
| **Starter+** | Unlimited rescans · multi-business · 14-day trial |

- `POST /api/v1/billing/checkout` → Stripe Checkout (or mock URL when keys missing)
- `POST /api/v1/billing/mock-activate` → local trial without Stripe
- `POST /api/v1/webhooks/stripe` → subscription lifecycle
- Auth tokens: `demo` = unlimited demo org · `free` = paywalled free tier

```powershell
# After free scan is used, free-tier re-scan returns 403 PAYWALL_RESCAN
# Activate trial (no Stripe keys):
# POST /billing/mock-activate  { "plan": "STARTER" }
```

## Live AI scans

| Env | Effect |
|-----|--------|
| `SCAN_MODE=auto` (default) | Live when keys present; stub otherwise |
| `PERPLEXITY_API_KEY` | Real Perplexity Sonar answers for PERPLEXITY platform |
| `OPENAI_API_KEY` | Real ChatGPT-path answers for CHATGPT platform |
| `GEMINI_API_KEY` | Real Gemini answers for GEMINI platform |

Without keys the product still demos end-to-end via the deterministic stub.

```powershell
# .env
PERPLEXITY_API_KEY=pplx-your-key
SCAN_MODE=auto
```

Then **Re-run scan** on a business dashboard, or re-onboard.

## Status (2026-07-11 DevOps build)

- Monorepo + M1/M2 core loop (onboard → scan → score → recs)
- Live Perplexity/OpenAI/Gemini adapters with stub fallback
- Answer Explorer + Competitor Radar + Re-run scan
- JWT demo auth; seed for empty-state demos
