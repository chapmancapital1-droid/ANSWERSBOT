import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string; organizationId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER'; email: string;
}
export const CurrentUser = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
