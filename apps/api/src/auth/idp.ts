/**
 * IdP token verification for Clerk + Auth.js (NextAuth).
 * Verifies external JWT, returns normalized identity for app JWT minting.
 */
import { createHmac, createPublicKey, timingSafeEqual } from 'crypto';
import { Logger } from '@nestjs/common';

const log = new Logger('IdP');

export type IdpIdentity = {
  provider: 'clerk' | 'authjs';
  subject: string;
  email: string;
  name?: string;
};

type JwtHeader = { alg: string; kid?: string; typ?: string };
type JwtPayload = Record<string, unknown>;

function b64urlJson(part: string): unknown {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}

function parseJwt(token: string): { header: JwtHeader; payload: JwtPayload; signed: string; sig: Buffer } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [h, p, s] = parts;
  return {
    header: b64urlJson(h) as JwtHeader,
    payload: b64urlJson(p) as JwtPayload,
    signed: `${h}.${p}`,
    sig: Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
  };
}

function verifyHs256(signed: string, sig: Buffer, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(signed).digest();
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(expected, sig);
}

async function verifyRs256(
  signed: string,
  sig: Buffer,
  jwk: JsonWebKey,
): Promise<boolean> {
  const { createVerify } = await import('crypto');
  const key = createPublicKey({ key: jwk as any, format: 'jwk' });
  const verifier = createVerify('RSA-SHA256');
  verifier.update(signed);
  verifier.end();
  return verifier.verify(key, sig);
}

let jwksCache: { keys: any[]; fetchedAt: number; url: string } | null = null;

async function fetchJwks(url: string): Promise<any[]> {
  if (
    jwksCache &&
    jwksCache.url === url &&
    Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000
  ) {
    return jwksCache.keys;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JWKS fetch failed ${res.status}`);
  const data = await res.json();
  const keys = data.keys || [];
  jwksCache = { keys, fetchedAt: Date.now(), url };
  return keys;
}

function clerkJwksUrl(): string | null {
  if (process.env.CLERK_JWKS_URL) return process.env.CLERK_JWKS_URL;
  const issuer = process.env.CLERK_ISSUER; // e.g. https://xxx.clerk.accounts.dev
  if (issuer) return `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
  return null;
}

export function clerkConfigured(): boolean {
  return Boolean(clerkJwksUrl() || process.env.CLERK_SECRET_KEY);
}

export function authjsConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      process.env.AUTHJS_SECRET,
  );
}

/**
 * Verify Clerk session JWT (RS256 + JWKS preferred).
 */
export async function verifyClerkToken(token: string): Promise<IdpIdentity> {
  const jwksUrl = clerkJwksUrl();
  if (!jwksUrl) {
    throw new Error(
      'Clerk not configured. Set CLERK_ISSUER or CLERK_JWKS_URL.',
    );
  }
  const { header, payload, signed, sig } = parseJwt(token);
  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported Clerk alg ${header.alg}`);
  }
  const keys = await fetchJwks(jwksUrl);
  const jwk = keys.find((k) => k.kid === header.kid) || keys[0];
  if (!jwk) throw new Error('No JWKS key for Clerk token');
  const ok = await verifyRs256(signed, sig, jwk);
  if (!ok) throw new Error('Clerk signature invalid');

  const exp = Number(payload.exp || 0);
  if (exp && exp * 1000 < Date.now()) throw new Error('Clerk token expired');

  const email = String(
    payload.email ||
      (payload as any).primary_email_address ||
      payload.email_address ||
      '',
  ).toLowerCase();
  if (!email) throw new Error('Clerk token missing email');

  return {
    provider: 'clerk',
    subject: String(payload.sub || ''),
    email,
    name: payload.name ? String(payload.name) : undefined,
  };
}

/**
 * Verify Auth.js / NextAuth JWT (HS256 with AUTH_SECRET).
 */
export async function verifyAuthJsToken(token: string): Promise<IdpIdentity> {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTHJS_SECRET;
  if (!secret) throw new Error('AUTH_SECRET not configured');

  const { header, payload, signed, sig } = parseJwt(token);
  if (header.alg !== 'HS256' && header.alg !== 'HS512') {
    // Auth.js v5 may use other algs; still try HS256
    log.warn(`Auth.js alg=${header.alg}, attempting HS256 verify`);
  }
  const ok = verifyHs256(signed, sig, secret);
  if (!ok) throw new Error('Auth.js signature invalid');

  const exp = Number(payload.exp || 0);
  if (exp && exp * 1000 < Date.now()) throw new Error('Auth.js token expired');

  const email = String(payload.email || '').toLowerCase();
  if (!email) throw new Error('Auth.js token missing email');

  return {
    provider: 'authjs',
    subject: String(payload.sub || payload.id || email),
    email,
    name: payload.name ? String(payload.name) : undefined,
  };
}

/**
 * Auto-detect provider from token claims / env.
 */
export async function verifyIdpToken(
  token: string,
  providerHint?: string,
): Promise<IdpIdentity> {
  const hint = (providerHint || '').toLowerCase();
  if (hint === 'clerk') return verifyClerkToken(token);
  if (hint === 'authjs' || hint === 'nextauth') return verifyAuthJsToken(token);

  // Peek issuer
  try {
    const { payload } = parseJwt(token);
    const iss = String(payload.iss || '');
    if (iss.includes('clerk') || clerkJwksUrl()) {
      try {
        return await verifyClerkToken(token);
      } catch (e) {
        log.warn(`Clerk verify failed: ${(e as Error).message}`);
      }
    }
  } catch {
    /* fall through */
  }

  if (authjsConfigured()) {
    return verifyAuthJsToken(token);
  }
  if (clerkConfigured()) {
    return verifyClerkToken(token);
  }
  throw new Error('No IdP configured (Clerk or AUTH_SECRET)');
}
