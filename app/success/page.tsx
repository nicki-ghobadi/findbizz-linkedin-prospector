import Link from "next/link";
import { theme } from "@/lib/theme";
import { FindBizzLogo } from "@/components/findbizz-logo";

export default function SuccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: theme.bg }}>
      <Link href="/" className="mb-8">
        <FindBizzLogo />
      </Link>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8 text-center shadow-2xl shadow-black/40 sm:p-10"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        }}
      >
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full text-xl"
          style={{
            backgroundColor: theme.accentSoft,
            color: theme.accent,
            border: `1px solid ${theme.accentBorder}`,
          }}
        >
          ✓
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Payment confirmed</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          Your LinkedIn list is being built. Check your inbox in the next{" "}
          <span className="font-medium text-white/80">10–15 minutes</span>.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
        >
          ← Order another list
        </Link>
      </div>
    </main>
  );
}
