import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueriesService {
  constructor(private prisma: PrismaService) {}

  create(businessId: string, body: { queryText: string; location?: string }) {
    return this.prisma.trackedQuery.create({ data: { businessId, ...body } });
  }

  list(businessId: string) {
    return this.prisma.trackedQuery.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    organizationId: string,
    id: string,
    body: { isActive?: boolean; queryText?: string },
  ) {
    const existing = await this.prisma.trackedQuery.findFirst({
      where: { id, business: { organizationId, deletedAt: null } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Query not found');
    return this.prisma.trackedQuery.update({ where: { id }, data: body });
  }

  async results(
    organizationId: string,
    trackedQueryId: string,
    _opts: { platform?: string; range?: string },
  ) {
    const q = await this.prisma.trackedQuery.findFirst({
      where: {
        id: trackedQueryId,
        business: { organizationId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!q) throw new NotFoundException('Query not found');
    return this.prisma.scan.findMany({
      where: { trackedQueryId },
      include: { results: true, platform: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }
}
