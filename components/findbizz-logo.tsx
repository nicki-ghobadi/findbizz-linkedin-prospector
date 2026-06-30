import type { SVGProps } from "react";
import { theme } from "@/lib/theme";

type MarkProps = SVGProps<SVGSVGElement> & { size?: number };

/** FindBizz icon mark — magnifying glass on project-themed gradient */
export function FindBizzMark({ size = 32, className, ...props }: MarkProps) {
  const stops = theme.logoGradient;
  const gradientSpread = stops.length > 1 ? 100 / (stops.length - 1) : 100;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <defs>
        <linearGradient id="findbizz-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          {stops.map((color, i) => (
            <stop
              key={color}
              offset={`${i * gradientSpread}%`}
              stopColor={color}
            />
          ))}
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#findbizz-grad)" />
      <circle cx="13" cy="13" r="5.5" stroke="white" strokeWidth="2" />
      <path d="M17 17L22 22" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="13" cy="13" r="1.5" fill="white" />
    </svg>
  );
}

type LogoProps = {
  productName?: string;
  className?: string;
};

/** Header logo: mark + findbizz.online wordmark + optional product subtitle */
export function FindBizzLogo({ productName, className }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <FindBizzMark size={32} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight leading-tight">
          findbizz<span style={{ color: theme.accent }}>.online</span>
        </p>
        {productName && (
          <p className="text-[11px] text-white/40 truncate">{productName}</p>
        )}
      </div>
    </div>
  );
}
