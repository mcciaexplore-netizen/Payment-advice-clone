import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { hasCashReceiptRole } from "@/lib/auth";
import { CashReceiptForm } from "@/components/form/CashReceiptForm";
import { requireModule } from "@/lib/modules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cash Receipt" };

export default async function CashReceiptPage() {
  requireModule("cashReceipt");
  const session = await getAdminSession();
  if (!session?.branchScope || !hasCashReceiptRole(session)) redirect("/cash-receipt/login");
  return <CashReceiptForm branch={session.branchScope} issuedBy={session.fullName} />;
}
