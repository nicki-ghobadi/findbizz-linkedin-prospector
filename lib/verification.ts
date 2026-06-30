import type { ValidationReport } from "./fulfillment-validate";
import type { SpotCheckReport } from "./spot-check";

export type AiVerifyReport = {
  ran: boolean;
  approved: boolean;
  score: number;
  issues: string[];
  skippedReason?: string;
};

export type VerificationResult = {
  passed: boolean;
  failureReasons: string[];
  validationReport: ValidationReport;
  crossCheckReport: SpotCheckReport;
  aiReport: AiVerifyReport | null;
};

export const VERIFICATION_THRESHOLDS = {
  /** Minimum share of cross-check samples that must match the secondary actor. */
  minCrossMatchRatio: 0.67,
  /** Minimum AI quality score (0–10) when AI verification runs. */
  minAiScore: 7,
  /** Follower count tolerance for Instagram re-scrape (percent). */
  followerTolerancePct: 20,
  /** SERP position tolerance when re-checking keywords. */
  serpPositionTolerance: 5,
};

export function crossCheckMatchRatio(report: SpotCheckReport): number {
  if (report.rescrapeChecked != null && report.rescrapeChecked > 0) {
    return (report.rescrapeMatched ?? 0) / report.rescrapeChecked;
  }
  if (report.samplesChecked === 0) return 1;
  const failed = report.issues.length;
  return Math.max(0, (report.samplesChecked - failed) / report.samplesChecked);
}

export function evaluateVerification(params: {
  validationReport: ValidationReport;
  crossCheckReport: SpotCheckReport;
  aiReport: AiVerifyReport | null;
  rowCount: number;
  noResults?: boolean;
}): VerificationResult {
  const failureReasons: string[] = [];
  const { validationReport, crossCheckReport, aiReport, rowCount, noResults } = params;

  if (!noResults && rowCount === 0) {
    failureReasons.push("No valid rows after validation");
  }

  if (!noResults && rowCount > 0) {
    const ratio = crossCheckMatchRatio(crossCheckReport);
    if (crossCheckReport.samplesChecked > 0 && ratio < VERIFICATION_THRESHOLDS.minCrossMatchRatio) {
      failureReasons.push(
        `Cross-check match rate ${Math.round(ratio * 100)}% below ${Math.round(VERIFICATION_THRESHOLDS.minCrossMatchRatio * 100)}% threshold`
      );
    }
    if (crossCheckReport.issues.length > 0 && !crossCheckReport.passed && ratio < 1) {
      failureReasons.push(...crossCheckReport.issues.slice(0, 3));
    }
  }

  if (aiReport?.ran && !aiReport.approved) {
    failureReasons.push(`AI quality review rejected (score ${aiReport.score}/10)`);
  }
  if (aiReport?.ran && aiReport.score < VERIFICATION_THRESHOLDS.minAiScore) {
    failureReasons.push(`AI quality score ${aiReport.score} below minimum ${VERIFICATION_THRESHOLDS.minAiScore}`);
  }

  return {
    passed: failureReasons.length === 0,
    failureReasons,
    validationReport,
    crossCheckReport,
    aiReport,
  };
}

export function verificationSummaryHtml(result: VerificationResult): string {
  const cross = result.crossCheckReport;
  const ai = result.aiReport;
  const parts: string[] = [];

  if (cross.samplesChecked > 0 || (cross.rescrapeChecked ?? 0) > 0) {
    const ratio = Math.round(crossCheckMatchRatio(cross) * 100);
    parts.push(`Cross-verified ${cross.rescrapeChecked ?? cross.samplesChecked} sample(s) (${ratio}% match)`);
  }
  if (ai?.ran) {
    parts.push(`AI quality score: ${ai.score}/10`);
  } else if (ai?.skippedReason) {
    parts.push("AI review skipped");
  }

  if (parts.length === 0) return "";
  return `<p style="font-size:12px;color:#666;margin-top:12px;">Quality verified: ${parts.join(" · ")}.</p>`;
}

export class VerificationFailedError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Verification failed: ${reasons.join("; ")}`);
    this.name = "VerificationFailedError";
    this.reasons = reasons;
  }
}
