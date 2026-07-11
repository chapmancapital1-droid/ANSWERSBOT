import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.organizationId) throw new ForbiddenException('No organization context');
    const businessId = req.params.businessId ?? req.params.id;
    if (!businessId) return true;
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, organizationId: user.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!business) throw new ForbiddenException('Resource not in your organization');
    req.business = business;
    return true;
  }
}
