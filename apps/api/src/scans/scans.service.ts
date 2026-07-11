import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScanPipelineService } from './scan-pipeline.service';
import { EntitlementsService } from '../billing/entitlements.service';

@Injectable()
export class ScansService {
  private readonly log = new Logger(ScansService.name);

  constructor(
    private prisma: PrismaService,
    private pipeline: ScanPipelineService,
    private entitlements: EntitlementsService,
  ) {}

  private async assertBusinessInOrg(businessId: string, organizationId: string) {
    const biz = await this.prisma.business.findFirst({
      where: { id: businessId, organizationId, deletedAt: null },
    });
    if (!biz) throw new NotFoundException('Business not found');
    return biz;
  }

  /**
   * Trigger a business scan batch.
   * - Default: async ScanJob (returns jobId; poll GET /scans/jobs/:id)
   * - Sync when SCAN_SYNC=true or body.sync=true (local demos / onboard-like UX)
   */
  async trigger(
    organizationId: string,
    body: {
      trackedQueryId?: string;
      businessId?: string;
      platformKeys?: string[];
      sync?: boolean;
    },
  ) {
    let businessId = body.businessId;
    if (!businessId && body.trackedQueryId) {
      const q = await this.prisma.trackedQuery.findFirst({
        where: {
          id: body.trackedQueryId,
          business: { organizationId, deletedAt: null },
        },
      });
      if (!q) throw new NotFoundException('Query not found');
      businessId = q.businessId;
    }
    if (!businessId) {
      return { error: 'trackedQueryId or businessId required' };
    }

    await this.assertBusinessInOrg(businessId, organizationId);
    await this.entitlements.assertCanScan(organizationId, businessId);

    const useSync =
      body.sync === true || process.env.SCAN_SYNC === 'true';

    const job = await this.prisma.scanJob.create({
      data: {
        organizationId,
        businessId,
        status: 'QUEUED',
        platformKeys: body.platformKeys ?? Prisma.JsonNull,
      },
    });

    if (useSync) {
      return this.executeJob(job.id, businessId, body.platformKeys);
    }

    // Fire-and-forget in-process worker (no Celery required for Nest path).
    // Celery workers remain available for future dual-path production scoring.
    setImmediate(() => {
      this.executeJob(job.id, businessId!, body.platformKeys).catch((err) => {
        this.log.error(`async scan job ${job.id} failed: ${err?.message || err}`);
      });
    });

    return {
      mode: 'async' as const,
      jobId: job.id,
      status: 'QUEUED' as const,
      businessId,
      pollUrl: `/scans/jobs/${job.id}`,
    };
  }

  private async executeJob(
    jobId: string,
    businessId: string,
    platformKeys?: string[],
  ) {
    await this.prisma.scanJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    try {
      const result = await this.pipeline.runForBusiness(businessId, {
        platformKeys,
      });
      await this.prisma.scanJob.update({
        where: { id: jobId },
        data: {
          status: 'DONE',
          finishedAt: new Date(),
          result: result as object,
        },
      });
      return {
        mode: 'sync' as const,
        jobId,
        status: 'DONE' as const,
        ...result,
      };
    } catch (err: any) {
      await this.prisma.scanJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: String(err?.message || err),
        },
      });
      throw err;
    }
  }

  async getJob(organizationId: string, jobId: string) {
    const job = await this.prisma.scanJob.findFirst({
      where: { id: jobId, organizationId },
    });
    if (!job) throw new NotFoundException('Scan job not found');
    return {
      id: job.id,
      businessId: job.businessId,
      status: job.status,
      error: job.error,
      result: job.result,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
    };
  }

  async get(organizationId: string, id: string) {
    const scan = await this.prisma.scan.findFirst({
      where: {
        id,
        trackedQuery: { business: { organizationId, deletedAt: null } },
      },
      include: { results: true, platform: true, trackedQuery: true },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    return scan;
  }

  async listForBusiness(organizationId: string, businessId: string) {
    await this.assertBusinessInOrg(businessId, organizationId);
    return this.prisma.scan.findMany({
      where: {
        trackedQuery: {
          businessId,
          business: { organizationId, deletedAt: null },
        },
      },
      include: {
        results: true,
        platform: true,
        trackedQuery: { select: { id: true, queryText: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
