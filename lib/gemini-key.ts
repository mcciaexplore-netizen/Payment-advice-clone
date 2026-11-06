import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";

/** The model used for invoice auto-fill (and to test a newly entered key). */
export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_SETTING_KEY = "gemini_api_key";

export type GeminiKeyStatus =
  | { configured: false }
  | { configured: true; source: "admin" | "environment"; last4: string; updatedAt: string | null; updatedBy: string | null };

/** Loose shape check only; Google decides whether a key really works (see testGeminiKey). */
export function looksLikeGeminiKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,200}$/.test(value);
}

/**
 * The key saved by an admin (Admin > AI Auto-fill) wins over the optional
 * GEMINI_API_KEY environment variable. A missing table, unreadable value or
 * database error simply falls back to the environment variable.
 */
export async function getGeminiApiKey(): Promise<string | null> {
  try {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, GEMINI_SETTING_KEY)).limit(1);
    const saved = row ? decryptSecret(row.value) : null;
    if (saved) return saved;
  } catch (error) {
    console.warn("Saved Gemini key unavailable, using environment variable", error instanceof Error ? error.message : error);
  }
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export async function getGeminiKeyStatus(): Promise<GeminiKeyStatus> {
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, GEMINI_SETTING_KEY)).limit(1);
    const saved = row ? decryptSecret(row.value) : null;
    if (row && saved) {
      return { configured: true, source: "admin", last4: saved.slice(-4), updatedAt: row.updatedAt.toISOString(), updatedBy: row.updatedBy };
    }
  } catch {
    // fall through to the environment variable
  }
  const fromEnv = process.env.GEMINI_API_KEY?.trim();
  return fromEnv ? { configured: true, source: "environment", last4: fromEnv.slice(-4), updatedAt: null, updatedBy: null } : { configured: false };
}

export async function saveGeminiKey(apiKey: string, updatedBy: string): Promise<void> {
  const value = encryptSecret(apiKey);
  await db
    .insert(appSettings)
    .values({ key: GEMINI_SETTING_KEY, value, updatedBy })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy, updatedAt: new Date() } });
}

export async function removeGeminiKey(): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, GEMINI_SETTING_KEY));
}

export type GeminiKeyTest = { ok: true; note?: string } | { ok: false; invalid: boolean; message: string };

/** Makes one tiny request with the key, so a typo or a revoked key is caught before saving. */
export async function testGeminiKey(apiKey: string): Promise<GeminiKeyTest> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({ model: GEMINI_MODEL, contents: "Reply with OK.", config: { maxOutputTokens: 16, temperature: 0 } });
    return { ok: true };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/API key not valid|API_KEY_INVALID|\b(400|401|403)\b|PERMISSION_DENIED|UNAUTHENTICATED/i.test(text)) {
      return { ok: false, invalid: true, message: "Google did not accept this key. Check that you copied all of it, or create a new one." };
    }
    if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(text)) {
      return { ok: true, note: "Google says this key is out of free quota right now. It was saved and will work again once the quota resets." };
    }
    return { ok: false, invalid: false, message: "Could not reach Google to check the key. Try again in a minute." };
  }
}
