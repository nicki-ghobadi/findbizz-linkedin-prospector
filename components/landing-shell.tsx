import type { ReactNode } from "react";
import { FindBizzLogo } from "@/components/findbizz-logo";

type Feature = { title: string; desc: string };

type Props = {
  productName: string;
  footer: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  glow: string;
  badge: string;
  headline: string[];
  accentIndex: number;
  description: string;
  price: string;
  featuresTitle: string;
  features: Feature[];
  trustItems?: string[];
  children: ReactNode;
};

export function LandingShell({
  productName,
  footer,
  accent,
  accentSoft,
  accentBorder,
  glow,
  badge,
  headline,
  accentIndex,
  description,
  price,
  featuresTitle,
  features,
  trustItems = ["Simple checkout", "CSV delivered by email", "Built for growth teams"],
  children,
}: Props) {
  return (
    <div className="min-h-screen text-white">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, ${glow}, transparent),
            radial-gradient(ellipse 60% 40% at 100% 0%, ${accentSoft}, transparent)
          `,
        }}
      />

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#090909]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <FindBizzLogo productName={productName} />
          <span
            className="hidden rounded-full px-3 py-1 text-[11px] font-medium sm:inline-block"
            style={{ backgroundColor: accentSoft, color: accent, border: `1px solid ${accentBorder}` }}
          >
            {price}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-14 xl:grid-cols-[1fr_440px]">
          <section className="lg:pt-4">
            <span
              className="inline-flex rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider"
              style={{ backgroundColor: accentSoft, color: accent, border: `1px solid ${accentBorder}` }}
            >
              {badge}
            </span>

            <h1 className="mt-6 max-w-xl text-[2rem] font-semibold leading-[1.12] tracking-tight sm:text-5xl sm:leading-[1.1]">
              {headline.map((line, i) => (
                <span key={line} className="block">
                  {i === accentIndex ? (
                    <span style={{ color: accent }}>{line}</span>
                  ) : (
                    line
                  )}
                </span>
              ))}
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/55 sm:text-lg">
              {description}
            </p>

            <p className="mt-4 text-sm font-medium text-white/35 sm:hidden">{price}</p>

            <ul className="mt-8 hidden flex-col gap-3 sm:flex">
              {trustItems.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/50">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]"
                    style={{ backgroundColor: accentSoft, color: accent }}
                  >
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/40 sm:p-8"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            <div className="mb-6 border-b border-white/[0.06] pb-5">
              <h2 className="text-lg font-semibold">Get started</h2>
              <p className="mt-1 text-sm text-white/45">Fill in your details — checkout takes under a minute.</p>
            </div>
            {children}
          </section>
        </div>

        <section className="mt-20 border-t border-white/[0.06] pt-16 sm:mt-24">
          <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-white/30">Included</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{featuresTitle}</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div
                  className="mb-3 h-1 w-8 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <h3 className="text-sm font-semibold text-white/90">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/45">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center">
        <p className="text-xs text-white/30">
          © {new Date().getFullYear()} findbizz.online · {footer}
        </p>
      </footer>
    </div>
  );
}
