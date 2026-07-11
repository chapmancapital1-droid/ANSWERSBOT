import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  authjsConfigured,
  clerkConfigured,
  verifyIdpToken,
  type IdpIdentity,
} from './idp';

/**
 * Auth exchange:
 * - Dev: demo / free tokens (gated by ALLOW_DEV_AUTH)
 * - Prod: Clerk or Auth.js JWT → upsert user → mint app JWT
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  private devAuthAllowed(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return process.env.ALLOW_DEV_AUTH === 'true';
    }
    return process.env.ALLOW_DEV_AUTH !== 'false';
  }

  async exchange(body: { token: string; provider?: string }) {
    const token = (body.token || '').trim();
    if (!token) throw new BadRequestException('token required');

    const isDevToken =
      token === 'demo' ||
      token === 'dev' ||
      token === 'free' ||
      token.startsWith('free:');

    if (isDevToken) {
      if (!this.devAuthAllowed()) {
        throw new UnauthorizedException(
          'Dev auth tokens are disabled. Set ALLOW_DEV_AUTH=true only for controlled environments.',
        );
      }
      if (token === 'demo' || token === 'dev') return this.mintDemoToken();
      const email =
        token === 'free'
          ? `free_${Date.now()}@trial.answerspot.local`
          : token.slice(5);
      return this.mintFreeToken(email);
    }

    // Production / real IdP path
    try {
      const identity = await verifyIdpToken(token, body.provider);
      return this.mintFromIdp(identity);
    } catch (e: any) {
      throw new UnauthorizedException(
        e?.message ||
          'Invalid IdP token. Configure Clerk (CLERK_ISSUER) or Auth.js (AUTH_SECRET).',
      );
    }
  }

  async mintFromIdp(identity: IdpIdentity) {
    const email = identity.email.toLowerCase().trim();
    const authProviderId = `${identity.provider}:${identity.subject}`;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ authProviderId }, { email }],
      },
    });

    if (!user) {
      const org = await this.prisma.organization.create({
        data: {
          name: `${email.split('@')[0]}'s Workspace`,
          plan: 'STARTER',
          status: 'TRIALING',
        },
      });
      user = await this.prisma.user.create({
        data: {
          organizationId: org.id,
          email,
          name: identity.name || email.split('@')[0],
          role: 'OWNER',
          authProviderId,
        },
      });
      await this.prisma.membership.create({
        data: { userId: user.id, organizationId: org.id, role: 'OWNER' },
      });
    } else if (!user.authProviderId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { authProviderId, name: identity.name || user.name },
      });
    }

    // Accept pending invite for this email (multi-seat join)
    await this.acceptPendingInvites(user.id, email);

    return this.signForUser(user, { provider: identity.provider });
  }

  private async acceptPendingInvites(userId: string, email: string) {
    const invites = await this.prisma.orgInvite.findMany({
      where: {
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    for (const inv of invites) {
      await this.prisma.membership.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId: inv.organizationId,
          },
        },
        update: { role: inv.role },
        create: {
          userId,
          organizationId: inv.organizationId,
          role: inv.role,
        },
      });
      // Switch active org to invited agency workspace
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          organizationId: inv.organizationId,
          role: inv.role,
        },
      });
      await this.prisma.orgInvite.update({
        where: { id: inv.id },
        data: { acceptedAt: new Date() },
      });
    }
  }

  private async signForUser(
    user: {
      id: string;
      email: string;
      organizationId: string;
      role: string;
    },
    extra?: Record<string, string>,
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      ...extra,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        ...extra,
      },
    };
  }

  async mintFreeToken(email: string) {
    const normalized = email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (!user) {
      const org = await this.prisma.organization.create({
        data: {
          name: `${normalized.split('@')[0]}'s Business`,
          plan: 'STARTER',
          status: 'TRIALING',
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
    const signed = await this.signForUser(user);
    return { ...signed, user: { ...signed.user, tier: 'free' } };
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
      where: {
        organizationId: org.id,
        email: 'owner@demo.answerspot.local',
      },
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
          userId_organizationId: {
            userId: user.id,
            organizationId: org.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          organizationId: org.id,
          role: 'OWNER',
        },
      });
    }

    return this.signForUser(user);
  }

  async me(user: AuthUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        organization: {
          select: { id: true, name: true, plan: true, status: true },
        },
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true, plan: true },
            },
          },
        },
      },
    });
    return {
      ...row,
      idp: {
        clerk: clerkConfigured(),
        authjs: authjsConfigured(),
        devAuth: this.devAuthAllowed(),
      },
    };
  }

  /** Switch active organization (multi-seat / agency). */
  async switchOrg(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (!membership) {
      throw new UnauthorizedException('Not a member of that organization');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        organizationId,
        role: membership.role,
      },
    });
    return this.signForUser(user);
  }
}
