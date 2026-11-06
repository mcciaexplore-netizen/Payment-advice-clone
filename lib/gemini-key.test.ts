import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: [] as Array<{ value: string; updatedAt: Date; updatedBy: string | null }>, dbError: false, generate: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            if (mocks.dbError) throw new Error("relation app_settings does not exist");
            return mocks.rows;
          },
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/db/schema", () => ({ appSettings: { key: "key", value: "value" } }));
vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: mocks.generate }; } }));

import { encryptSecret } from "@/lib/secret-box";
import { getGeminiApiKey, getGeminiKeyStatus, looksLikeGeminiKey, testGeminiKey } from "@/lib/gemini-key";

describe("secret-box", () => {
  beforeEach(() => vi.stubEnv("AUTH_SECRET", "a".repeat(40)));
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips, never stores the plain text, and uses a fresh IV each time", async () => {
    const { decryptSecret } = await import("@/lib/secret-box");
    const first = encryptSecret("AIzaSecretKeyValue1234567890");
    expect(first).not.toContain("AIzaSecret");
    expect(first).not.toBe(encryptSecret("AIzaSecretKeyValue1234567890"));
    expect(decryptSecret(first)).toBe("AIzaSecretKeyValue1234567890");
  });

  it("returns null for tampered values and for a different AUTH_SECRET", async () => {
    const { decryptSecret } = await import("@/lib/secret-box");
    const stored = encryptSecret("AIzaSecretKeyValue1234567890");
    expect(decryptSecret(stored.slice(0, -4) + "AAAA")).toBeNull();
    expect(decryptSecret("garbage")).toBeNull();
    vi.stubEnv("AUTH_SECRET", "b".repeat(40));
    expect(decryptSecret(stored)).toBeNull();
  });
});

describe("Gemini key lookup", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "a".repeat(40));
    vi.stubEnv("GEMINI_API_KEY", "");
    mocks.rows = [];
    mocks.dbError = false;
    mocks.generate.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  const saved = (key: string) => ({ value: encryptSecret(key), updatedAt: new Date("2026-11-06T05:00:00Z"), updatedBy: "Demo Admin" });

  it("accepts plausible keys only", () => {
    expect(looksLikeGeminiKey("AIzaSyA-1234567890abcdefghijklmnop")).toBe(true);
    expect(looksLikeGeminiKey("short")).toBe(false);
    expect(looksLikeGeminiKey("has space in the middle of a long key 123456")).toBe(false);
  });

  it("is off when neither a saved key nor the environment variable exists", async () => {
    expect(await getGeminiApiKey()).toBeNull();
    expect(await getGeminiKeyStatus()).toEqual({ configured: false });
  });

  it("uses the key saved by an admin, ahead of the environment variable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "AIzaFromEnvironment0000000000");
    mocks.rows = [saved("AIzaSavedByAdmin000000000001")];
    expect(await getGeminiApiKey()).toBe("AIzaSavedByAdmin000000000001");
    expect(await getGeminiKeyStatus()).toMatchObject({ configured: true, source: "admin", last4: "0001", updatedBy: "Demo Admin" });
  });

  it("falls back to the environment variable when nothing is saved, the table is missing, or the value is unreadable", async () => {
    vi.stubEnv("GEMINI_API_KEY", "AIzaFromEnvironment0000000000");
    expect(await getGeminiApiKey()).toBe("AIzaFromEnvironment0000000000");
    expect(await getGeminiKeyStatus()).toMatchObject({ configured: true, source: "environment", last4: "0000" });
    mocks.dbError = true;
    expect(await getGeminiApiKey()).toBe("AIzaFromEnvironment0000000000");
    mocks.dbError = false;
    mocks.rows = [{ value: "v1:broken:broken:broken", updatedAt: new Date(), updatedBy: null }];
    expect(await getGeminiApiKey()).toBe("AIzaFromEnvironment0000000000");
  });

  it("tests a key: ok, invalid, out of quota, or unreachable", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "OK" });
    expect(await testGeminiKey("AIzaSomeKey0000000000000000")).toEqual({ ok: true });
    mocks.generate.mockRejectedValueOnce(new Error('{"error":{"code":400,"message":"API key not valid. Please pass a valid API key."}}'));
    expect(await testGeminiKey("AIzaBad000000000000000000000")).toMatchObject({ ok: false, invalid: true });
    mocks.generate.mockRejectedValueOnce(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'));
    expect(await testGeminiKey("AIzaQuota0000000000000000")).toMatchObject({ ok: true, note: expect.stringContaining("quota") });
    mocks.generate.mockRejectedValueOnce(new Error("fetch failed"));
    expect(await testGeminiKey("AIzaNet000000000000000000")).toMatchObject({ ok: false, invalid: false });
  });
});
