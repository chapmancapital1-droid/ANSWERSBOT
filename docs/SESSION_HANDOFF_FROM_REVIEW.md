# Session handoff — codebase review (2026-07-11)

**From:** Grok review session `019f4fb1-454b-76b2-ab5e-888a63d3e66e`  
**Back to:** Working session 1 `019f4be8-6ab1-7190-8983-554e3c788f1a`  
**Repo:** `D:\GITHUBCLONES\ANSWERSBOT` (Answerspot / ANSWERSBOT)  
**Prior HEAD:** `de2b91a` — Stripe trial paywall (M6)  
**P0 security ship:** completed 2026-07-11 (this resume session)

| P0 item | Status |
|---------|--------|
| Org-scope scan reads (IDOR) | Done |
| Query update/results tenant join | Done |
| Gate demo/free auth in production | Done (`ALLOW_DEV_AUTH`) |
| Kill mock billing in production | Done |
| Require Stripe webhook secret in prod | Done |
| Client Bearer JWT from session cookie | Done |
| Vitest unit tests + CI fails on red | Done |

**Next:** P1 async scans + real Stripe portal — not new feature sprawl.

---

## Where you left off

Built bootable monorepo through M6:

| Milestone | Status |
|-----------|--------|
| M0 scaffold, health, JWT demo auth | Done |
| M1 onboard + auto queries | Done |
| M2 in-process scan + score + recs | Done |
| Live Perplexity/OpenAI/Gemini adapters | Done |
| M6 Stripe trial paywall + free-tier gates | Done |
| Celery workers path | Scaffold only — **not wired to API** |
| Real IdP (Clerk/Auth.js) | ADR-0001 TODO |
| Alerts, AI Overview, S3 reports | Schema/stubs only |

Core loop works: login demo → onboard → multi-platform scan → score/recs → free paywall → Stripe checkout (or mock).

---

## Strengths (keep)

1. Clean monorepo: `apps/web`, `apps/api`, `apps/workers`, `packages/shared-types`.
2. Prisma model matches product (orgs, businesses, scans, scores, recs, subs).
3. Scan pipeline with live/stub/auto mode + per-platform fallback is solid MVP design.
4. Entitlements service is a good single place for paywall rules.
5. OrgScopeGuard on businesses controller is the right multi-tenant pattern.
6. Stripe signature verification + timestamp skew check (when secret set).
7. README / `.env.example` are usable for local boot.

---

## Critical issues (P0 — fix before more features)

### 1. IDOR / missing tenant checks on reads

`OrgScopeGuard` only applies when route params include `businessId` or `id` **and** the controller uses the guard.

- `BusinessesController` uses guard → `GET :id` OK via guard.
- `ScansController` has **no** `OrgScopeGuard`.
  - `listForBusiness(businessId)` — any authenticated user can list another org’s scans.
  - `get(id)` — any authenticated user can read any scan + raw LLM responses by ID.
- `ScansService.trigger` does tenant-check; reads do not.

**Fix:** Apply `OrgScopeGuard` (or explicit org join) on all scan list/get paths. Never return scan/results without `trackedQuery.business.organizationId === user.organizationId`.

### 2. Web client auth gap

`apps/web/lib/api.ts` only injects `Authorization` from cookies on the **server**. Client components call `apiFetch` with empty auth headers (cookie is sent as cookie, but API expects Bearer JWT).

Login sets `document.cookie = session=...` but API is Nest JWT Bearer — cookie alone does not authenticate unless you add cookie strategy.

**Fix (pick one):**
- A) Client: read `session` cookie / `localStorage` and set `Authorization: Bearer …` in `apiFetch`.
- B) API: accept session cookie as well as Bearer.
- C) All data fetches via Next.js server components/route handlers that attach Bearer.

Onboard / rescan / dashboard client pages need verification end-to-end after fix.

### 3. Dev auth is production-lethal if left open

`AuthService.exchange` accepts `demo` / `dev` / `free` forever. No `NODE_ENV` gate.

**Fix:** Gate mint endpoints: only when `NODE_ENV !== 'production'` OR explicit `ALLOW_DEV_AUTH=true`. Fail closed in prod.

### 4. Mock billing path

`POST /billing/mock-activate` only blocked if `production && stripeConfigured`. If Stripe keys missing in prod, mock still works → free paid access.

**Fix:** Disable mock-activate entirely unless `ALLOW_MOCK_BILLING=true` and not production.

### 5. Stripe webhook unsigned in dev-shaped prod

If `STRIPE_WEBHOOK_SECRET` unset/placeholder, webhooks are accepted unsigned.

**Fix:** In production, require secret; reject unsigned. Never log full event payloads with PII.

### 6. Tests are not real

- `apps/api` `test` script: `echo "no api unit tests yet"`.
- `answer-parser.spec.ts` lives under `test/` but imports `./answer-parser` (wrong path) and Jest/Vitest not configured.
- CI Python: `pytest -q || true` — failures ignored.

