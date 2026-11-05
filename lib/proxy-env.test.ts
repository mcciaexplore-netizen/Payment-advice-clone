import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID = {
  DATABASE_URL: "postgres://user:pw@host.example/db",
  AUTH_SECRET: "x".repeat(32),
  BLOB_READ_WRITE_TOKEN: "token",
};

async function loadProxy(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of ["DATABASE_URL", "AUTH_SECRET", "BLOB_READ_WRITE_TOKEN", "EMAIL_MODE"]) vi.stubEnv(key, env[key] as string);
  return (await import("@/proxy")).proxy;
}
const request = (path: string) => new NextRequest(`https://app.example${path}`);

describe("proxy environment check", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("answers 503 with the missing variable names on pages, without leaking values", async () => {
    const proxy = await loadProxy({ ...VALID, DATABASE_URL: "" });
    const response = await proxy(request("/advance"));
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain("DATABASE_URL");
    expect(text).not.toContain("postgres://");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 503 JSON on API routes, including public ones", async () => {
    const proxy = await loadProxy({ ...VALID, AUTH_SECRET: "" });
    const response = await proxy(request("/api/vendors/search?q=a"));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("AUTH_SECRET");
  });

  it("lets public pages through when configured, and still guards admin routes", async () => {
    const proxy = await loadProxy(VALID);
    const open = await proxy(request("/advance"));
    expect(open.status).toBe(200);
    expect(open.headers.get("x-middleware-next")).toBe("1");
    const guarded = await proxy(request("/admin/submissions"));
    expect(guarded.status).toBe(302);
    expect(guarded.headers.get("location")).toContain("/admin/login");
    const api = await proxy(request("/api/admin/export"));
    expect(api.status).toBe(401);
  });
});
