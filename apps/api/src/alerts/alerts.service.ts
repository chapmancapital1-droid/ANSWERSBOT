import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sendAlertEmail } from './mailer';

const DROP_THRESHOLD = Number(process.env.SCORE_DROP_THRESHOLD || 5);

@Injectable()
export class AlertsService {
  private readonly log = new Logger(AlertsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Called after a new VisibilityScore is written.
   * Compares to the previous score and fans out EMAIL alerts.
   */
  async evaluateAfterScan(businessId: string, newScore: number) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        organization: {
          include: {
            users: { where: { role: { in: ['OWNER', 'ADMIN'] } }, take: 5 },
          },
        },
      },
    });
    if (!business) return { alerts: 0 };

    const previous = await this.prisma.visibilityScore.findMany({
      where: { businessId },
      orderBy: { computedAt: 'desc' },
      take: 2,
    });
    // [0] is the one just written; [1] is prior
    const prior = previous[1];

    const fired: string[] = [];

    if (prior && newScore <= prior.score - DROP_THRESHOLD) {
      const delta = prior.score - newScore;
      await this.fire({
        businessId,
        type: 'SCORE_DROP',
        channel: 'EMAIL',
        payload: {
          businessName: business.name,
          previousScore: prior.score,
          newScore,
          delta,
          threshold: DROP_THRESHOLD,
        },
        subject: `Answerspot: ${business.name} score dropped ${delta} pts → ${newScore}`,
        body:
          `Visibility Score for ${business.name} dropped from ${prior.score} to ${newScore} (−${delta}).\n\n` +
          `Open your dashboard to see which queries moved and what to fix.\n` +
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/businesses/${businessId}\n`,
        recipients: business.organization.users.map((u) => u.email),
      });
      fired.push('SCORE_DROP');
    }

    // Negative sentiment on any recent result
    const neg = await this.prisma.scanResult.count({
      where: {
        sentiment: 'NEGATIVE',
        createdAt: { gte: new Date(Date.now() - 2 * 3600e3) },
        scan: { trackedQuery: { businessId } },
      },
    });
    if (neg > 0) {
      // de-dupe: only one SENTIMENT_NEGATIVE per 24h
      const recent = await this.prisma.alert.findFirst({
        where: {
          businessId,
          type: 'SENTIMENT_NEGATIVE',
          createdAt: { gte: new Date(Date.now() - 24 * 3600e3) },
        },
      });
      if (!recent) {
        await this.fire({
          businessId,
          type: 'SENTIMENT_NEGATIVE',
          channel: 'EMAIL',
          payload: { businessName: business.name, negativeResults: neg },
          subject: `Answerspot: negative AI sentiment for ${business.name}`,
          body:
            `We detected ${neg} negative AI description(s) for ${business.name} in the latest scan window.\n` +
            `Review Answer Explorer and reputation signals.\n` +
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/businesses/${businessId}/answers\n`,
          recipients: business.organization.users.map((u) => u.email),
        });
        fired.push('SENTIMENT_NEGATIVE');
      }
    }

    // Competitor overtake from open CRITICAL/HIGH COMPETITOR_OVERTAKE rec
    const overtake = await this.prisma.recommendation.findFirst({
      where: {
        businessId,
        status: 'OPEN',
        type: 'COMPETITOR_OVERTAKE',
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (overtake) {
      const recent = await this.prisma.alert.findFirst({
        where: {
          businessId,
          type: 'COMPETITOR_OVERTAKE',
          createdAt: { gte: new Date(Date.now() - 24 * 3600e3) },
        },
      });
      if (!recent) {
        await this.fire({
          businessId,
          type: 'COMPETITOR_OVERTAKE',
          channel: 'EMAIL',
          payload: {
            businessName: business.name,
            title: overtake.title,
            message: overtake.message,
          },
          subject: `Answerspot: ${overtake.title}`,
          body: `${overtake.message}\n\n${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/businesses/${businessId}\n`,
          recipients: business.organization.users.map((u) => u.email),
        });
        fired.push('COMPETITOR_OVERTAKE');
      }
    }

    return { alerts: fired.length, types: fired };
  }

  private async fire(opts: {
    businessId: string;
    type: 'SCORE_DROP' | 'COMPETITOR_OVERTAKE' | 'SENTIMENT_NEGATIVE' | 'SCAN_FAILED';
    channel: 'EMAIL' | 'SMS';
    payload: Record<string, unknown>;
    subject: string;
    body: string;
    recipients: string[];
  }) {
    const alert = await this.prisma.alert.create({
      data: {
        businessId: opts.businessId,
        type: opts.type,
        channel: opts.channel,
        payload: opts.payload as object,
      },
    });

    if (opts.channel === 'EMAIL') {
      const extra = process.env.ALERT_EMAIL_TO;
      const to = [
        ...opts.recipients,
        ...(extra ? extra.split(',').map((s) => s.trim()) : []),
      ].filter(Boolean);
      const result = await sendAlertEmail({
        to,
        subject: opts.subject,
        text: opts.body,
      });
      if (result.ok) {
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { sentAt: new Date() },
        });
      } else {
        this.log.warn(`alert email failed: ${result.error}`);
      }
      this.log.log(
        `alert ${opts.type} business=${opts.businessId} email=${result.mode} ok=${result.ok}`,
      );
    }

    return alert;
  }

  async listForBusiness(businessId: string, organizationId: string) {
    const biz = await this.prisma.business.findFirst({
      where: { id: businessId, organizationId, deletedAt: null },
    });
    if (!biz) throw new NotFoundException();
    return this.prisma.alert.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listForOrg(organizationId: string) {
    return this.prisma.alert.findMany({
      where: { business: { organizationId, deletedAt: null } },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
