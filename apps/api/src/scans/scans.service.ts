import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScansService {
  constructor(private prisma: PrismaService) {}
  async trigger(body: { trackedQueryId: string; platformKeys?: string[] }) {
    // TODO(M2): rate-limit, create Scan rows (QUEUED), enqueue scan.run.
    return { queued: true, trackedQueryId: body.trackedQueryId };
  }
  get(id: string) { return this.prisma.scan.findUnique({ where: { id }, include: { results: true } }); }
}
