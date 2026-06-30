"use client";

import { useState } from "react";
import { EmailVerifyStep } from "@/components/email-verify-step";
import { LandingShell } from "@/components/landing-shell";
import {
  ErrorBox,
  FieldInput,
  FieldSelect,
  FormHint,
  Label,
  PreviewBox,
  SubmitButton,
} from "@/components/form-ui";
import { JOB_TITLES, INDUSTRIES } from "@/lib/constants";
import { ONTARIO_REGIONS } from "@/lib/ontario-cities";
import { features, hero, theme } from "@/lib/theme";

export default function Home() {
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedLabel = JOB_TITLES.find((j) => j.value === jobTitle)?.label || jobTitle;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobTitle || !location || !email || !confirmEmail) {
      setError("Please fill in all required fields.");
      return;
    }
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError("Email addresses do not match.");
      return;
    }
    setError("");
    setLoading(true);

    const res = await fetch("/api/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, confirmEmail, jobTitle, location, industry }),
    });

    const data = await res.json();
    if (data.orderId) {
      setOrderId(data.orderId);
      setStep("verify");
      setLoading(false);
      return;
    }

    setError(data.error || "Something went wrong. Please try again.");
    setLoading(false);
  }

  return (
    <LandingShell
      productName={theme.productName}
      footer={theme.footer}
      accent={theme.accent}
      accentSoft={theme.accentSoft}
      accentBorder={theme.accentBorder}
      glow={theme.glow}
      badge={hero.badge}
      headline={hero.headline}
      accentIndex={hero.accentIndex}
      description={hero.description}
      price={hero.price}
      featuresTitle={features.title}
      features={features.items}
      trustItems={hero.trustItems}
    >
      {step === "verify" ? (
        <EmailVerifyStep
          theme={theme}
          email={email}
          orderId={orderId}
          checkoutPath="/api/checkout"
          submitLabel="Continue to payment — $79 CAD"
          onBack={() => {
            setStep("form");
            setOrderId("");
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label>Job title / role</Label>
            <FieldSelect theme={theme} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}>
              <option value="" disabled>
                Select a role…
              </option>
              {JOB_TITLES.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </FieldSelect>
          </div>

          <div>
            <Label>City</Label>
            <FieldSelect theme={theme} value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="" disabled>
                Select a city…
              </option>
              {ONTARIO_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </FieldSelect>
          </div>

          <div>
            <Label>Industry (optional)</Label>
            <FieldSelect theme={theme} value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </FieldSelect>
          </div>

          <div>
            <Label>Your email</Label>
            <FieldInput
              theme={theme}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <Label>Confirm email</Label>
            <FieldInput
              theme={theme}
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          {jobTitle && location && (
            <PreviewBox>
              {selectedLabel} in {location}
              {industry ? ` · ${industry}` : ""}
            </PreviewBox>
          )}

          {error && <ErrorBox message={error} />}

          <SubmitButton theme={theme} loading={loading}>
            {loading ? "Sending verification code…" : "Verify email & continue — $79 CAD"}
          </SubmitButton>

          <FormHint>{hero.delivery}</FormHint>
        </form>
      )}
    </LandingShell>
  );
}
