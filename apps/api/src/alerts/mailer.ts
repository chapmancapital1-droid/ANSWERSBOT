/**
 * Outbound alert mail — Resend when RESEND_API_KEY set, else console stub.
 */

export function emailEnabled() {
  if (process.env.EMAIL_STUB === '1') return false;
  const k = process.env.RESEND_API_KEY;
  return Boolean(k && !k.includes('...') && k.length > 8);
}

export async function sendAlertEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
}): Promise<{ ok: boolean; mode: 'resend' | 'stub'; id?: string; error?: string }> {
  const to = (Array.isArray(opts.to) ? opts.to : [opts.to])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!to.length) return { ok: false, mode: 'stub', error: 'no recipients' };

  if (!emailEnabled()) {
    console.log(
      `[alert:email:stub] to=${to.join(',')} subject="${opts.subject}" chars=${opts.text.length}`,
    );
    return { ok: true, mode: 'stub', id: `stub_${Date.now()}` };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Answerspot <alerts@answerspot.local>',
        to,
        subject: opts.subject,
        text: opts.text,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        mode: 'resend',
        error: data.message || `HTTP ${res.status}`,
      };
    }
    return { ok: true, mode: 'resend', id: data.id };
  } catch (e: any) {
    return { ok: false, mode: 'resend', error: e?.message || String(e) };
  }
}
