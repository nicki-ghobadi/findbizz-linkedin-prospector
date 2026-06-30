import { createHash, randomInt } from "crypto";
import { Resend } from "resend";
import {
  getSiteId,
  getSupabaseAdmin,
  OrderRow,
  OrderStatus,
  OrderType,
} from "./supabase-admin";
import { normalizeEmail } from "./validate-email";
import { requireEnv } from "./env";
import { UserFacingError } from "./user-error";

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

const SITE_LABELS: Record<string, string> = {
  "local-leads": "Local Leads",
  "serp-tracker": "SERP Tracker",
  "influencer-lookup": "Influencer Lookup",
  "linkedin-prospector": "LinkedIn Prospector",
};

export async function createOrder(params: {
  email: string;
  requestPayload: Record<string, unknown>;
  orderType?: OrderType;
}): Promise<{ orderId: string }> {
  const supabase = getSupabaseAdmin();
  const site = getSiteId();
  const email = normalizeEmail(params.email);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      site,
      email,
      request_payload: params.requestPayload,
      order_type: params.orderType ?? "one_time",
      status: "pending_verification",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create order");
  }

  await sendVerificationCode(data.id, email);
  return { orderId: data.id };
}

export async function sendVerificationCode(orderId: string, email: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: deleteError } = await supabase
    .from("email_verifications")
    .delete()
    .eq("order_id", orderId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: insertError } = await supabase.from("email_verifications").insert({
    order_id: orderId,
    email: normalizeEmail(email),
    code_hash: hashCode(code),
    expires_at: expiresAt,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const siteLabel = SITE_LABELS[getSiteId()] ?? "findbizz.online";

  await resend.emails.send({
    from: requireEnv("RESEND_FROM_EMAIL"),
    to: email,
    subject: `${code} — verify your email for ${siteLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>Verify your email</h2>
        <p>Enter this code to continue to payment and receive your CSV at <strong>${email}</strong>:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${code}</p>
        <p style="color: #666; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function verifyEmailCode(orderId: string, code: string): Promise<OrderRow> {
  const supabase = getSupabaseAdmin();
  const trimmed = code.trim();

  if (!/^\d{6}$/.test(trimmed)) {
    throw new UserFacingError("Enter the 6-digit code from your email.");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("site", getSiteId())
    .single();

  if (orderError || !order) {
    throw new UserFacingError("Order not found.");
  }

  if (order.email_verified_at) {
    const { data: verifiedRow } = await supabase
      .from("email_verifications")
      .select("code_hash")
      .eq("order_id", orderId)
      .not("verified_at", "is", null)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verifiedRow?.code_hash === hashCode(trimmed)) {
      return order as OrderRow;
    }
    throw new UserFacingError("Invalid code. Check your email and try again.");
  }

  const { data: verification, error: verError } = await supabase
    .from("email_verifications")
    .select("*")
    .eq("order_id", orderId)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verError || !verification) {
    throw new UserFacingError("No active verification code. Request a new code.");
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    throw new UserFacingError("Too many attempts. Request a new code.");
  }

  if (new Date(verification.expires_at) < new Date()) {
    throw new UserFacingError("Code expired. Request a new code.");
  }

  const match = verification.code_hash === hashCode(trimmed);

  await supabase
    .from("email_verifications")
    .update({ attempts: verification.attempts + 1 })
    .eq("id", verification.id);

  if (!match) {
    throw new UserFacingError("Invalid code. Check your email and try again.");
  }

  const now = new Date().toISOString();

  await supabase
    .from("email_verifications")
    .update({ verified_at: now })
    .eq("id", verification.id);

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({
      email_verified_at: now,
      status: "verified" satisfies OrderStatus,
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to verify email");
  }

  return updated as OrderRow;
}

export async function requireVerifiedOrder(orderId: string): Promise<OrderRow> {
  const supabase = getSupabaseAdmin();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("site", getSiteId())
    .single();

  if (error || !order) {
    throw new UserFacingError("Order not found.");
  }

  if (!order.email_verified_at) {
    throw new UserFacingError("Email not verified.");
  }

  return order as OrderRow;
}

/** Block checkout on completed or already-paid orders. */
export async function requireCheckoutEligibleOrder(orderId: string): Promise<OrderRow> {
  const order = await requireVerifiedOrder(orderId);
  if (order.status === "fulfilled" || order.status === "paid") {
    throw new UserFacingError("This order has already been completed.");
  }
  return order;
}

export async function markPendingPayment(
  orderId: string,
  stripeSessionId: string,
  amountCents?: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "pending_payment",
      stripe_checkout_session_id: stripeSessionId,
      ...(amountCents != null ? { amount_cents: amountCents } : {}),
    })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}

export async function markPaidFromSession(session: {
  metadata?: Record<string, string> | null;
  id: string;
  payment_intent?: string | { id: string } | null;
  customer?: string | { id: string } | null;
  amount_total?: number | null;
  subscription?: string | { id: string } | null;
}): Promise<OrderRow | null> {
  const orderId = session.metadata?.orderId;
  if (!orderId) return null;

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const customer =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscription =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: now,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      stripe_customer_id: customer,
      stripe_subscription_id: subscription,
      ...(session.amount_total != null ? { amount_cents: session.amount_total } : {}),
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as OrderRow;
}

export async function markPaidFromSubscription(params: {
  orderId?: string;
  subscriptionId: string;
  customerId?: string | null;
  amountCents?: number;
}): Promise<OrderRow | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  let query = supabase
    .from("orders")
    .update({
      status: "paid",
      paid_at: now,
      stripe_subscription_id: params.subscriptionId,
      ...(params.customerId ? { stripe_customer_id: params.customerId } : {}),
      ...(params.amountCents != null ? { amount_cents: params.amountCents } : {}),
    })
    .select("*");

  if (params.orderId) {
    query = query.eq("id", params.orderId);
  } else {
    query = query.eq("stripe_subscription_id", params.subscriptionId);
  }

  const { data, error } = await query.single();
  if (error) return null;
  return data as OrderRow;
}

export async function markFulfilled(orderId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}

export async function markFailed(orderId: string, message: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "failed",
      error_message: message.slice(0, 500),
    })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}

export async function getOrderBySessionId(sessionId: string): Promise<OrderRow | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  return (data as OrderRow) ?? null;
}
