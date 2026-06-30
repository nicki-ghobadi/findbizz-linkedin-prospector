import type { AiVerifyReport } from "./verification";

const SITE_PRODUCT: Record<string, string> = {
  "local-leads": "local business lead list (name, phone, address from Google Places)",
  "serp-tracker": "Google SERP ranking report (keyword, position, URL)",
  "influencer-lookup": "Instagram creator discovery list (username, followers, profile URL)",
  "linkedin-prospector": "LinkedIn prospect list (name, job title, company, profile URL)",
};

type SampleRow = Record<string, unknown>;

function truncateSamples(samples: SampleRow[], max = 8): SampleRow[] {
  return samples.slice(0, max).map((row) => {
    const out: SampleRow = {};
    for (const [k, v] of Object.entries(row)) {
      const s = String(v ?? "");
      out[k] = s.length > 120 ? s.slice(0, 117) + "..." : v;
    }
    return out;
  });
}

/** Optional AI sanity check on a sample of rows. Skipped when OPENAI_API_KEY is unset. */
export async function runAiVerification(params: {
  site: string;
  samples: SampleRow[];
  rowCount: number;
}): Promise<AiVerifyReport> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ran: false,
      approved: true,
      score: 10,
      issues: [],
      skippedReason: "OPENAI_API_KEY not configured",
    };
  }

  if (params.rowCount === 0 || params.samples.length === 0) {
    return { ran: false, approved: true, score: 10, issues: [], skippedReason: "No rows to review" };
  }

  const product = SITE_PRODUCT[params.site] ?? "CSV data export";
  const payload = truncateSamples(params.samples);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VERIFY_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a data quality auditor for paid CSV exports. Review sample rows and detect scraper garbage, placeholder text, broken URLs, impossible values, or inconsistent formats. Be strict but fair — real scraped data may be imperfect. Respond ONLY with JSON: {"approved":boolean,"score":number,"issues":string[]} where score is 0-10 (10=excellent). Approve only if data looks genuinely usable for sales/outreach.`,
        },
        {
          role: "user",
          content: `Product: ${product}\nTotal rows in export: ${params.rowCount}\nSample rows (JSON):\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn("AI verification API error:", text);
    return {
      ran: false,
      approved: true,
      score: 10,
      issues: [],
      skippedReason: "AI API unavailable — cross-check only",
    };
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return {
      ran: false,
      approved: true,
      score: 10,
      issues: [],
      skippedReason: "Empty AI response",
    };
  }

  try {
    const parsed = JSON.parse(content) as {
      approved?: boolean;
      score?: number;
      issues?: string[];
    };
    return {
      ran: true,
      approved: Boolean(parsed.approved),
      score: typeof parsed.score === "number" ? parsed.score : 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 5) : [],
    };
  } catch {
    return {
      ran: false,
      approved: true,
      score: 10,
      issues: [],
      skippedReason: "Could not parse AI response",
    };
  }
}
