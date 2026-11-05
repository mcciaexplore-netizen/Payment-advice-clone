import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { hasCashReceiptRole } from "@/lib/auth";
import { CashReceiptLoginForm } from "@/components/account/CashReceiptLoginForm";
import { requireModule } from "@/lib/modules";

export default async function CashReceiptLoginPage() {
  requireModule("cashReceipt");
  const session = await getAdminSession();
  if (session?.branchScope && hasCashReceiptRole(session)) redirect("/cash-receipt");
  return <CashReceiptLoginForm />;
}
