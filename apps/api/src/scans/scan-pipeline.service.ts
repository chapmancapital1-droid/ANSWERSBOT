import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateRecommendations } from './recommendations-engine';
import type { BusinessSignals, QuerySignal } from './scoring';
import {
  fetchPlatformAnswer,
  platformCapabilities,
} from './platform-clients';

/**
 * M2 in-process scan pipeline (no Celery required for local MVP).
 * Live Perplexity/OpenAI/Gemini when keys present; deterministic stub otherwise.
 */
@Injectable()
export class ScanPipelineService {
  private readonly log = new Logger(ScanPipelineService.name);

  constructor(private prisma: PrismaService) {}

  async runForBusiness(businessId: string, opts?: { platformKeys?: string[] }) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { trackedQueries: { where: { isActive: true } } },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (!business.trackedQueries.length) {
      return { businessId, scans: 0, message: 'No active queries' };
    }

    const platforms = await this.prisma.platform.findMany({
      where: {
        enabled: true,
        AND: [
          { key: { not: 'AI_OVERVIEW' } },
          ...(opts?.platformKeys?.length
            ? [{ key: { in: opts.platformKeys as any } }]
            : []),
        ],
      },
    });

    const caps = platformCapabilities();
    let created = 0;
    let live = 0;
    let stub = 0;

    // Optional throttle for live APIs (ms between calls)
    const delayMs = Number(process.env.SCAN_LIVE_DELAY_MS || 400);

    for (const q of business.trackedQueries) {
      for (const platform of platforms) {
        const scan = await this.prisma.scan.create({
          data: {
            trackedQueryId: q.id,
            platformId: platform.id,
            status: 'RUNNING',
            samples: 1,
            runAt: new Date(),
          },
        });
        try {
          const answer = await fetchPlatformAnswer({
            platformKey: platform.key,
            queryText: q.queryText,
            businessName: business.name,
            category: business.category,
            city: business.city,
            location: q.location,
          });

          if (answer.source === 'live') live++;
          else stub++;

          await this.prisma.scanResult.create({
            data: {
              scanId: scan.id,
              rawResponse: answer.text,
              mentioned: answer.mentioned,
              rankPosition: answer.rankPosition,
              sentiment: answer.sentiment,
              confidence: answer.confidence,
              citations: answer.citations,
              competitors: answer.competitors,
            },
          });
          await this.prisma.scan.update({
            where: { id: scan.id },
            data: { status: 'DONE' },
          });
          created++;

          if (answer.source === 'live' && delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        } catch (err: any) {
          this.log.error(`scan failed ${scan.id}: ${err?.message}`);
          await this.prisma.scan.update({
            where: { id: scan.id },
            data: { status: 'FAILED', error: String(err?.message || err) },
          });
        }
      }
    }

    const insights = await this.recomputeInsights(businessId);
    return {
      businessId,
      scansCompleted: created,
      live,
      stub,
      capabilities: caps,
      platforms: platforms.map((p) => p.key),
      queries: business.trackedQueries.length,
      score: insights.score,
      recommendations: insights.recommendationCount,
    };
  }

  async recomputeInsights(businessId: string) {
    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
    });

    // Latest result per (query, platform) → aggregate to query-level signal
    const queries = await this.prisma.trackedQuery.findMany({
      where: { businessId, isActive: true },
      include: {
        scans: {
          where: { status: 'DONE' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { results: true, platform: true },
        },
      },
    });

    const signals: BusinessSignals = {
      businessName: business.name,
      category: business.category,
      city: business.city,
      queries: queries.map((q): QuerySignal => {
        const results = q.scans.flatMap((s) => s.results);
        if (!results.length) {
          return {
            queryText: q.queryText,
            mentioned: false,
            rankPosition: null,
            competitors: [],
            hasCitationsForYou: false,
            sentiment: 'UNKNOWN',
          };
        }
        const mentioned = results.some((r) => r.mentioned);
        const ranks = results
          .map((r) => r.rankPosition)
          .filter((r): r is number => r != null);
        const rankPosition = ranks.length
          ? Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length)
          : null;
        const comps = new Set<string>();
        for (const r of results) {
          const arr = (r.competitors as any[]) || [];
          for (const c of arr) {
            if (c?.name) comps.add(String(c.name));
          }
        }
        let hasCitationsForYou = false;
        for (const r of results) {
          if (!r.mentioned) continue;
          const cites = (r.citations as any[]) || [];
          if (
            cites.some((c) =>
              String(c?.title || c?.url || '')
                .toLowerCase()
                .includes(business.name.toLowerCase().split(' ')[0]),
            )
          ) {
            hasCitationsForYou = true;
          }
        }
        // majority sentiment among mentioned, else first
        const sentiments = results.map((r) => r.sentiment);
        const sentiment =
          sentiments.find((s) => s === 'NEGATIVE') ||
          sentiments.find((s) => s === 'POSITIVE') ||
          sentiments[0] ||
          'UNKNOWN';

        return {
          queryText: q.queryText,
          mentioned,
          rankPosition,
          competitors: [...comps],
          hasCitationsForYou,
          sentiment,
        };
      }),
    };

    const { score, recommendations } = generateRecommendations(signals);

    await this.prisma.visibilityScore.create({
      data: {
        businessId,
        score: score.score,
        breakdown: score.breakdown,
      },
    });

    // Replace OPEN recommendations for this business
    await this.prisma.recommendation.updateMany({
      where: { businessId, status: 'OPEN' },
      data: { status: 'DISMISSED' },
    });
    if (recommendations.length) {
      await this.prisma.recommendation.createMany({
        data: recommendations.map((r) => ({
          businessId,
          type: r.type,
          severity: r.severity,
          title: r.title,
          message: r.message,
          artifact: r.artifact ?? undefined,
          status: 'OPEN' as const,
        })),
      });
    }

    return { score: score.score, recommendationCount: recommendations.length };
  }
}
