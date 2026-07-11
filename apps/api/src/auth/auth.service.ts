import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * M0 auth: local JWT for development.
 * ADR-0001: replace exchange() with Clerk/Auth.js verification in production.
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async exchange(token: string) {
    // Dev bootstrap: "demo" mints a JWT for the seeded demo org owner (unlimited).
    if (token === 'demo' || token === 'dev') {
      return this.mintDemoToken();
    }
    // Free-tier org for paywall testing: token "free" or free:<email>
    if (token === 'free' || token.startsWith('free:')) {
      const email =
        token === 'free'
          ? `free_${Date.now()}@trial.answerspot.local`
          : token.slice(5);
      return this.mintFreeToken(email);
    }
    // TODO(ADR-0001): verify IdP token (Auth.js/Clerk), upsert user, mint our JWT.
    throw new UnauthorizedException(
      'Unknown token. Use "demo" (unlimited) or "free" (paywalled) in development.',
    );
  }

  async mintFreeToken(email: string) {
    const normalized = email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user) {
      const org = await this.prisma.organization.create({
        data: {
          name: `${normalized.split('@')[0]}'s Business`,
          plan: 'STARTER',
          status: 'TRIALING',
          // no stripeCustomerId → free tier
        },
      });
      user = await this.prisma.user.create({
        data: {
          organizationId: org.id,
          email: normalized,
          name: 'Free Trial User',
          role: 'OWNER',
          authProviderId: `free-${org.id}`,
        },
      });
      await this.prisma.membership.create({
        data: { userId: user.id, organizationId: org.id, role: 'OWNER' },
      });
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        tier: 'free',
      },
    };
  }

  async mintDemoToken() {
    let org = await this.prisma.organization.findFirst({
      where: { stripeCustomerId: 'demo' },
    });
    if (!org) {
      org = await this.prisma.organization.create({
        data: {
          name: 'Demo Roofing Co',
          plan: 'PRO',
          status: 'TRIALING',
          stripeCustomerId: 'demo',
        },
      });
    }

    let user = await this.prisma.user.findFirst({
      where: { organizationId: org.id, email: 'owner@demo.answerspot.local' },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          organizationId: org.id,
          email: 'owner@demo.answerspot.local',
          name: 'Demo Owner',
          role: 'OWNER',
          authProviderId: 'demo-owner',
        },
      });
      await this.prisma.membership.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: org.id },
        },
        update: {},
        create: { userId: user.id, organizationId: org.id, role: 'OWNER' },
      });
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
    });
    return { accessToken, user: { id: user.id, email: user.email, organizationId: user.organizationId } };
  }

  async me(user: AuthUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        organization: {
          select: { id: true, name: true, plan: true, status: true },
        },
      },
    });
    return row;
  }
}

