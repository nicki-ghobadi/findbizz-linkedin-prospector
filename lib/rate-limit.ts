import { UserFacingError } from "./user-error";
import { getSupabaseAdmin } from "./supabase-admin";

const WINDOW_MS = 60 * 60 * 1000;

type LimitConfig = { max: number; windowMs?: number };

export const RATE_LIMITS = {
  requestByIp: { max: 20, windowMs: WINDOW_MS },
  requestByEmail: { max: 5, windowMs: WINDOW_MS },
  resendByOrder: { max: 3, windowMs: WINDOW_MS },
  checkoutByOrder: { max: 10, windowMs: WINDOW_MS },
} as const satisfies Record<string, LimitConfig>;

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function enforceRateLimit(
  bucketKey: string,
  config: LimitConfig
): Promise<void> {
  const windowMs = config.windowMs ?? WINDOW_MS;
  const supabase = getSupabaseAdmin();
  const now = Date.now();

  const { data: row, error: readError } = await supabase
    .from("rate_limit_buckets")
    .select("count, window_start")
    .eq("bucket_key", bucketKey)
    .maybeSingle();

  if (readError) {
    if (readError.code === "42P01") return;
    console.warn("Rate limit read failed:", readError.message);
    return;
  }

  if (!row) {
    const { error: insertError } = await supabase.from("rate_limit_buckets").insert({
      bucket_key: bucketKey,
      count: 1,
      window_start: new Date(now).toISOString(),
    });
    if (insertError && insertError.code !== "23505") {
      console.warn("Rate limit insert failed:", insertError.message);
    }
    return;
  }

  const windowStart = new Date(row.window_start as string).getTime();
  if (now - windowStart > windowMs) {
    await supabase
      .from("rate_limit_buckets")
      .update({ count: 1, window_start: new Date(now).toISOString() })
      .eq("bucket_key", bucketKey);
    return;
  }

  if ((row.count as number) >= config.max) {
    throw new UserFacingError("Too many requests. Please wait an hour and try again.");
  }

  await supabase
    .from("rate_limit_buckets")
    .update({ count: (row.count as number) + 1 })
    .eq("bucket_key", bucketKey);
}
