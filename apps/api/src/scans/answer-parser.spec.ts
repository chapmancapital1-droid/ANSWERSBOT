import { describe, it, expect } from 'vitest';
import { parseAnswer } from './answer-parser';

describe('parseAnswer', () => {
  it('detects mention and rank', () => {
    const text = `
When looking for roofers:
1. Lone Star HVAC — great local team
2. Precision Pros — another option
`;
    const p = parseAnswer({ text, businessName: 'Lone Star HVAC' });
    expect(p.mentioned).toBe(true);
    expect(p.rankPosition).toBe(1);
    expect(p.competitors.some((c) => /Precision/i.test(c.name))).toBe(true);
  });

  it('handles absence', () => {
    const p = parseAnswer({
      text: '1. Other Co\n2. Cityline Services',
      businessName: 'Missing Biz',
    });
    expect(p.mentioned).toBe(false);
    expect(p.rankPosition).toBeNull();
  });
});
