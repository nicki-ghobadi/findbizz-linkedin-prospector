import { UserFacingError } from "./user-error";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConfigError(
      `Missing ${name}. Add it to .env.local (see .env.local.example).`
    );
  }
  return value;
}

/** Return client-safe error text; log internals in production. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof UserFacingError) return err.message;
  if (process.env.NODE_ENV === "development") {
    if (err instanceof ConfigError) return err.message;
    if (err instanceof Error && err.message) return err.message;
  }
  if (err instanceof Error) {
    console.error("[api]", err.message);
  } else {
    console.error("[api]", err);
  }
  return fallback;
}
