export type SpotCheckReport = {
  samplesChecked: number;
  passed: boolean;
  issues: string[];
  rescrapeChecked?: number;
  rescrapeMatched?: number;
};

function pickSamples<T>(items: T[], size: number): T[] {
  if (items.length <= size) return [...items];
  const copy = [...items];
  const out: T[] = [];
  while (out.length < size && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

/** Spot-check a random sample of validated rows. */
export function spotCheckSamples<T>(
  items: T[],
  check: (item: T) => string | null,
  sampleSize = 3
): SpotCheckReport {
  const samples = pickSamples(items, sampleSize);
  const issues: string[] = [];

  for (const item of samples) {
    const issue = check(item);
    if (issue) issues.push(issue);
  }

  return {
    samplesChecked: samples.length,
    passed: issues.length === 0,
    issues: issues.slice(0, 10),
  };
}

export function spotCheckSummaryHtml(report: SpotCheckReport): string {
  if (report.samplesChecked === 0) return "";
  const rescrape =
    report.rescrapeChecked != null
      ? ` Re-scraped ${report.rescrapeChecked} profiles: ${report.rescrapeMatched ?? 0} matched.`
      : "";
  return `<p style="font-size:12px;color:#666;">Spot-check: ${report.samplesChecked} sample rows${report.passed ? " passed" : " flagged"}${rescrape}${report.issues.length ? `. Issues: ${report.issues.slice(0, 3).join("; ")}` : ""}.</p>`;
}
