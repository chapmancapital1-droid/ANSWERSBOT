/**
 * Minimal Celery-over-Redis publisher (JSON protocol).
 * Used when SCAN_WORKER=celery so Python workers execute ScanJobs.
 */
import { createClient, type RedisClientType } from 'redis';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';

const log = new Logger('CeleryEnqueue');

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

function brokerUrl(): string | null {
  const u =
    process.env.CELERY_BROKER_URL ||
    process.env.REDIS_URL ||
    '';
  if (!u || u.includes('...')) return null;
  return u;
}

export function celeryEnabled(): boolean {
  const mode = (process.env.SCAN_WORKER || 'auto').toLowerCase();
  if (mode === 'nest' || mode === 'inline') return false;
  if (mode === 'celery') return Boolean(brokerUrl());
  // auto: only when explicitly preferred
  return process.env.SCAN_WORKER === 'celery';
}

async function getClient(): Promise<RedisClientType | null> {
  const url = brokerUrl();
  if (!url) return null;
  if (client?.isOpen) return client;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const c = createClient({ url }) as RedisClientType;
      c.on('error', (e) => log.warn(`redis: ${e.message}`));
      await c.connect();
      client = c;
      return c;
    } catch (e: any) {
      log.warn(`redis connect failed: ${e?.message || e}`);
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

/**
 * Enqueue Celery task. Returns task id or null if broker unavailable.
 */
export async function enqueueCeleryTask(
  taskName: string,
  args: unknown[],
  queue = 'runner',
): Promise<string | null> {
  const c = await getClient();
  if (!c) return null;

  const id = randomUUID();
  const body = Buffer.from(
    JSON.stringify([
      args,
      {},
      { callbacks: null, errbacks: null, chain: null, chord: null },
    ]),
  ).toString('base64');

  const message = JSON.stringify({
    body,
    'content-encoding': 'utf-8',
    'content-type': 'application/json',
    headers: {
      lang: 'py',
      task: taskName,
      id,
      shadow: null,
      eta: null,
      expires: null,
      group: null,
      group_index: null,
      retries: 0,
      timelimit: [null, null],
      root_id: id,
      parent_id: null,
      argsrepr: JSON.stringify(args),
      kwargsrepr: '{}',
      origin: 'gen1@answerspot-api',
      ignore_result: false,
      replaced_task_nesting: 0,
      stale_tocs: null,
    },
    properties: {
      correlation_id: id,
      reply_to: randomUUID().replace(/-/g, ''),
      delivery_mode: 2,
      delivery_info: { exchange: '', routing_key: queue },
      priority: 0,
      body_encoding: 'base64',
      delivery_tag: id,
    },
  });

  // Celery Redis transport: list key is the queue name
  await c.lPush(queue, message);
  log.log(`enqueued ${taskName} id=${id} queue=${queue}`);
  return id;
}

export async function enqueueScanJob(jobId: string): Promise<string | null> {
  return enqueueCeleryTask(
    'answerspot_workers.tasks.runner.run_scan_job',
    [jobId],
    'runner',
  );
}
