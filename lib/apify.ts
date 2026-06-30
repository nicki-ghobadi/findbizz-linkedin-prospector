import { ApifyClient } from "apify-client";

export interface LinkedInLead {
  fullName: string;
  headline: string;
  location: string;
  company: string;
  jobTitle: string;
  profileUrl: string;
}

function formatLocation(location: unknown): string {
  if (!location) return "";
  if (typeof location === "string") return location;
  const loc = location as Record<string, unknown>;
  const parsed = loc.parsed as Record<string, unknown> | undefined;
  if (parsed?.text) return String(parsed.text);
  if (loc.linkedinText) return String(loc.linkedinText);
  return "";
}

function mapHarvestProfile(
  item: Record<string, unknown>,
  fallbackJobTitle: string
): LinkedInLead | null {
  const profileUrl = String(item.linkedinUrl || item.profileUrl || item.url || "");
  if (!profileUrl) return null;

  const firstName = String(item.firstName || "");
  const lastName = String(item.lastName || "");
  const fullName =
    String(item.fullName || item.name || "").trim() ||
    [firstName, lastName].filter(Boolean).join(" ").trim();

  const currentPosition = (item.currentPosition as Record<string, unknown>[] | undefined)?.[0];
  const company = String(
    currentPosition?.companyName || item.company || item.companyName || ""
  );
  const jobTitle = String(currentPosition?.position || fallbackJobTitle);

  return {
    fullName,
    headline: String(item.headline || ""),
    location: formatLocation(item.location),
    company,
    jobTitle,
    profileUrl,
  };
}

function mapFabriProfile(
  item: Record<string, unknown>,
  fallbackJobTitle: string
): LinkedInLead | null {
  const profileUrl = String(item.profileUrl || item.url || "");
  if (!profileUrl) return null;

  return {
    fullName: String(item.fullName || item.name || ""),
    headline: String(item.headline || item.title || ""),
    location: String(item.locationText || item.location || ""),
    company: String(item.company || item.companyName || item.currentCompany || ""),
    jobTitle: String(item.jobTitle || fallbackJobTitle),
    profileUrl,
  };
}

export async function scrapeLinkedInPeople(
  jobTitle: string,
  location: string,
  industry?: string
): Promise<LinkedInLead[]> {
  const token = process.env.APIFY_API_TOKEN;
  const actorId =
    process.env.APIFY_ACTOR_ID || "harvestapi~linkedin-profile-search";
  if (!token) throw new Error("Missing APIFY_API_TOKEN");

  const client = new ApifyClient({ token });
  const locationQuery = `${location}, Ontario, Canada`;
  const isHarvest = actorId.includes("harvestapi");

  const input = isHarvest
    ? {
        currentJobTitles: [jobTitle],
        locations: [locationQuery],
        ...(industry ? { searchQuery: industry } : {}),
        maxItems: 100,
      }
    : {
        currentJobTitles: [jobTitle],
        locations: [locationQuery],
        searchQuery: [jobTitle, industry].filter(Boolean).join(" "),
        mode: "Short",
        maxItems: 100,
        takePages: 4,
        preferBuiltinSearch: true,
      };

  const run = await client.actor(actorId).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const seen = new Set<string>();
  const results: LinkedInLead[] = [];

  for (const item of items as Record<string, unknown>[]) {
    const mapped = isHarvest
      ? mapHarvestProfile(item, jobTitle)
      : mapFabriProfile(item, jobTitle);
    if (!mapped || seen.has(mapped.profileUrl)) continue;
    seen.add(mapped.profileUrl);
    results.push(mapped);
  }

  return results.slice(0, 100);
}

import { sanitizeCsvCell } from "./sanitize";

export function linkedInToCSV(leads: LinkedInLead[]): string {
  const header = ["Full Name", "Job Title", "Company", "Location", "Headline", "LinkedIn URL"];
  const rows = leads.map((l) => [
    sanitizeCsvCell(l.fullName),
    sanitizeCsvCell(l.jobTitle),
    sanitizeCsvCell(l.company),
    sanitizeCsvCell(l.location),
    sanitizeCsvCell(l.headline),
    sanitizeCsvCell(l.profileUrl),
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
