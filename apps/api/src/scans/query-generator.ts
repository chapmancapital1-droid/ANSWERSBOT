/** Auto-generate high-intent local-service queries from business profile. */

export function generateQueries(input: {
  name: string;
  category: string;
  city: string;
  state?: string;
}): string[] {
  const category = (input.category || 'service').toLowerCase();
  const city = input.city.trim();
  const near = `${city}${input.state ? `, ${input.state}` : ''}`;

  const templates = [
    `best ${category} in ${city}`,
    `best ${category} near me ${city}`,
    `${category} ${city}`,
    `top rated ${category} ${city}`,
    `emergency ${category} ${city}`,
    `affordable ${category} ${city}`,
    `${category} near ${city}`,
    `who is the best ${category} in ${near}`,
    `${category} recommendations ${city}`,
    `licensed ${category} ${city}`,
    `same day ${category} ${city}`,
    `${category} reviews ${city}`,
  ];

  // Category-specific extras
  if (/roof/.test(category)) {
    templates.push(
      `metal roofing ${city}`,
      `roof repair ${city}`,
      `emergency roof repair ${city}`,
    );
  } else if (/hvac|plumb|electric/.test(category)) {
    templates.push(
      `24 hour ${category} ${city}`,
      `${category} installation ${city}`,
    );
  } else if (/dent|ortho|chiro/.test(category)) {
    templates.push(
      `${category} accepting new patients ${city}`,
      `family ${category} ${city}`,
    );
  }

  // Dedupe, cap at 12 for Starter-friendly scans
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of templates) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}
