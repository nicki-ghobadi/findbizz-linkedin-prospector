import { NextRequest, NextResponse } from "next/server";
import { scrapeLinkedInPeople, linkedInToCSV } from "@/lib/apify";
import {
  autoFulfill,
  sendVerificationFailureEmail,
  VerificationFailedError,
} from "@/lib/auto-fulfill";
import { crossVerifyLinkedInLeads } from "@/lib/cross-verify";
import { validateLinkedInLeads, validationSummaryHtml } from "@/lib/fulfillment-validate";
import { getErrorMessage, requireEnv } from "@/lib/env";
import { markFailed, markPaidFromSession } from "@/lib/orders";
import { escapeHtml, sanitizeFilename } from "@/lib/sanitize";
import {
  claimStripeEvent,
  getOrderForWebhook,
  shouldSkipFulfillment,
} from "@/lib/webhook-guard";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ATTEMPTS = 2;

export async function POST(req: NextRequest) {
  let orderId: string | undefined;

  try {
    const stripe = getStripe();
    requireEnv("APIFY_API_TOKEN");
    requireEnv("APIFY_ACTOR_ID");
    requireEnv("RESEND_API_KEY");
    requireEnv("RESEND_FROM_EMAIL");

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, requireEnv("STRIPE_WEBHOOK_SECRET"));
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object;
    orderId = session.metadata?.orderId;

    const claimed = await claimStripeEvent({
      eventId: event.id,
      eventType: event.type,
      orderId,
    });
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const existing = orderId ? await getOrderForWebhook(orderId) : null;
    const skip = shouldSkipFulfillment(existing, session.payment_status);
    if (skip) {
      return NextResponse.json({ received: true, skipped: skip });
    }

    if (orderId) {
      await markPaidFromSession(session);
    }

    const email = session.metadata?.email;
    const jobTitle = session.metadata?.jobTitle;
    const location = session.metadata?.location;
    const industry = session.metadata?.industry;
    const siteUrl = requireEnv("NEXT_PUBLIC_SITE_URL");
    const siteHost = siteUrl.replace(/^https?:\/\//, "");

    if (!email || !jobTitle || !location || !orderId) {
      if (orderId) await markFailed(orderId, "Missing order metadata");
      return NextResponse.json({ received: true, error: "missing_metadata" });
    }

    const safeJob = escapeHtml(jobTitle);
    const safeLocation = escapeHtml(location);
    const safeIndustry = industry ? escapeHtml(industry) : "";
    let lastError: VerificationFailedError | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const rawLeads = await scrapeLinkedInPeople(jobTitle, location, industry || undefined);
        const { items: leads, report } = validateLinkedInLeads(rawLeads);

        if (leads.length === 0) {
          await autoFulfill({
            orderId,
            validationReport: report,
            crossCheckReport: { samplesChecked: 0, passed: true, issues: [] },
            fulfillment: {
              customerEmail: email,
              subject: `LinkedIn search: no profiles found for ${jobTitle} in ${location}`,
              htmlBody: `
                <div style="font-family: sans-serif; max-width: 560px;">
                  <h2>No profiles found</h2>
                  <p>We couldn't find public LinkedIn profiles for <strong>${safeJob}</strong> in <strong>${safeLocation}</strong>.</p>
                  <p>Try a broader role or different city at <a href="${escapeHtml(siteUrl)}">${escapeHtml(siteHost)}</a>.</p>
                </div>
              `,
              rowCount: 0,
              noResults: true,
            },
          });
          lastError = null;
          break;
        }

        const crossCheck = await crossVerifyLinkedInLeads(leads);
        const csv = linkedInToCSV(leads);

        await autoFulfill({
          orderId,
          validationReport: report,
          crossCheckReport: crossCheck,
          aiSamples: leads.slice(0, 8) as unknown as Record<string, unknown>[],
          fulfillment: {
            customerEmail: email,
            subject: `Your LinkedIn list: ${leads.length} ${jobTitle}s in ${location}`,
            htmlBody: `
              <div style="font-family: sans-serif; max-width: 560px;">
                <h2>Your LinkedIn prospect list is ready</h2>
                <p>We found <strong>${leads.length} ${safeJob}s</strong> in <strong>${safeLocation}${safeIndustry ? `, ${safeIndustry}` : ""}</strong>.</p>
                <p>The CSV file is attached. Each row includes: Full Name · Job Title · Company · Location · Headline · LinkedIn URL.</p>
                ${validationSummaryHtml(report)}
                <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
                <p style="font-size:12px;color:#888;">
                  Need a different role or city? Visit <a href="${escapeHtml(siteUrl)}">${escapeHtml(siteHost)}</a>
                </p>
              </div>
            `,
            csvFilename: sanitizeFilename(`linkedin-${jobTitle}-${location}.csv`),
            csvContent: csv,
            rowCount: leads.length,
          },
        });
        lastError = null;
        break;
      } catch (err) {
        if (err instanceof VerificationFailedError) {
          lastError = err;
          console.warn(`LinkedIn verification attempt ${attempt + 1} failed:`, err.reasons);
          continue;
        }
        throw err;
      }
    }

    if (lastError) {
      await sendVerificationFailureEmail({
        customerEmail: email,
        productLabel: "LinkedIn Prospector",
      });
      await markFailed(orderId, lastError.message);
      return NextResponse.json({ received: true, failed: true });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("LinkedIn scrape error:", err);
    if (orderId) {
      await markFailed(orderId, getErrorMessage(err, "Fulfillment failed")).catch(() => {});
    }
    return NextResponse.json({ received: true, error: "internal" });
  }
}
