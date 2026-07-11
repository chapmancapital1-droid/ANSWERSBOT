import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScansModule } from '../scans/scans.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [ScansModule, BillingModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, PrismaService],
})
export class BusinessesModule {}

