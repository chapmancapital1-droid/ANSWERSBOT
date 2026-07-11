import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScanPipelineService } from './scan-pipeline.service';
import { EntitlementsService } from '../billing/entitlements.service';

@Injectable()
export class ScansService {
  constructor(
    private prisma: PrismaService,
    private pipeline: ScanPipelineService,
    private entitlements: EntitlementsService,
  ) {}

  async trigger(
    organizationId: string,
    body: {
      trackedQueryId?: string;
      businessId?: string;
      platformKeys?: string[];
    },
  ) {
    let businessId = body.businessId;
    if (!businessId && body.trackedQueryId) {
      const q = await this.prisma.trackedQuery.findUnique({
        where: { id: body.trackedQueryId },
      });
      if (!q) throw new NotFoundException('Query not found');
      businessId = q.businessId;
    }
    if (!businessId) {
      return { error: 'trackedQueryId or businessId required' };
    }

    // Tenant check
    const biz = await this.prisma.business.findFirst({
      where: { id: businessId, organizationId, deletedAt: null },
    });
    if (!biz) throw new NotFoundException('Business not found');

    await this.entitlements.assertCanScan(organizationId, businessId);

    return this.pipeline.runForBusiness(businessId, {
      platformKeys: body.platformKeys,
    });
  }

  get(id: string) {
    return this.prisma.scan.findUnique({
      where: { id },
      include: { results: true, platform: true, trackedQuery: true },
    });
  }

  async listForBusiness(businessId: string) {
    return this.prisma.scan.findMany({
      where: { trackedQuery: { businessId } },
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
