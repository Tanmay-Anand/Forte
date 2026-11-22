/**
 * Reading values out of a report with Claude, without an API.
 *
 * The person sends LAB_READ_PROMPT to the Claude app, attaches the report
 * there, and pastes Claude's reply back into Forte. parseLabReply turns that
 * reply into draft rows. Nothing is saved until each row is confirmed, and
 * every saved row is marked as read by Claude.
 */

export const LAB_READ_PROMPT = `I'm going to attach a blood-test report. Read every result in it and reply with ONLY these lines, one per result, and nothing else:

Marker | value | unit | low | high

Rules:
- Marker: the test name as printed, e.g. LDL cholesterol, Haemoglobin, TSH.
- value: the number exactly as printed. If the result is words (e.g. Negative), write the words.
- unit: as printed, e.g. mg/dL. Write - if there is none.
- low and high: the lab's reference range as printed. For "below 100" write - | 100. For "above 40" write 40 | -. Write - | - if no range is printed.
- Do not add explanations, interpretations, headings or a summary.`;

export type ParsedLabRow = {
  name: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  low: number | null;
  high: number | null;
};

function cell(raw: string | undefined): string | null {
  const t = (raw ?? '').trim().replace(/^\*+|\*+$/g, '').trim();
  return t === '' || t === '-' || t === '—' || t === '–' ? null : t;
}

function number(raw: string | null): number | null {
  if (raw == null) return null;
  const t = raw.replace(/,(?=\d{3}\b)/g, '').replace(',', '.').trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/**
 * Lines of "Marker | value | unit | low | high". Tolerates a Markdown table
 * (outer pipes, a header row, a --- row), bold markers, and decimal commas.
 * Lines that don't fit are skipped, never guessed at.
 */
export function parseLabReply(text: string): ParsedLabRow[] {
  const rows: ParsedLabRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    const parts = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    if (parts.length < 2) continue;
    if (parts.every((p) => /^\s*:?-{2,}:?\s*$/.test(p))) continue;
    const name = cell(parts[0]);
    if (!name || /^marker$/i.test(name)) continue;
    const valueRaw = cell(parts[1]);
    if (valueRaw == null) continue;
    const value = number(valueRaw);
    rows.push({
      name,
      value,
      valueText: value == null ? valueRaw : null,
      unit: cell(parts[2]),
      low: number(cell(parts[3])),
      high: number(cell(parts[4])),
    });
  }
  return rows;
}
