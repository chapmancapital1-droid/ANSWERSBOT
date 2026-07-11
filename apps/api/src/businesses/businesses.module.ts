import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScansModule } from '../scans/scans.module';

@Module({
  imports: [ScansModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, PrismaService],
})
export class BusinessesModule {}
