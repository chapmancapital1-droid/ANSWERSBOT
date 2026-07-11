# ADR-0001 — Production identity (Clerk / Auth.js)

## Status
Accepted (P3)

## Context
MVP used `demo` / `free` JWT mint tokens. Production needs a real IdP without rewriting the Nest JWT authorization model.

## Decision
1. Keep **app-issued JWTs** for API authorization (`Authorization: Bearer`).
2. `POST /api/v1/auth/session` accepts either:
   - Dev tokens (`demo`, `free`) when `ALLOW_DEV_AUTH` allows, or
   - External IdP JWT (`provider: clerk | authjs`) which is verified then exchanged for an app JWT.
3. **Clerk:** verify RS256 via JWKS (`CLERK_ISSUER` or `CLERK_JWKS_URL`).
4. **Auth.js / NextAuth:** verify HS256 with `AUTH_SECRET` / `NEXTAUTH_SECRET`.
5. First login upserts User + Organization + Membership; pending `OrgInvite` rows auto-apply by email.

## Consequences
- Web can use Clerk/Auth.js session, then exchange once for Answerspot API token (cookie `session=`).
- No Passport-Clerk strategy required on every request.
- Dev tokens remain for local demos; fail closed in production.
