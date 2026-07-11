import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueriesService {
  constructor(private prisma: PrismaService) {}
  create(businessId: string, body: { queryText: string; location?: string }) {
    return this.prisma.trackedQuery.create({ data: { businessId, ...body } });
  }
  list(businessId: string) {
    return this.prisma.trackedQuery.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
  }
  update(id: string, body: { isActive?: boolean; queryText?: string }) {
    return this.prisma.trackedQuery.update({ where: { id }, data: body });
  }
  results(trackedQueryId: string, _opts: { platform?: string; range?: string }) {
    return this.prisma.scan.findMany({
      where: { trackedQueryId }, include: { results: true, platform: true },
      orderBy: { createdAt: 'desc' }, take: 30,
    });
  }
}
