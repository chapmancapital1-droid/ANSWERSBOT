import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}
  async generate(_businessId: string, _format?: string) {
    // TODO(M7): build white-label PDF/link report (Agency tier).
    return { status: 'not_implemented' };
  }
}
