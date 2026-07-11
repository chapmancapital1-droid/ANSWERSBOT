import { Module } from '@nestjs/common';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({ controllers: [ScansController], providers: [ScansService, PrismaService] })
export class ScansModule {}
