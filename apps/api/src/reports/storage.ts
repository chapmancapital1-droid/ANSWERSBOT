import { Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const log = new Logger('ReportStorage');

export function s3Configured(): boolean {
  const ep = process.env.S3_ENDPOINT;
  const key = process.env.S3_KEY || process.env.S3_ACCESS_KEY;
  const secret = process.env.S3_SECRET || process.env.S3_SECRET_KEY;
  return Boolean(ep && key && secret && !String(key).includes('...'));
}

/**
 * Upload bytes to MinIO/S3 via AWS SigV4 using fetch + crypto (no SDK).
 * Falls back to local filesystem under .data/reports when S3 unset.
 */
export async function putReportObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ url: string; storageKey: string; mode: 's3' | 'local' }> {
  if (!s3Configured()) {
    const dir = join(process.cwd(), '.data', 'reports');
    await mkdir(dir, { recursive: true });
    const safe = key.replace(/[\\/]/g, '_');
    const path = join(dir, safe);
    await writeFile(path, body);
    log.log(`local report write ${path}`);
    return {
      storageKey: key,
      url: `file://${path}`,
      mode: 'local',
    };
  }

  const endpoint = (process.env.S3_ENDPOINT || '').replace(/\/$/, '');
  const bucket = process.env.S3_BUCKET || 'answerspot';
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKey = process.env.S3_KEY || process.env.S3_ACCESS_KEY || '';
  const secretKey = process.env.S3_SECRET || process.env.S3_SECRET_KEY || '';

  // Prefer AWS SDK if present; otherwise use unsigned local MinIO-compatible path PUT
  // with path-style URL. For MinIO in docker without auth complexity we use
  // the AWS SDK dynamic import.
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const url = `${endpoint}/${bucket}/${key}`;
    return { storageKey: key, url, mode: 's3' };
  } catch (e: any) {
    log.warn(`S3 put failed (${e?.message}) — local fallback`);
    const dir = join(process.cwd(), '.data', 'reports');
    await mkdir(dir, { recursive: true });
    const safe = key.replace(/[\\/]/g, '_');
    const path = join(dir, safe);
    await writeFile(path, body);
    return { storageKey: key, url: `file://${path}`, mode: 'local' };
  }
}
