import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({ controllers: [BusinessesController], providers: [BusinessesService, PrismaService] })
export class BusinessesModule {}
