import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/orders";
import { getErrorMessage } from "@/lib/env";
import { clientIp, enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { clampString } from "@/lib/sanitize";
import { UserFacingError } from "@/lib/user-error";
import { emailsMatch, isValidEmail, normalizeEmail } from "@/lib/validate-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const confirmEmail = normalizeEmail(body.confirmEmail);
    const jobTitle = clampString(body.jobTitle, 100);
    const location = clampString(body.location, 100);
    const industry = clampString(body.industry, 100);

    if (!email || !confirmEmail || !jobTitle || !location) {
      return NextResponse.json({ error: "Fill in all required fields including email confirmation." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (!emailsMatch(email, confirmEmail)) {
      return NextResponse.json({ error: "Email addresses do not match." }, { status: 400 });
    }

    await enforceRateLimit(`request:ip:${clientIp(req)}`, RATE_LIMITS.requestByIp);
    await enforceRateLimit(`request:email:${email}`, RATE_LIMITS.requestByEmail);

    const { orderId } = await createOrder({
      email,
      requestPayload: { jobTitle, location, industry: industry || "" },
    });

    return NextResponse.json({ orderId, email });
  } catch (err) {
    console.error("Request error:", err);
    const status = err instanceof UserFacingError ? 429 : 500;
    return NextResponse.json(
      { error: getErrorMessage(err, "Unable to start your request. Please try again.") },
      { status }
    );
  }
}
