import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Get() liveness() { return { status: 'ok', ts: new Date().toISOString() }; }
  @Get('ready') async readiness() {
    try { await this.prisma.$queryRaw`SELECT 1`; return { status: 'ready', db: 'up' }; }
    catch { return { status: 'not-ready', db: 'down' }; }
  }
}
