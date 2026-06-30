import { NextRequest, NextResponse } from "next/server";
import { sendVerificationCode } from "@/lib/orders";
import { getErrorMessage } from "@/lib/env";
import { clientIp, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/user-error";
import { getSiteId, getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "Missing order ID." }, { status: 400 });
    }

    await enforceRateLimit(`resend:order:${orderId}`, RATE_LIMITS.resendByOrder);
    await enforceRateLimit(`resend:ip:${clientIp(req)}`, RATE_LIMITS.requestByIp);

    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase
      .from("orders")
      .select("email, email_verified_at")
      .eq("id", orderId)
      .eq("site", getSiteId())
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.email_verified_at) {
      return NextResponse.json({ error: "Email already verified." }, { status: 400 });
    }

    await sendVerificationCode(orderId, order.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Resend error:", err);
    return NextResponse.json(
      { error: getErrorMessage(err, "Could not resend code.") },
      { status: err instanceof UserFacingError ? 429 : 500 }
    );
  }
}
