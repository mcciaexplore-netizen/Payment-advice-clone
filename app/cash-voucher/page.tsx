import type { Metadata } from "next";
import { PublicSubmissionPage } from "@/components/public/PublicSubmissionPage";
import { requireModule } from "@/lib/modules";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cash Payment Voucher" };
export default function Page() {
  requireModule("cashVoucher");
  return <PublicSubmissionPage type="cash-voucher" />;
}
