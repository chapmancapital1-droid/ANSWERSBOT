import { Module } from '@nestjs/common';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { ScanPipelineService } from './scan-pipeline.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ScansController],
  providers: [ScansService, ScanPipelineService, PrismaService],
  exports: [ScansService, ScanPipelineService],
})
export class ScansModule {}
