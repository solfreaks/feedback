/**
 * Minimal CSV writer for admin exports. Deliberately avoids a dependency —
 * the export volumes are small (users' own feedback/tickets) and the escaping
 * rules are tight enough that a dep would be overkill.
 *
 * Handles: commas, double quotes, newlines, CRLF line endings for Excel.
 */

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Per RFC 4180: quote if the field contains a comma, quote, or line break.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  // CRLF so Excel opens it cleanly without a prompt.
  return lines.join("\r\n");
}
