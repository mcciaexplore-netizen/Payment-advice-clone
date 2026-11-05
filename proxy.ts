import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, decodeAdminSessionToken, hasFinanceRole, hasTeamDashboardRole } from "@/lib/auth";
import { checkEnv } from "@/lib/env";

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);
const PUBLIC_AUTHORITY_PATHS = new Set(["/authority/login", "/api/authority/login"]);
const PUBLIC_TEAM_PATHS = new Set(["/team/login", "/api/team/login"]);

// Paths that need a signed-in session (everything else is public).
const GUARDED_PREFIXES = ["/admin", "/api/admin", "/authority", "/api/authority", "/team", "/api/team", "/api/account"];
const isGuarded = (pathname: string) => GUARDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// Environment variables cannot change while an instance runs, so check once.
// This runs on every request (unlike the startup hook, which hosting platforms
// may not surface), so a missing variable shows a clear message instead of a
// generic server error. It lists variable names only, never values.
let envErrors: string[] | undefined;
function misconfiguredResponse(req: NextRequest): NextResponse | null {
  envErrors ??= checkEnv().errors;
  if (envErrors.length === 0) return null;
  const message = ["This deployment is not configured yet. Missing or invalid environment variables:", ...envErrors.map((error) => ` - ${error}`), "See .env.example and SETUP_GUIDE.md."].join("\n");
  const headers = { "Cache-Control": "no-store" };
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: message }, { status: 503, headers });
  }
  return new NextResponse(message, { status: 503, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const misconfigured = misconfiguredResponse(req);
  if (misconfigured) return misconfigured;
  if (!isGuarded(pathname)) return NextResponse.next();
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await decodeAdminSessionToken(token) : null;
  const isAuthorityPath = pathname === "/authority" || pathname.startsWith("/authority/") || pathname.startsWith("/api/authority/");

  // Shared account-management routes (e.g. Change Password) — any signed-in
  // admin_users session may use these regardless of role, unlike
  // /api/admin/* (Finance-only) and /api/authority/* (Authority-only) below.
  if (pathname.startsWith("/api/account/")) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (PUBLIC_AUTHORITY_PATHS.has(pathname)) {
    if (pathname === "/authority/login" && session?.roles.includes("AUTHORITY")) {
      return NextResponse.redirect(new URL("/authority", req.url), 302);
    }
    return NextResponse.next();
  }

  if (PUBLIC_TEAM_PATHS.has(pathname)) {
    if (pathname === "/team/login" && session?.roles.some((role) => role === "BRANCH" || role === "DEPARTMENT")) {
      return NextResponse.redirect(new URL("/authority", req.url), 302);
    }
    return NextResponse.next();
  }

  if (isAuthorityPath) {
    if (!hasTeamDashboardRole(session)) {
      if (pathname.startsWith("/api/authority/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/authority/login", req.url), 302);
    }
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    if (pathname === "/admin/login" && hasFinanceRole(session)) {
      return NextResponse.redirect(new URL("/admin", req.url), 302);
    }
    return NextResponse.next();
  }

  if (!hasFinanceRole(session)) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl, 302);
  }

  return NextResponse.next();
}

export const config = {
  // Every page and API route (so the environment check covers them all), but not
  // static files such as /_next assets, the logo, icons or the MSME documents.
  matcher: ["/((?!_next/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|pdf|docx|webmanifest|txt)$).*)"],
};
