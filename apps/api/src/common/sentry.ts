/**
 * Optional Sentry bootstrap. No-op when SENTRY_DSN unset or package missing.
 * Uses Function constructor-style dynamic import so tsc does not require @sentry/node types.
 */
import { Logger } from '@nestjs/common';

const log = new Logger('Sentry');
let ready = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentryMod: any = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || dsn.includes('...')) {
    log.log('Sentry disabled (no SENTRY_DSN)');
    return;
  }
  try {
    // Avoid static import so builds work without the optional package
    const dynImport = new Function('m', 'return import(m)') as (
      m: string,
    ) => Promise<any>;
    sentryMod = await dynImport('@sentry/node').catch(() => null);
    if (!sentryMod) {
      log.warn(
        'SENTRY_DSN set but @sentry/node not installed — npm i @sentry/node',
      );
      return;
    }
    sentryMod.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      release: process.env.SENTRY_RELEASE || 'answerspot-api@0.1.0',
    });
    ready = true;
    log.log('Sentry initialized');
  } catch (e: any) {
    log.warn(`Sentry init failed: ${e?.message}`);
  }
}

export function captureException(
  err: unknown,
  extras?: Record<string, unknown>,
) {
  if (!ready || !sentryMod) return;
  try {
    sentryMod.withScope((scope: any) => {
      if (extras) {
        for (const [k, v] of Object.entries(extras)) {
          scope.setExtra(k, v);
        }
      }
      sentryMod.captureException(err);
    });
  } catch {
    /* ignore */
  }
}

export function isSentryReady() {
  return ready;
}
