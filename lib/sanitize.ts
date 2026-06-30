/** Escape HTML for email templates and rendered output. */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Neutralize CSV formula injection (Excel / Google Sheets). */
export function sanitizeCsvCell(value: string | number): string {
  let v = String(value).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(v)) {
    v = `'${v}`;
  }
  return `"${v}"`;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "export.csv";
}

/** Clamp and trim user-supplied strings. */
export function clampString(value: unknown, maxLen: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, maxLen);
}

export function isValidDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(d);
}

export function parseKeywords(raw: unknown, max = 10): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k) => clampString(k, 80))
    .filter(Boolean)
    .slice(0, max);
}

export function parseKeywordsJson(raw: string | undefined, max = 10): string[] {
  if (!raw) return [];
  try {
    return parseKeywords(JSON.parse(raw), max);
  } catch {
    return [];
  }
}
