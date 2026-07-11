const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const platforms = [
    { key: 'CHATGPT', displayName: 'ChatGPT' },
    { key: 'PERPLEXITY', displayName: 'Perplexity' },
    { key: 'GEMINI', displayName: 'Gemini' },
    {
      key: 'AI_OVERVIEW',
      displayName: 'Google AI Overview',
      // Enabled in DB; API still gates on ENABLE_AI_OVERVIEW + SERP_API_KEY
      enabled: true,
    },
  ];
  for (const p of platforms) {
    await prisma.platform.upsert({
      where: { key: p.key },
      update: { displayName: p.displayName, enabled: p.enabled ?? true },
      create: p,
    });
  }

  const org = await prisma.organization.upsert({
    where: { stripeCustomerId: 'demo' },
    update: {},
    create: {
      name: 'Demo Roofing Co',
      plan: 'PRO',
      status: 'TRIALING',
      stripeCustomerId: 'demo',
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'owner@demo.answerspot.local' },
    update: { organizationId: org.id, role: 'OWNER' },
    create: {
      organizationId: org.id,
      email: 'owner@demo.answerspot.local',
      name: 'Demo Owner',
      role: 'OWNER',
      authProviderId: 'demo-owner',
    },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, organizationId: org.id, role: 'OWNER' },
  });

  let business = await prisma.business.findFirst({
    where: { organizationId: org.id, name: 'Demo Roofing Co' },
  });
  if (!business) {
    business = await prisma.business.create({
      data: {
        organizationId: org.id,
        name: 'Demo Roofing Co',
        category: 'roofer',
        city: 'Austin',
        state: 'TX',
        website: 'https://example.com',
      },
    });
  }

  // Demo visibility score so the dashboard is not empty after seed
  await prisma.visibilityScore.create({
    data: {
      businessId: business.id,
      score: 58,
      breakdown: {
        appearanceRate: 0.58,
        rankScore: 0.62,
        sentimentScore: 0.7,
        citationScore: 0.4,
        weights: { w1: 0.4, w2: 0.3, w3: 0.15, w4: 0.15 },
        weightsVersion: '2026-07-10',
      },
    },
  });

  const openRecs = await prisma.recommendation.count({
    where: { businessId: business.id, status: 'OPEN' },
  });
  if (openRecs === 0) {
    await prisma.recommendation.createMany({
      data: [
        {
          businessId: business.id,
          type: 'KEYWORD_GAP',
          severity: 'HIGH',
          title: 'Get listed for "metal roofing Austin"',
          message:
            "You don't appear when customers search \"metal roofing Austin\", but 3 competitors do. Add a clear section about this service to your site so AI assistants can find it.",
          artifact: {
            kind: 'text',
            content:
              '## Metal Roofing Austin\n\nLooking for metal roofing Austin? Our Austin-based team specializes in exactly this.',
          },
          status: 'OPEN',
        },
        {
          businessId: business.id,
          type: 'CITATION_GAP',
          severity: 'HIGH',
          title: 'Add FAQ structured data to your website',
          message:
            "You're mentioned in several queries but few sources back you up. FAQ structured data helps AI assistants quote you directly.",
          artifact: {
            kind: 'code',
            content:
              '<script type="application/ld+json">{"@type":"FAQPage"}</script>',
          },
          status: 'OPEN',
        },
        {
          businessId: business.id,
          type: 'REVIEW_SIGNAL',
          severity: 'MEDIUM',
          title: 'Reply to your unanswered reviews',
          message:
            'AI assistants treat response rate as a trust signal. Replying to a few more reviews can lift how you are described.',
          artifact: {
            kind: 'text',
            content:
              'Thank you so much for the kind words! It was a pleasure helping you. - The Demo Roofing Co team',
          },
          status: 'OPEN',
        },
      ],
    });
  }

  // Sample tracked queries
  const qCount = await prisma.trackedQuery.count({ where: { businessId: business.id } });
  if (qCount === 0) {
    await prisma.trackedQuery.createMany({
      data: [
        { businessId: business.id, queryText: 'best roofer in Austin', location: 'Austin, TX' },
        { businessId: business.id, queryText: 'emergency roof repair Austin', location: 'Austin, TX' },
        { businessId: business.id, queryText: 'metal roofing Austin', location: 'Austin, TX' },
      ],
    });
  }

  console.log('Seed complete.');
  console.log('  Demo login token: demo');
  console.log('  Business id:', business.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
