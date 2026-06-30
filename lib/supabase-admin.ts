import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

export type SiteId =
  | "local-leads"
  | "serp-tracker"
  | "influencer-lookup"
  | "linkedin-prospector";

export type OrderStatus =
  | "pending_verification"
  | "verified"
  | "pending_payment"
  | "paid"
  | "pending_review"
  | "fulfilled"
  | "failed"
  | "cancelled";

export type OrderType = "one_time" | "subscription";

export type OrderRow = {
  id: string;
  site: SiteId;
  email: string;
  email_verified_at: string | null;
  order_type: OrderType;
  request_payload: Record<string, unknown>;
  status: OrderStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  amount_cents: number | null;
  currency: string;
  paid_at: string | null;
  fulfilled_at: string | null;
  error_message: string | null;
  validation_report: Record<string, unknown> | null;
  spot_check_report: Record<string, unknown> | null;
  fulfillment_data: Record<string, unknown> | null;
  review_token: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function getSiteId(): SiteId {
  const site = requireEnv("FIND_BIZZ_SITE") as SiteId;
  const allowed: SiteId[] = [
    "local-leads",
    "serp-tracker",
    "influencer-lookup",
    "linkedin-prospector",
  ];
  if (!allowed.includes(site)) {
    throw new Error(`Invalid FIND_BIZZ_SITE: ${site}`);
  }
  return site;
}
