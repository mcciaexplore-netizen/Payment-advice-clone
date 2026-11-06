import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as null | { fullName: string; roles: string[] },
  status: { configured: false } as Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/lib/admin-session", () => ({ getAdminSession: async () => mocks.session }));
vi.mock("@/lib/gemini-key", () => ({ getGeminiKeyStatus: async () => mocks.status }));
vi.mock("@/lib/modules", () => ({ requireModule: () => undefined }));

import AiAutofillPage from "@/app/admin/ai-autofill/page";

const render = async () => renderToStaticMarkup(await AiAutofillPage());

describe("Admin > AI Auto-fill page", () => {
  beforeEach(() => {
    mocks.session = { fullName: "Demo Admin", roles: ["ALL"] };
    mocks.status = { configured: false };
  });

  it("explains how to get a free key and offers a field to paste it", async () => {
    const html = await render();
    expect(html).toContain("How to get a free Gemini API key");
    expect(html).toContain('href="https://aistudio.google.com/apikey"');
    expect(html).toContain("Create API key");
    expect(html).toContain('id="gemini-api-key"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Save &amp; test");
    expect(html).toContain("Invoice auto-fill is OFF");
    expect(html).not.toContain("Remove saved key");
  });

  it("shows the saved key's last four characters only, with a remove option", async () => {
    mocks.status = { configured: true, source: "admin", last4: "cdef", updatedAt: "2026-11-06T05:00:00.000Z", updatedBy: "Demo Admin" };
    const html = await render();
    expect(html).toContain("Invoice auto-fill is ON");
    expect(html).toContain("ending in cdef");
    expect(html).toContain("Remove saved key");
    expect(html).toContain("Replace the saved key");
  });

  it("tells a server-set key apart from an admin-saved one", async () => {
    mocks.status = { configured: true, source: "environment", last4: "9999", updatedAt: null, updatedBy: null };
    const html = await render();
    expect(html).toContain("set by the server administrator");
    expect(html).not.toContain("Remove saved key");
  });

  it("shows nothing but a notice to logins without full access", async () => {
    mocks.session = { fullName: "Ravi Sample", roles: ["PAYMENT_ADVICE"] };
    const html = await render();
    expect(html).toContain("Only a full-access Finance login");
    expect(html).not.toContain("gemini-api-key");
  });

  it("is linked from the admin menu for full-access logins only", () => {
    const nav = readFileSync("components/admin/AdminNav.tsx", "utf8");
    const layout = readFileSync("app/admin/layout.tsx", "utf8");
    expect(nav).toContain('href: "/admin/ai-autofill"');
    expect(nav).toContain("showAiAutofill ? (");
    expect(layout).toContain('showAiAutofill={hasRole(session, "ALL") && isModuleEnabled("paymentAdvice")}');
  });

  it("the invoice auto-fill route reads the saved key (not only the environment)", () => {
    const route = readFileSync("app/api/invoice-autofill/route.ts", "utf8");
    expect(route).toContain("await getGeminiApiKey()");
    expect(route).not.toContain("process.env.GEMINI_API_KEY");
    void createElement;
  });
});
