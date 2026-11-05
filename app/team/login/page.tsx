import { DashboardLoginForm } from "@/components/account/DashboardLoginForm";
import { isModuleEnabled } from "@/lib/config";

export default function TeamLoginPage() {
  return (
    <DashboardLoginForm
      title="Team Dashboard"
      description="Sign in to track your submissions and team activity."
      endpoint="/api/team/login"
      fieldPrefix="team"
      footerLink={isModuleEnabled("cashReceipt") ? { href: "/cash-receipt/login", label: "Sign in there", lead: "Need to issue a Cash Receipt instead? It works with the same account." } : undefined}
    />
  );
}
