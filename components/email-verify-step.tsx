"use client";

import { useState } from "react";
import { ErrorBox, FieldInput, Label, SubmitButton } from "./form-ui";

type Theme = {
  accent: string;
  accentHover: string;
  accentBorder: string;
  buttonText: string;
};

type Props = {
  theme: Theme;
  email: string;
  orderId: string;
  checkoutPath: string;
  submitLabel: string;
  onBack: () => void;
};

export function EmailVerifyStep({
  theme,
  email,
  orderId,
  checkoutPath,
  submitLabel,
  onBack,
}: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError("");
    setLoading(true);

    const res = await fetch(checkoutPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, verificationCode: code.trim() }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
      return;
    }

    setError(data.error || "Verification failed. Please try again.");
    setLoading(false);
  }

  async function handleResend() {
    setResending(true);
    setError("");
    const res = await fetch("/api/request/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not resend code.");
    }
    setResending(false);
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-white/80">{email}</span>. Verify your email to
        continue to payment.
      </div>

      <div>
        <Label>Verification code</Label>
        <FieldInput
          theme={theme}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="tracking-[0.35em] text-center text-lg font-semibold"
        />
      </div>

      {error && <ErrorBox message={error} />}

      <SubmitButton theme={theme} loading={loading}>
        {loading ? "Redirecting to payment…" : submitLabel}
      </SubmitButton>

      <div className="flex flex-col items-center gap-2 text-center text-xs text-white/35">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-white/50 underline-offset-2 hover:text-white/70 hover:underline disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-white/40 underline-offset-2 hover:text-white/60 hover:underline"
        >
          ← Change email or request details
        </button>
      </div>
    </form>
  );
}
