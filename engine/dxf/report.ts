import type { ConversionReport, ReportOutcome } from './import.ts';

// The conversion report as Markdown, for the bulk runner and for humans (P1.2 task 4).

const HEADINGS: Record<ReportOutcome, string> = {
  found: 'Found',
  guessed: 'Guessed (check these)',
  failed: 'Failed',
  note: 'Notes',
};

const STATUS: Record<ConversionReport['status'], string> = {
  success: 'Converted',
  partial: 'Converted with problems',
  failed: 'Not converted',
};

export function reportToMarkdown(report: ConversionReport): string {
  const lines: string[] = [`# ${report.name}`, '', `**${STATUS[report.status]}.**`];
  if (report.units) lines.push(`Units: ${report.units.unit} (${report.units.provenance}).`);
  const c = report.counts;
  if (report.status !== 'failed') {
    lines.push(
      '',
      `${c.walls} walls · ${c.rooms} rooms · ${c.doors} doors · ${c.windows} windows · ${c.ventilators} ventilators · ${c.openings} plain openings · ${c.stairs} stairs · ${c.columns} columns`,
    );
  }
  for (const outcome of ['found', 'guessed', 'failed', 'note'] as const) {
    const items = report.items.filter((i) => i.outcome === outcome);
    if (!items.length) continue;
    lines.push('', `## ${HEADINGS[outcome]}`, '');
    for (const i of items)
      lines.push(`- ${i.message}${i.object_ids?.length ? ` (${i.object_ids.join(', ')})` : ''}`);
  }
  if (report.issues.length) {
    lines.push('', '## Plan check', '');
    for (const i of report.issues) lines.push(`- **${i.severity}** ${i.message} ${i.how_to_fix}`);
  }
  return `${lines.join('\n')}\n`;
}
