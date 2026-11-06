import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-session";
import { hasRole } from "@/lib/auth";
import { getGeminiKeyStatus, looksLikeGeminiKey, removeGeminiKey, saveGeminiKey, testGeminiKey } from "@/lib/gemini-key";
import { moduleDisabledResponse } from "@/lib/modules";
import { clientIpFrom, createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Each save makes a (free) call to Google, so it is throttled per IP per warm instance. */
const isRateLimited = createRateLimiter({ limit: 15, windowMs: 10 * 60 * 1000 });

const bodySchema = z.object({ apiKey: z.string().trim() });

/** Only the full-access Finance login may see or change this; the key itself is never returned. */
async function authorise() {
  const disabled = moduleDisabledResponse("paymentAdvice");
  if (disabled) return { error: disabled };
  const session = await getAdminSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!hasRole(session, "ALL")) return { error: NextResponse.json({ error: "Only a full-access Finance login can change this setting." }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const auth = await authorise();
  if (auth.error) return auth.error;
  return NextResponse.json(await getGeminiKeyStatus());
}

export async function PUT(req: NextRequest) {
  const auth = await authorise();
  if (auth.error) return auth.error;
  if (isRateLimited(clientIpFrom(req.headers))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !looksLikeGeminiKey(parsed.data.apiKey)) {
    return NextResponse.json({ error: "That does not look like a Gemini API key. Paste the whole key (it usually starts with AIza)." }, { status: 400 });
  }
  const test = await testGeminiKey(parsed.data.apiKey);
  if (!test.ok) return NextResponse.json({ error: test.message }, { status: test.invalid ? 400 : 502 });
  await saveGeminiKey(parsed.data.apiKey, auth.session.fullName);
  return NextResponse.json({ ...(await getGeminiKeyStatus()), note: test.note ?? null });
}

export async function DELETE() {
  const auth = await authorise();
  if (auth.error) return auth.error;
  await removeGeminiKey();
  return NextResponse.json(await getGeminiKeyStatus());
}
