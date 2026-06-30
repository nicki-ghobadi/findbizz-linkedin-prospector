import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type Theme = { accent: string; accentHover: string; accentBorder: string; buttonText: string };

export function fieldClass(accentBorder: string) {
  return `w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:ring-2 focus:ring-[${accentBorder}]`;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-white/45">
      {children}
    </label>
  );
}

export function FieldInput({
  theme,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { theme: Theme }) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:ring-2 ${className}`}
      style={{ ["--tw-ring-color" as string]: theme.accentBorder }}
      onFocus={(e) => (e.currentTarget.style.borderColor = theme.accentBorder)}
      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
    />
  );
}

export function FieldSelect({
  theme,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { theme: Theme; children: ReactNode }) {
  return (
    <select
      {...props}
      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:ring-2"
      style={{ ["--tw-ring-color" as string]: theme.accentBorder }}
      onFocus={(e) => (e.currentTarget.style.borderColor = theme.accentBorder)}
      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
    >
      {children}
    </select>
  );
}

export function PreviewBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-white/55">
      {children}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function SubmitButton({
  theme,
  loading,
  children,
}: {
  theme: Theme;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-xl py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: theme.accent,
        color: theme.buttonText,
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.backgroundColor = theme.accentHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = theme.accent;
      }}
    >
      {children}
    </button>
  );
}

export function FormHint({ children }: { children: ReactNode }) {
  return <p className="text-center text-xs leading-relaxed text-white/30">{children}</p>;
}
