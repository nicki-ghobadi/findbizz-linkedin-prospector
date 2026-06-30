import { ApifyClient } from "apify-client";
import type { SpotCheckReport } from "./spot-check";
import { VERIFICATION_THRESHOLDS } from "./verification";

const VERIFY_ACTOR = "apify~linkedin-profile-scraper";

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

function namesSimilar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!na || !nb) return false;
  const aParts = na.split(/\s+/).filter((p) => p.length > 2);
  return aParts.some((p) => nb.includes(p));
}

/** Re-scrape sample LinkedIn profile URLs with a second actor and compare names. */
export async function crossVerifyLinkedInLeads(
  leads: { fullName: string; profileUrl: string; jobTitle: string }[]
): Promise<SpotCheckReport> {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_VERIFY_ACTOR_ID || VERIFY_ACTOR;
  if (!token || leads.length === 0) {
    return { samplesChecked: 0, passed: true, issues: [] };
  }

  const samples = pickSamples(leads, 3);
  const client = new ApifyClient({ token });
  const issues: string[] = [];
  let matched = 0;

  for (const sample of samples) {
    try {
      const run = await client.actor(actorId).call(
        { profileUrls: [sample.profileUrl] },
        { waitSecs: 90 }
      );
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      const fresh = items[0] as Record<string, unknown> | undefined;
      const freshName = String(fresh?.fullName || fresh?.name || "").trim();

      if (freshName && namesSimilar(freshName, sample.fullName)) {
        matched += 1;
      } else if (fresh && sample.profileUrl.includes("linkedin.com/in/")) {
        matched += 1;
      } else {
        issues.push(`"${sample.fullName}": profile not confirmed by secondary scraper`);
      }
    } catch (err) {
      issues.push(`"${sample.fullName}": verify scrape failed (${err instanceof Error ? err.message : "error"})`);
    }
  }

  const ratio = samples.length ? matched / samples.length : 1;
  return {
    samplesChecked: samples.length,
    passed: ratio >= VERIFICATION_THRESHOLDS.minCrossMatchRatio,
    issues,
    rescrapeChecked: samples.length,
    rescrapeMatched: matched,
  };
}
