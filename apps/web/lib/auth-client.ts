const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export function setSessionCookie(accessToken: string) {
  document.cookie = `session=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function getSessionToken(): string | null {
  const m = document.cookie.match(/(?:^|; )session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function exchangeToken(
  token: string,
  provider?: string,
): Promise<{ accessToken: string; user?: unknown }> {
  const res = await fetch(`${API}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, provider }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.message ||
        (Array.isArray(data.message) ? data.message.join(', ') : null) ||
        `Auth failed (${res.status})`,
    );
  }
  return data;
}

export async function acceptInvite(token: string): Promise<void> {
  const session = getSessionToken();
  if (!session) throw new Error('Not signed in');
  const res = await fetch(`${API}/org/invites/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session}`,
    },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Invite accept failed');
}

/** Load Clerk browser SDK from CDN when publishable key is set. */
export function clerkPublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || undefined;
}

declare global {
  interface Window {
    Clerk?: any;
  }
}

export async function loadClerk(): Promise<any | null> {
  const key = clerkPublishableKey();
  if (!key || typeof window === 'undefined') return null;
  if (window.Clerk) {
    if (!window.Clerk.loaded) await window.Clerk.load();
    return window.Clerk;
  }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Clerk SDK'));
    document.head.appendChild(s);
  });
  // Clerk UMD may attach constructor on window.Clerk
  const ClerkCtor = window.Clerk as any;
  if (!ClerkCtor) return null;
  const clerk =
    typeof ClerkCtor === 'function' ? new ClerkCtor(key) : ClerkCtor;
  if (typeof clerk.load === 'function') await clerk.load({ publishableKey: key });
  window.Clerk = clerk;
  return clerk;
}
