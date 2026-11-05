import type { Metadata } from "next";
import { PublicSubmissionPage } from "@/components/public/PublicSubmissionPage";
import { requireModule } from "@/lib/modules";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment Advice" };
export default function Page() {
  requireModule("paymentAdvice");
  return <PublicSubmissionPage type="payment-advice" />;
}
