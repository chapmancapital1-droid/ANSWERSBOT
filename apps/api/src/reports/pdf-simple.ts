/**
 * Minimal single-page text PDF (no native deps).
 * Good enough for white-label visibility reports.
 */
export function buildSimplePdf(opts: {
  title: string;
  lines: string[];
  brandLine?: string;
}): Buffer {
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const contentLines: string[] = [];
  let y = 760;
  contentLines.push('BT');
  if (opts.brandLine) {
    contentLines.push('/F1 10 Tf');
    contentLines.push(`50 ${y} Td`);
    contentLines.push(`(${escape(opts.brandLine.slice(0, 60))}) Tj`);
    contentLines.push('0 -18 Td');
    y -= 18;
  }
  contentLines.push('/F1 16 Tf');
  if (!opts.brandLine) {
    contentLines.push(`50 ${y} Td`);
  }
  contentLines.push(`(${escape(opts.title.slice(0, 80))}) Tj`);
  contentLines.push('/F1 10 Tf');
  contentLines.push('0 -24 Td');
  y -= 24;

  for (const raw of opts.lines) {
    const line = raw.slice(0, 100);
    if (y < 50) break;
    contentLines.push(`0 -14 Td`);
    contentLines.push(`(${escape(line)}) Tj`);
    y -= 14;
  }
  contentLines.push('ET');
  const stream = contentLines.join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push(
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
  );
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
