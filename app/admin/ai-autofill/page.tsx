import { getAdminSession } from "@/lib/admin-session";
import { hasRole } from "@/lib/auth";
import { getGeminiKeyStatus } from "@/lib/gemini-key";
import { requireModule } from "@/lib/modules";
import { GeminiKeyForm } from "@/components/admin/GeminiKeyForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Auto-fill" };

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Open Google AI Studio",
    body: (
      <>
        Go to{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">
          aistudio.google.com/apikey
        </a>{" "}
        and sign in with a Google account. (Some company Google Workspace accounts block this page; use a personal Google account if so.)
      </>
    ),
  },
  { title: "Accept the terms", body: "If Google asks you to agree to its terms the first time, accept them." },
  {
    title: "Create the key",
    body: (
      <>
        Click <b>Create API key</b>, then choose <b>Create API key in new project</b> (or pick an existing project).
      </>
    ),
  },
  {
    title: "Copy it",
    body: (
      <>
        Copy the long key that appears. It usually starts with <code className="rounded bg-gray-100 px-1">AIza</code>.
      </>
    ),
  },
  {
    title: "Paste it here",
    body: (
      <>
        Paste it into the box on this page and press <b>Save &amp; test</b>. We check it with Google and, if it works, invoice auto-fill switches on straight
        away. Nothing else to set up.
      </>
    ),
  },
];

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "";
}

export default async function AiAutofillPage() {
  requireModule("paymentAdvice");
  const session = await getAdminSession();
  if (!hasRole(session, "ALL")) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl text-brand">AI Auto-fill</h1>
        <p className="text-sm text-gray-600">Only a full-access Finance login can manage this setting.</p>
      </div>
    );
  }
  const status = await getGeminiKeyStatus();

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl text-brand">AI Auto-fill</h1>
        <p className="mt-1 text-sm text-gray-600">
          When someone attaches a tax invoice to a Payment Advice, Google&apos;s Gemini can read it and pre-fill the bill number, date, amounts and bank
          details. It needs a Gemini API key, and you can get one for free in a couple of minutes.
        </p>
      </div>

      <section
        aria-label="Status"
        className={`rounded-lg border px-5 py-4 text-sm ${status.configured ? "border-forest/30 bg-forest/5 text-forest" : "border-amber/40 bg-amber/10 text-brand"}`}
      >
        {status.configured ? (
          <>
            <p className="font-medium">Invoice auto-fill is ON.</p>
            <p className="mt-1">
              {status.source === "admin"
                ? `Using the key ending in ${status.last4}, saved by ${status.updatedBy ?? "an admin"} on ${when(status.updatedAt)}.`
                : `Using the key ending in ${status.last4} set by the server administrator. A key saved below takes priority over it.`}
            </p>
          </>
        ) : (
          <p className="font-medium">
            Invoice auto-fill is OFF. Forms still work; people just type the invoice details themselves. Add a key below to switch it on.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-heading text-xl text-brand">How to get a free Gemini API key</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3 text-sm text-gray-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{index + 1}</span>
              <span>
                <b className="text-brand">{step.title}.</b> {step.body}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-heading text-xl text-brand">Your key</h2>
        <div className="mt-4">
          <GeminiKeyForm hasSavedKey={status.configured && status.source === "admin"} />
        </div>
      </section>

      <section className="rounded-md bg-gray-50 px-5 py-4 text-xs leading-5 text-gray-600">
        <p>
          <b>Good to know</b>
        </p>
        <ul className="mt-1 list-disc pl-5">
          <li>The free plan has daily limits, which is plenty for normal use. If it runs out, auto-fill pauses and people fill the form manually.</li>
          <li>
            On Google&apos;s free plan, Google may use what is sent to improve its products. If your invoices are sensitive, use a key from a project with
            billing enabled instead. See{" "}
            <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="underline">
              Google&apos;s Gemini API terms
            </a>
            .
          </li>
          <li>The key is stored encrypted and is never shown again, only its last four characters. Anyone with a full-access Finance login can replace or remove it.</li>
          <li>
            Changing the server&apos;s <code>AUTH_SECRET</code> makes a saved key unreadable; just paste it again.
          </li>
        </ul>
      </section>
    </div>
  );
}
