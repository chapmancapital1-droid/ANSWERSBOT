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

## Status (2026-07-11 DevOps build)

- Monorepo unpacked from design manifest + completed packages
- JWT demo auth for local development
- Web: home, login, business list, visibility dashboard + recs island
- Seed includes demo score + recommendations so UI is not empty
- Workers recommendation engine present with unit-testable scoring/rules
