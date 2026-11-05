import { describe, expect, it, vi } from "vitest";
import { assertEnv, checkEnv } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgres://user:pw@host.example/db?sslmode=require",
  AUTH_SECRET: "x".repeat(32),
  BLOB_READ_WRITE_TOKEN: "token",
};

describe("checkEnv", () => {
  it("accepts the minimum set (email defaults to preview)", () => {
    expect(checkEnv(valid).errors).toEqual([]);
  });

  it("names every missing required variable", () => {
    const { errors } = checkEnv({});
    expect(errors.join("\n")).toMatch(/DATABASE_URL[\s\S]*AUTH_SECRET[\s\S]*BLOB_READ_WRITE_TOKEN/);
  });

  it("rejects a malformed database URL and a short auth secret", () => {
    const { errors } = checkEnv({ ...valid, DATABASE_URL: "mysql://x", AUTH_SECRET: "short" });
    expect(errors).toHaveLength(2);
  });

  it("live gmail needs credentials; live resend needs an API key", () => {
    expect(checkEnv({ ...valid, EMAIL_MODE: "live" }).errors).toHaveLength(2);
    expect(checkEnv({ ...valid, EMAIL_MODE: "live", GMAIL_USER: "a@b.co", GMAIL_APP_PASSWORD: "p" }).errors).toEqual([]);
    expect(checkEnv({ ...valid, EMAIL_MODE: "live", EMAIL_PROVIDER: "resend" }).errors).toHaveLength(1);
    expect(checkEnv({ ...valid, EMAIL_MODE: "live", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "k" }).errors).toEqual([]);
  });

  it("rejects unknown email mode and provider", () => {
    expect(checkEnv({ ...valid, EMAIL_MODE: "maybe" }).errors).toHaveLength(1);
    expect(checkEnv({ ...valid, EMAIL_MODE: "live", EMAIL_PROVIDER: "smtp" }).errors).toHaveLength(1);
  });

  it("warns, but does not fail, without a Gemini key", () => {
    const report = checkEnv(valid);
    expect(report.warnings.join("\n")).toContain("GEMINI_API_KEY");
    expect(report.errors).toEqual([]);
  });
});

describe("assertEnv", () => {
  it("throws one message listing every problem", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => assertEnv({})).toThrow(/Missing or invalid environment variables[\s\S]*DATABASE_URL[\s\S]*AUTH_SECRET/);
    expect(() => assertEnv(valid)).not.toThrow();
  });
});
