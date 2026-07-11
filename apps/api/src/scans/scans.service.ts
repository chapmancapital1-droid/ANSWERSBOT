import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScanPipelineService } from './scan-pipeline.service';

@Injectable()
export class ScansService {
  constructor(
    private prisma: PrismaService,
    private pipeline: ScanPipelineService,
  ) {}

  async trigger(body: {
    trackedQueryId?: string;
    businessId?: string;
    platformKeys?: string[];
  }) {
    if (body.businessId) {
      return this.pipeline.runForBusiness(body.businessId, {
        platformKeys: body.platformKeys,
      });
    }
    if (!body.trackedQueryId) {
      return { error: 'trackedQueryId or businessId required' };
    }
    const q = await this.prisma.trackedQuery.findUnique({
      where: { id: body.trackedQueryId },
    });
    if (!q) throw new NotFoundException('Query not found');
    return this.pipeline.runForBusiness(q.businessId, {
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
