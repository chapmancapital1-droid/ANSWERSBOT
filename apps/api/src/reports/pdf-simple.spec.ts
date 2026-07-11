import { describe, it, expect } from 'vitest';
import { buildSimplePdf } from './pdf-simple';

describe('buildSimplePdf', () => {
  it('emits a PDF header and EOF', () => {
    const buf = buildSimplePdf({
      title: 'Test Report',
      lines: ['Score: 81', 'Business: Acme'],
    });
    const s = buf.toString('latin1');
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.includes('%%EOF')).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });
});
