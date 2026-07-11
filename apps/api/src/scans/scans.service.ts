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

  private async assertBusinessInOrg(businessId: string, organizationId: string) {
    const biz = await this.prisma.business.findFirst({
      where: { id: businessId, organizationId, deletedAt: null },
    });
    if (!biz) throw new NotFoundException('Business not found');
    return biz;
  }

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

    return this.pipeline.runForBusiness(businessId, {
      platformKeys: body.platformKeys,
    });
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