**Fix:** Wire Vitest or Jest for API; fix import; run scoring/parser/entitlements unit tests; remove `|| true` from CI.

---

## High priority (P1)

### Architecture

| Issue | Recommendation |
|-------|----------------|
| Scan pipeline is **synchronous HTTP** | Long onboard/rescan will timeout under load. Enqueue Celery (or BullMQ) job; return `scanJobId`; poll/SSE status. Workers already scaffolded — connect them. |
| Dual scoring: TS (`apps/api/src/scans/scoring.ts`) vs Python (`apps/workers`) | Single source of truth. Prefer workers for production scoring; API returns job results. Or extract shared weight config versioned (`WEIGHTS_VERSION` already exists). |
| `AI_OVERVIEW` platform disabled | Needs SERP/Google path + budget controls (`SCAN_MONTHLY_BUDGET_USD` unused). |
| In-process sequential API calls with sleep | Use concurrency limit + Redis rate limiter per platform key. |

### Product / billing

| Issue | Recommendation |
|-------|----------------|
| Free scan = any prior `DONE` count > 0 | First partial failure can burn free tier unfairly; or FAILED-only retries should be free. Count “successful scan batch” not raw DONE rows. |
| No usage metering | Track scans/month per plan for STARTER/PRO/AGENCY limits. |
| Customer portal missing | Add Stripe Billing Portal for cancel/upgrade. |
| No invoice / trial-ending emails | Wire Stripe `customer.subscription.trial_will_end` + email channel (Alert model exists). |

### Data model / integrity

| Issue | Recommendation |
|-------|----------------|
| User has both `role` and Membership.role | Pick one source of truth for RBAC. |
| Recommendations: OPEN → DISMISSED on recompute | Prefer soft versioning or keep history; don’t lose user-dismissed vs system-replaced distinction. |
| `ScanResult.rawResponse` full text in DB | Retention policy + optional S3 offload (MinIO already in compose). |
| No unique constraint on (trackedQueryId, platformId, run window) | Prevents duplicate concurrent scans. |

### Frontend

| Issue | Recommendation |
|-------|----------------|
| Design PDFs + root TSX prototypes not integrated | Wire `answerspot-dashboard-home.tsx`, answer-explorer, competitor-radar into `apps/web` or delete to avoid drift. |
| Port mismatch | Web package uses 3000; `.env.example` says 3001 for `WEB_ORIGIN` / `NEXT_PUBLIC_APP_URL`. Align. |
| No free-tier login CTA on login page | Add “Continue free (1 scan)” beside demo. |
| Error UX for paywall | Surface `code: PAYWALL_*` with upgrade CTA consistently. |

### Ops / DX

| Issue | Recommendation |
|-------|----------------|
| Docker web `NEXT_PUBLIC_API_URL: http://localhost:4000` | Browser-from-host works; server-side fetch from web container needs `http://api:4000`. Split public vs internal API URL. |
| Makefile targets use bare `docker` without Windows notes | Document PowerShell-first path (already in README). |
| No structured logging / request IDs | Add pino + correlation id middleware before Sentry. |
| Sentry/OTEL env present, unused | Wire minimal error reporting. |
| Design PDFs in repo root | Move to `docs/`; stop polluting root. |

---

## Suggested next build order (for session 1)

1. **P0 security:** org-scope all scan reads; gate demo/free auth; kill mock billing in prod; require webhook secret in prod.
2. **P0 auth client:** fix Bearer injection so web client API calls work reliably.
3. **P0 tests:** Jest/Vitest for `parseAnswer`, `computeScore`, `EntitlementsService`; CI fails on red.
4. **P1 async scans:** API enqueues worker task; UI polls status; keep sync path behind `SCAN_SYNC=true` for local demos.
5. **P1 Stripe live path:** real prices, webhook with Stripe CLI, Billing Portal, trial emails.
6. **P1 product polish:** free login, paywall banners, wire prototype dashboard components.
7. **P2:** AI Overview adapter, alerts, agency multi-seat, report PDFs to MinIO.

---

## Quick verify commands (session 1)

```powershell
cd D:\GITHUBCLONES\ANSWERSBOT
docker compose up -d postgres redis minio
npm install
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run prisma:seed
npm run dev:api   # :4000
npm run dev:web   # :3000
# smoke
# POST /api/v1/auth/session {"token":"demo"}
# POST /api/v1/auth/session {"token":"free"}  # paywall path
```

---

## Do not do next (unless user asks)

- Big redesign of monorepo layout
- Replacing Nest or Next mid-MVP
- Building marketing site chrome before auth/tenancy is solid
- Expanding to more AI platforms before async queue + metering

---

## One-line status for user

**Answerspot MVP is real and demoable (onboard → scan → score → paywall), but not multi-tenant-safe on scan reads, not production-auth-safe, and workers/tests are still scaffolding.** Next session should harden security + auth client, then async scans + real Stripe — not new feature surface.
