import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { BudgetService } from './budget.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    EntitlementsService,
    BudgetService,
    PrismaService,
  ],
  exports: [BillingService, EntitlementsService, BudgetService],
})
export class BillingModule {}
