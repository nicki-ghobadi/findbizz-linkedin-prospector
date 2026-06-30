import { getSiteId, getSupabaseAdmin, OrderRow } from "./supabase-admin";

export type WebhookSkipReason = "duplicate_event" | "already_fulfilled" | "unpaid";

export async function claimStripeEvent(params: {
  eventId: string;
  eventType: string;
  orderId?: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("stripe_processed_events").insert({
    event_id: params.eventId,
    site: getSiteId(),
    order_id: params.orderId ?? null,
    event_type: params.eventType,
  });

  if (error) {
    if (error.code === "23505") return false;
    if (error.code === "42P01") return true;
    console.warn("Stripe event claim failed:", error.message);
    return true;
  }
  return true;
}

export async function getOrderForWebhook(orderId: string): Promise<OrderRow | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("site", getSiteId())
    .maybeSingle();
  return (data as OrderRow) ?? null;
}

export function shouldSkipFulfillment(
  order: OrderRow | null,
  paymentStatus?: string | null
): WebhookSkipReason | null {
  if (order?.status === "fulfilled") return "already_fulfilled";
  if (paymentStatus && paymentStatus !== "paid") return "unpaid";
  return null;
}
