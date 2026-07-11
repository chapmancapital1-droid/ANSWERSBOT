import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateBusinessDto) {
    const business = await this.prisma.business.create({ data: { ...dto, organizationId } });
    // TODO(M1): enqueue query auto-generation + onboarding scan.
    return business;
  }
  async list(organizationId: string, { page, limit }: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.business.findMany({ where: { organizationId, deletedAt: null },
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.business.count({ where: { organizationId, deletedAt: null } }),
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
      this.prisma.visibilityScore.findFirst({ where: { businessId }, orderBy: { computedAt: 'desc' } }),
      this.prisma.visibilityScore.findMany({ where: { businessId }, orderBy: { computedAt: 'asc' },
        take: 90, select: { score: true, computedAt: true } }),
    ]);
    return { current, trend };
  }
  competitors(businessId: string) {
    // TODO(M5): aggregate competitors JSONB across recent scan_results.
    return this.prisma.scanResult.findMany({
      where: { scan: { trackedQuery: { businessId } } },
      select: { competitors: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
  }
  recommendations(businessId: string) {
    return this.prisma.recommendation.findMany({
      where: { businessId, status: 'OPEN' },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
