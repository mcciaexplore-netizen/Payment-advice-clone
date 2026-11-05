export async function register() {
  // Only when a server actually starts: not while `next build` collects routes
  // (the build machine may not have runtime secrets), and not on the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertEnv } = await import("./lib/env");
  assertEnv();
}
