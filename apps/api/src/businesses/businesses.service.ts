import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { generateQueries } from '../scans/query-generator';
import { ScanPipelineService } from '../scans/scan-pipeline.service';
import { EntitlementsService } from '../billing/entitlements.service';

@Injectable()
export class BusinessesService {
  constructor(
    private prisma: PrismaService,
    private scans: ScanPipelineService,
    private entitlements: EntitlementsService,
  ) {}

  async create(organizationId: string, dto: CreateBusinessDto) {
    await this.entitlements.assertCanCreateBusiness(organizationId);
    const business = await this.prisma.business.create({
      data: { ...dto, organizationId },
    });
    return business;
  }

  /**
   * M1 onboarding: create business, auto-generate queries, run first scan.
   */
  async onboard(
    organizationId: string,
    dto: CreateBusinessDto & { runScan?: boolean },
  ) {
    await this.entitlements.assertCanCreateBusiness(organizationId);

    const business = await this.prisma.business.create({
      data: {
        name: dto.name,
        category: dto.category,
        city: dto.city,
        state: dto.state,
        website: dto.website,
        organizationId,
      },
    });

    const texts = generateQueries({
      name: dto.name,
      category: dto.category,
      city: dto.city,
      state: dto.state,
    });

    await this.prisma.trackedQuery.createMany({
      data: texts.map((queryText) => ({
        businessId: business.id,
        queryText,
        location: `${dto.city}, ${dto.state}`,
        intent: 'high',
        isActive: true,
      })),
    });

    const queries = await this.prisma.trackedQuery.findMany({
      where: { businessId: business.id },
    });

    let scan: Awaited<ReturnType<ScanPipelineService['runForBusiness']>> | null =
      null;
    if (dto.runScan !== false) {
      // First scan is free (no prior DONE scans on this business)
      await this.entitlements.assertCanScan(organizationId, business.id);
      scan = await this.scans.runForBusiness(business.id);
    }

    return {
      business,
      queries,
      scan,
      billing: await this.entitlements.status(organizationId),
    };
  }

  async list(organizationId: string, { page, limit }: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.business.findMany({
        where: { organizationId, deletedAt: null },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.business.count({
        where: { organizationId, deletedAt: null },
      }),
    ]);
    return { data, total, page, limit };
  }

  async get(id: string) {
    const b = await this.prisma.business.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    return b;
  }

  async visibilityScore(businessId: string) {
    const [current, trend] = await Promise.all([
      this.prisma.visibilityScore.findFirst({
        where: { businessId },
        orderBy: { computedAt: 'desc' },
      }),
      this.prisma.visibilityScore.findMany({
        where: { businessId },
        orderBy: { computedAt: 'asc' },
        take: 90,
        select: { score: true, computedAt: true },
      }),
    ]);
    return { current, trend };
  }

  async competitors(businessId: string) {
    const results = await this.prisma.scanResult.findMany({
      where: { scan: { trackedQuery: { businessId } } },
      select: { competitors: true, mentioned: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    const totals = new Map<string, { appears: number; total: number }>();
    let sampleTotal = 0;
    for (const r of results) {
      sampleTotal++;
      const arr = (r.competitors as any[]) || [];
      const names = new Set(arr.map((c) => String(c?.name || '')).filter(Boolean));
      if (r.mentioned && business) names.add(business.name);
      for (const name of names) {
        const cur = totals.get(name) || { appears: 0, total: 0 };
        cur.appears += 1;
        totals.set(name, cur);
      }
    }
    for (const [, v] of totals) v.total = sampleTotal || 1;

    return [...totals.entries()]
      .map(([name, v]) => ({
        name,
        appears: v.appears,
        total: v.total,
        you: name === business?.name,
      }))
      .sort((a, b) => b.appears - a.appears)
      .slice(0, 12);
  }

  recommendations(businessId: string) {
    return this.prisma.recommendation.findMany({
      where: { businessId, status: 'OPEN' },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
