import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage, requireEnv } from "@/lib/env";
import {
  markPendingPayment,
  requireCheckoutEligibleOrder,
  verifyEmailCode,
} from "@/lib/orders";
import { clientIp, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/user-error";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const priceId = requireEnv("STRIPE_PRICE_CAD_79");
    const { orderId, verificationCode } = await req.json();

    if (!orderId || !verificationCode) {
      return NextResponse.json(
        { error: "Verify your email to continue to payment." },
        { status: 400 }
      );
    }

    await enforceRateLimit(`checkout:order:${orderId}`, RATE_LIMITS.checkoutByOrder);
    await enforceRateLimit(`checkout:ip:${clientIp(req)}`, RATE_LIMITS.requestByIp);

    await verifyEmailCode(orderId, verificationCode);
    const order = await requireCheckoutEligibleOrder(orderId);
    const payload = order.request_payload;
    const email = order.email;
    const jobTitle = payload.jobTitle as string | undefined;
    const location = payload.location as string | undefined;
    const industry = (payload.industry as string | undefined) || "";

    if (!jobTitle || !location) {
      return NextResponse.json({ error: "Missing order details." }, { status: 400 });
    }

    const siteUrl = requireEnv("NEXT_PUBLIC_SITE_URL");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { orderId, email, jobTitle, location, industry },
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    await markPendingPayment(orderId, session.id, session.amount_total ?? undefined);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    const status = err instanceof UserFacingError ? 400 : 500;
    return NextResponse.json(
      { error: getErrorMessage(err, "Unable to start checkout. Please try again.") },
      { status }
    );
  }
}
