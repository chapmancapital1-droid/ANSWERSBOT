# Answerspot production deploy

## 1. Prerequisites
- Docker + Compose v2
- Domain + TLS (Caddy, nginx, or cloud LB)
- Secrets in `.env.prod` (never commit)

## 2. Minimal `.env.prod`

```env
NODE_ENV=production
JWT_SECRET=<32+ random bytes>
DATABASE_URL=postgres://answerspot:<pw>@postgres:5432/answerspot
POSTGRES_PASSWORD=<pw>
REDIS_URL=redis://redis:6379
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
WEB_ORIGIN=https://app.example.com
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_APP_URL=https://app.example.com
ALLOW_DEV_AUTH=false
ALLOW_MOCK_BILLING=false
RUN_MIGRATIONS=true
RUN_SEED=false

# IdP (pick one)
CLERK_ISSUER=https://xxx.clerk.accounts.dev
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
# or AUTH_SECRET=...

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...

S3_ENDPOINT=http://minio:9000
S3_BUCKET=answerspot
S3_KEY=answerspot
S3_SECRET=<pw>
SENTRY_DSN=
```

## 3. Launch

```powershell
cd D:\GITHUBCLONES\ANSWERSBOT
copy .env.example .env.prod
# edit secrets
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

API entrypoint runs `prisma migrate deploy` when `RUN_MIGRATIONS=true`.

Health:

| Check | URL |
|-------|-----|
| Liveness | `GET /api/v1/health` |
| Readiness (DB) | `GET /api/v1/health/ready` |
| Web | `GET /` |

## 4. Stripe webhooks
Point Stripe to `https://api.example.com/api/v1/webhooks/stripe`.

## 5. Celery dual-path
Set `SCAN_WORKER=celery` on API once workers are healthy.

## 6. Local vs prod compose
| File | Use |
|------|-----|
| `docker-compose.yml` | Dev (hot reload, published DB ports) |
| `docker-compose.prod.yml` | Prod images, migrate-on-boot, no dev auth |
