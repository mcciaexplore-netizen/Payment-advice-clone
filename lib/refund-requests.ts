import { isModuleEnabled } from "@/lib/config";

/** Refund requests are switched on/off with `modules.refund` in
 * config/org.config.ts. (Previously an env flag, REFUND_REQUESTS_ENABLED.) */
export function refundRequestsEnabled(): boolean {
  return isModuleEnabled("refund");
}

/** Whether the home card and /refund page are shown. */
export function refundEntryVisible(): boolean {
  return isModuleEnabled("refund");
}
