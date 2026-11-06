import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { fullName: string; roles: string[] },
  test: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  status: vi.fn(),
  moduleOff: null as null | Response,
}));

vi.mock("@/lib/admin-session", () => ({ getAdminSession: async () => mocks.session }));
vi.mock("@/lib/modules", () => ({ moduleDisabledResponse: () => mocks.moduleOff }));
vi.mock("@/lib/gemini-key", () => ({
  looksLikeGeminiKey: (value: string) => /^[A-Za-z0-9_-]{20,200}$/.test(value),
  testGeminiKey: mocks.test,
  saveGeminiKey: mocks.save,
  removeGeminiKey: mocks.remove,
  getGeminiKeyStatus: mocks.status,
}));

import { DELETE, GET, PUT } from "@/app/api/admin/settings/gemini/route";

const KEY = "AIzaSyExampleKey1234567890abcdef";
const put = (body: unknown, ip = "203.0.113.5") =>
  new NextRequest("https://app.example/api/admin/settings/gemini", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

describe("/api/admin/settings/gemini", () => {
  beforeEach(() => {
    mocks.session = { fullName: "Demo Admin", roles: ["ALL"] };
    mocks.moduleOff = null;
    mocks.test.mockReset().mockResolvedValue({ ok: true });
    mocks.save.mockReset().mockResolvedValue(undefined);
    mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.status.mockReset().mockResolvedValue({ configured: true, source: "admin", last4: "cdef", updatedAt: "2026-11-06T05:00:00.000Z", updatedBy: "Demo Admin" });
  });

  it("requires a signed-in full-access Finance login", async () => {
    mocks.session = null;
    expect((await GET()).status).toBe(401);
    mocks.session = { fullName: "Ravi Sample", roles: ["PAYMENT_ADVICE"] };
    expect((await GET()).status).toBe(403);
    expect((await PUT(put({ apiKey: KEY }))).status).toBe(403);
    expect((await DELETE()).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("is switched off with the Payment Advice module", async () => {
    mocks.moduleOff = new Response(null, { status: 404 });
    expect((await GET()).status).toBe(404);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("status never contains the key", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain("AIzaSy");
  });

  it("rejects values that do not look like a key without calling Google", async () => {
    expect((await PUT(put({ apiKey: "nope" }))).status).toBe(400);
    expect((await PUT(put({}))).status).toBe(400);
    expect(mocks.test).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("does not save a key Google rejects, or one it could not check", async () => {
    mocks.test.mockResolvedValueOnce({ ok: false, invalid: true, message: "Google did not accept this key." });
    const rejected = await PUT(put({ apiKey: KEY }, "203.0.113.6"));
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).error).toContain("did not accept");
    mocks.test.mockResolvedValueOnce({ ok: false, invalid: false, message: "Could not reach Google." });
    expect((await PUT(put({ apiKey: KEY }, "203.0.113.6"))).status).toBe(502);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves a working key, attributed to the admin, and returns status only", async () => {
    const response = await PUT(put({ apiKey: `  ${KEY}  ` }, "203.0.113.7"));
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(KEY, "Demo Admin");
    const body = await response.json();
    expect(body).toMatchObject({ configured: true, source: "admin", last4: "cdef" });
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it("removes the saved key", async () => {
    expect((await DELETE()).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("throttles repeated attempts from one address", async () => {
    let last = 200;
    for (let i = 0; i < 17; i++) last = (await PUT(put({ apiKey: "nope" }, "198.51.100.77"))).status;
    expect(last).toBe(429);
  });
});
