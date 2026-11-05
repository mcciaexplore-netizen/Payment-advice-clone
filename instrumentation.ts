export async function register() {
  // Only when a server actually starts: not while `next build` collects routes
  // (the build machine may not have runtime secrets), and not on the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { checkEnv } = await import("./lib/env");
  const { errors, warnings } = checkEnv();
  for (const warning of warnings) console.warn(`[env] ${warning}`);
  // Log loudly but keep running: proxy.ts then answers every request with a
  // 503 that names the problem, which is visible to whoever is setting up the
  // deployment (a crashed server only shows a generic error page).
  if (errors.length) console.error(`[env] Missing or invalid environment variables:\n - ${errors.join("\n - ")}\nSee .env.example.`);
}
