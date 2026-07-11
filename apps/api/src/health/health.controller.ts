import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { platformCapabilities, scanMode } from '../scans/platform-clients';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Get() liveness() {
    return {
      status: 'ok',
      ts: new Date().toISOString(),
      scanMode: scanMode(),
      platforms: platformCapabilities(),
    };
  }
  @Get('ready') async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'up' };
    } catch {
      return { status: 'not-ready', db: 'down' };
    }
  }
}
