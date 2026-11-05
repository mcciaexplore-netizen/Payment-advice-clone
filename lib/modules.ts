import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { isModuleEnabled, type ModuleKey } from "@/lib/config";

/** For server-rendered pages: a disabled module behaves as if the route does not exist. */
export function requireModule(module: ModuleKey): void {
  if (!isModuleEnabled(module)) notFound();
}

/** For API routes: returns a 404 response when the module is disabled, else null. */
export function moduleDisabledResponse(module: ModuleKey): NextResponse | null {
  if (isModuleEnabled(module)) return null;
  return NextResponse.json({ error: "This module is not enabled." }, { status: 404 });
}

/**
 * Payment Advice, Cash Voucher and Advance share one form and one submit API;
 * this maps a submission onto the module that governs it.
 */
export function paymentAdviceModuleFor(paymentMode: "NEFT" | "CASH", isAdvance: boolean): ModuleKey {
  if (isAdvance) return "advance";
  return paymentMode === "CASH" ? "cashVoucher" : "paymentAdvice";
}
