import { Resend } from "resend";
import { runAiVerification } from "./ai-verify";
import { requireEnv } from "./env";
import { ValidationReport, validationSummaryHtml } from "./fulfillment-validate";
import { SpotCheckReport } from "./spot-check";
import { getSiteId, getSupabaseAdmin } from "./supabase-admin";
import {
  evaluateVerification,
  VerificationFailedError,
  verificationSummaryHtml,
  VerificationResult,
} from "./verification";

export type FulfillmentPayload = {
  customerEmail: string;
  subject: string;
  htmlBody: string;
  csvFilename?: string;
  csvContent?: string;
  rowCount: number;
  noResults?: boolean;
};

export async function autoFulfill(params: {
  orderId: string;
  validationReport: ValidationReport;
  crossCheckReport: SpotCheckReport;
  fulfillment: FulfillmentPayload;
  aiSamples?: Record<string, unknown>[];
}): Promise<VerificationResult> {
  const site = getSiteId();
  const aiReport = await runAiVerification({
    site,
    samples: params.aiSamples ?? [],
    rowCount: params.fulfillment.rowCount,
  });

  const result = evaluateVerification({
    validationReport: params.validationReport,
    crossCheckReport: params.crossCheckReport,
    aiReport,
    rowCount: params.fulfillment.rowCount,
    noResults: params.fulfillment.noResults,
  });

  if (!result.passed) {
    await saveVerificationReports(params.orderId, result);
    throw new VerificationFailedError(result.failureReasons);
  }

  const { fulfillment } = params;
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  await resend.emails.send({
    from: requireEnv("RESEND_FROM_EMAIL"),
    to: fulfillment.customerEmail,
    subject: fulfillment.subject,
    html: fulfillment.htmlBody + verificationSummaryHtml(result),
    ...(fulfillment.csvContent && fulfillment.csvFilename
      ? {
          attachments: [
            {
              filename: fulfillment.csvFilename,
              content: Buffer.from(fulfillment.csvContent).toString("base64"),
            },
          ],
        }
      : {}),
  });

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "fulfilled",
      fulfilled_at: now,
      validation_report: result.validationReport,
      spot_check_report: {
        ...result.crossCheckReport,
        ai: result.aiReport,
        autoVerified: true,
      },
    })
    .eq("id", params.orderId);

  if (error) throw new Error(error.message);

  return result;
}

async function saveVerificationReports(
  orderId: string,
  result: VerificationResult
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("orders")
    .update({
      validation_report: result.validationReport,
      spot_check_report: {
        ...result.crossCheckReport,
        ai: result.aiReport,
        failureReasons: result.failureReasons,
      },
    })
    .eq("id", orderId);
}

/** Notify customer when automatic verification fails after retries. */
export async function sendVerificationFailureEmail(params: {
  customerEmail: string;
  productLabel: string;
}): Promise<void> {
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  await resend.emails.send({
    from: requireEnv("RESEND_FROM_EMAIL"),
    to: params.customerEmail,
    subject: `Your ${params.productLabel} order — quality check in progress`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px;">
        <h2>We're double-checking your data</h2>
        <p>Your payment was received. Our automatic quality verification flagged the first export for a re-check.</p>
        <p>We're re-running the scrape now and will email your CSV within a few hours. No action needed on your end.</p>
        <p style="font-size:12px;color:#888;">If you don't receive your file within 24 hours, reply to this email.</p>
      </div>
    `,
  });
}

export { VerificationFailedError };
