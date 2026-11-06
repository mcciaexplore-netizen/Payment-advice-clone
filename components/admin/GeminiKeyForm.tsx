"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base text-[#171717] shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function GeminiKeyForm({ hasSavedKey }: { hasSavedKey: boolean }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function request(method: "PUT" | "DELETE") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings/gemini", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ apiKey }) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Could not save the key. Please try again.");
        return;
      }
      setApiKey("");
      setVisible(false);
      setMessage(method === "PUT" ? data?.note ?? "Saved. Invoice auto-fill is now switched on." : "The saved key was removed.");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void request("PUT");
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-brand" htmlFor="gemini-api-key">
        {hasSavedKey ? "Replace the saved key" : "Paste your Gemini API key"}
        <div className="relative">
          <input
            id="gemini-api-key"
            type={visible ? "text" : "password"}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value.trim())}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} pr-16 font-mono`}
          />
          <button
            type="button"
            aria-controls="gemini-api-key"
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
            className="absolute inset-y-0 right-3 text-sm font-normal text-gray-600 underline"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      </label>
      {error ? (
        <p role="alert" className="rounded-md border border-[#b3261e]/30 bg-[#b3261e]/5 px-4 py-3 text-sm font-medium text-[#b3261e]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-md border border-forest/30 bg-forest/5 px-4 py-3 text-sm font-medium text-forest">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || apiKey.length === 0}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
        >
          {busy ? "Checking with Google…" : "Save & test"}
        </button>
        {hasSavedKey ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Remove the saved key? Invoice auto-fill will switch off unless the server has its own key.")) void request("DELETE");
            }}
            className="text-sm font-medium text-[#b3261e] underline disabled:opacity-50"
          >
            Remove saved key
          </button>
        ) : null}
      </div>
    </form>
  );
}
