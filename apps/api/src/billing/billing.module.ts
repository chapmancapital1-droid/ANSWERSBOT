import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, EntitlementsService, PrismaService],
  exports: [BillingService, EntitlementsService],
})
export class BillingModule {}
