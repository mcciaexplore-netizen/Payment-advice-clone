import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { RefundForm } from "@/components/form/RefundForm";
import { PublicLoginMenu } from "@/components/public/PublicLoginMenu";
import { db } from "@/lib/db";
import { recommendingAuthorities } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { refundEntryVisible } from "@/lib/refund-requests";
import { LOGO_PATH, APP_NAME, DEPARTMENT_NAME } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function RefundPage() {
  if (!refundEntryVisible()) notFound();
  let authorities: string[] = [];
  try {
    authorities = (await db.select({ authorityName: recommendingAuthorities.authorityName })
      .from(recommendingAuthorities)
      .where(eq(recommendingAuthorities.isActive, true))).map((authority) => authority.authorityName);
  } catch (error) {
    console.warn("[Refund] recommending authority lookup unavailable", error);
  }
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="relative flex flex-wrap items-start gap-4 border-b border-gray-200 pb-6">
        <div className="flex min-w-0 items-center gap-4 sm:pr-32">
          <Image src={LOGO_PATH} alt="Organisation logo" width={1085} height={258} className="h-14 w-auto" />
          <div><h1 className="font-heading text-3xl text-brand">Refund Request</h1><p className="text-sm text-gray-600">{APP_NAME} - {DEPARTMENT_NAME}</p></div>
        </div>
        <PublicLoginMenu />
      </header>
      <Link href="/" className="w-fit text-sm font-medium text-gray-600 hover:text-brand">← Back to {APP_NAME}</Link>
      <RefundForm authorityOptions={authorities} persist />
    </main>
  );
}
