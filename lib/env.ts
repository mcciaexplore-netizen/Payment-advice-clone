/**
 * Startup check for environment variables (see .env.example for what each one
 * is). Called from instrumentation.ts when the server boots, so a missing or
 * malformed value fails immediately with one readable message instead of a
 * confusing error on the first request that happens to need it.
 */
type Env = Record<string, string | undefined>;

export interface EnvReport {
  errors: string[];
  warnings: string[];
}

const present = (value: string | undefined) => !!value && value.trim() !== "";

export function checkEnv(env: Env = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!present(env.DATABASE_URL)) {
    errors.push("DATABASE_URL is not set (Neon Postgres connection string).");
  } else if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL!.trim())) {
    errors.push("DATABASE_URL must start with postgres:// or postgresql://.");
  }

  if (!present(env.AUTH_SECRET)) {
    errors.push("AUTH_SECRET is not set (generate one with: openssl rand -base64 32).");
  } else if (env.AUTH_SECRET!.trim().length < 32) {
    errors.push("AUTH_SECRET is too short; use at least 32 characters (openssl rand -base64 32).");
  }

  if (!present(env.BLOB_READ_WRITE_TOKEN)) {
    errors.push("BLOB_READ_WRITE_TOKEN is not set (Vercel Blob store token; needed for attachments).");
  }

  const mode = env.EMAIL_MODE?.trim() || "preview";
  if (mode !== "preview" && mode !== "live") {
    errors.push(`EMAIL_MODE must be "preview" or "live" (got "${mode}").`);
  } else if (mode === "live") {
    const provider = env.EMAIL_PROVIDER?.trim() || "gmail";
    if (provider !== "gmail" && provider !== "resend") {
      errors.push(`EMAIL_PROVIDER must be "gmail" or "resend" (got "${provider}").`);
    } else if (provider === "gmail") {
      if (!present(env.GMAIL_USER)) errors.push("EMAIL_MODE=live with gmail needs GMAIL_USER.");
      if (!present(env.GMAIL_APP_PASSWORD)) errors.push("EMAIL_MODE=live with gmail needs GMAIL_APP_PASSWORD.");
    } else {
      if (!present(env.RESEND_API_KEY)) errors.push("EMAIL_MODE=live with resend needs RESEND_API_KEY.");
      if (!present(env.EMAIL_FROM)) warnings.push("EMAIL_FROM is not set; Resend's shared test sender will be used.");
    }
    if (present(env.EMAIL_TEST_OVERRIDE_RECIPIENT)) {
      warnings.push(`EMAIL_TEST_OVERRIDE_RECIPIENT is set: every email is redirected to ${env.EMAIL_TEST_OVERRIDE_RECIPIENT}.`);
    }
  } else {
    warnings.push("EMAIL_MODE is preview: emails are rendered to the server log, not sent.");
  }

  if (!present(env.GEMINI_API_KEY)) {
    warnings.push("GEMINI_API_KEY is not set: invoice auto-fill is off until a key is added under Admin > AI Auto-fill (forms still work manually).");
  }

  return { errors, warnings };
}

/** Throws one error listing every problem; logs warnings. */
export function assertEnv(env: Env = process.env): void {
  const { errors, warnings } = checkEnv(env);
  for (const warning of warnings) console.warn(`[env] ${warning}`);
  if (errors.length) {
    throw new Error(
      `Missing or invalid environment variables:\n - ${errors.join("\n - ")}\nSee .env.example for what each variable is.`,
    );
  }
}
