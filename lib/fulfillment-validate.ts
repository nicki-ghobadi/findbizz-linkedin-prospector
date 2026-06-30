export type ValidationReport = {
  accepted: number;
  rejected: number;
  warnings: string[];
};

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function validateLocalLeads<T extends { name: string; phone: string; address: string }>(
  leads: T[]
): { items: T[]; report: ValidationReport } {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const items: T[] = [];

  for (const lead of leads) {
    const phone = digitsOnly(lead.phone);
    if (!lead.name?.trim()) {
      warnings.push("Dropped row: missing business name");
      continue;
    }
    if (phone.length < 10) {
      warnings.push(`Dropped "${lead.name}": invalid phone`);
      continue;
    }
    if (!lead.address?.trim()) {
      warnings.push(`Dropped "${lead.name}": missing address`);
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    items.push(lead);
  }

  return {
    items,
    report: { accepted: items.length, rejected: leads.length - items.length, warnings: warnings.slice(0, 10) },
  };
}

export function validateLinkedInLeads<
  T extends { fullName: string; profileUrl: string; jobTitle: string },
>(leads: T[]): { items: T[]; report: ValidationReport } {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const items: T[] = [];

  for (const lead of leads) {
    const url = lead.profileUrl?.trim();
    if (!lead.fullName?.trim()) {
      warnings.push("Dropped row: missing name");
      continue;
    }
    if (!url || !/linkedin\.com\/in\//i.test(url)) {
      warnings.push(`Dropped "${lead.fullName}": invalid LinkedIn URL`);
      continue;
    }
    if (!lead.jobTitle?.trim()) {
      warnings.push(`Dropped "${lead.fullName}": missing job title`);
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    items.push(lead);
  }

  return {
    items,
    report: { accepted: items.length, rejected: leads.length - items.length, warnings: warnings.slice(0, 10) },
  };
}

export function validateSerpResults<
  T extends { keyword: string; position: number | null; url: string },
>(results: T[]): { items: T[]; report: ValidationReport } {
  const warnings: string[] = [];
  const items: T[] = [];

  for (const row of results) {
    if (!row.keyword?.trim()) {
      warnings.push("Dropped row: missing keyword");
      continue;
    }
    if (row.position != null && (row.position < 1 || row.position > 100)) {
      warnings.push(`Dropped "${row.keyword}": invalid position ${row.position}`);
      continue;
    }
    if (row.position != null && !row.url?.trim()) {
      warnings.push(`Dropped "${row.keyword}": ranked but missing URL`);
      continue;
    }
    items.push(row);
  }

  return {
    items,
    report: { accepted: items.length, rejected: results.length - items.length, warnings: warnings.slice(0, 10) },
  };
}

export function validateInfluencerProfiles<
  T extends { username: string; followers: number; profileUrl: string },
>(profiles: T[], range: { min: number; max: number | null }): { items: T[]; report: ValidationReport } {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const items: T[] = [];

  for (const p of profiles) {
    const username = p.username?.trim().replace(/^@/, "");
    if (!username) {
      warnings.push("Dropped row: missing username");
      continue;
    }
    if (!p.profileUrl?.includes("instagram.com/")) {
      warnings.push(`Dropped @${username}: invalid profile URL`);
      continue;
    }
    if (p.followers < range.min || (range.max != null && p.followers > range.max)) {
      warnings.push(`Dropped @${username}: ${p.followers} outside follower range`);
      continue;
    }
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ...p, username } as T);
  }

  return {
    items,
    report: { accepted: items.length, rejected: profiles.length - items.length, warnings: warnings.slice(0, 10) },
  };
}

export function validationSummaryHtml(report: ValidationReport): string {
  if (report.rejected === 0 && report.warnings.length === 0) return "";
  return `
    <p style="font-size:12px;color:#666;margin-top:12px;">
      Quality check: ${report.accepted} rows included${report.rejected ? `, ${report.rejected} removed` : ""}.
      ${report.warnings.length ? `Sample issues: ${report.warnings.slice(0, 3).join("; ")}` : ""}
    </p>
  `;
}
