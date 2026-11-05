"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { todayInIst } from "@/lib/date-time";
import { LOGO_PATH } from "@/lib/branding";
import { CASH_RECEIPT_ITEMS, composeParticulars, findCashReceiptItem } from "@/lib/cash-receipt-items";

type ReceiptLine = {
  id: number;
  particulars: string;
  detail: string;
  courseName: string;
  choice: string;
  memberNo: string;
  copies: string;
  price: string;
  billNo: string;
  billDate: string;
};

const blankLine = (id: number): ReceiptLine => ({
  id, particulars: "", detail: "", courseName: "", choice: "", memberNo: "", copies: "", price: "", billNo: "", billDate: "",
});

function lineAmount(line: ReceiptLine) {
  const price = Number(line.price) || 0;
  return findCashReceiptItem(line.particulars)?.amountOnly ? price : (Number(line.copies) || 0) * price;
}

function choicePrice(particulars: string, choice: string) {
  const price = findCashReceiptItem(particulars)?.choices?.find((entry) => entry.label === choice)?.price;
  return price === undefined ? "" : String(price);
}

const inputClass = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-[#152235] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function CashReceiptForm({ branch, issuedBy }: { branch: string; issuedBy: string }) {
  const router = useRouter();
  const [partyName, setPartyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [lines, setLines] = useState<ReceiptLine[]>([blankLine(1)]);
  const [nextId, setNextId] = useState(2);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + lineAmount(line), 0),
    [lines],
  );

  function updateLine(id: number, field: keyof Omit<ReceiptLine, "id">, value: string) {
    setLines((current) => current.map((line) => {
      if (line.id !== id) return line;
      let updated = { ...line, [field]: value };
      if (field === "particulars") {
        updated = { ...updated, choice: "", memberNo: "", courseName: "", price: "" };
      } else if (field === "choice") {
        const item = findCashReceiptItem(updated.particulars);
        if (!item?.choices?.find((entry) => entry.label === value)?.askId) updated.memberNo = "";
        if (item?.choices) updated.price = choicePrice(updated.particulars, updated.choice);
      }
      return updated;
    }));
  }

  function addLine() {
    if (lines.length >= 20) return;
    setLines((current) => [...current, blankLine(nextId)]);
    setNextId((value) => value + 1);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const hasPartialLine = lines.some((line) => {
      const hasAnyValue = line.particulars || line.copies || line.price || line.courseName.trim();
      const item = findCashReceiptItem(line.particulars);
      const choiceInfoMissing = !!item?.choices &&
        (!line.choice || (!!item.choices.find((entry) => entry.label === line.choice)?.askId && !line.memberNo.trim()));
      const nameInfoMissing = !!item?.askName && !line.courseName.trim();
      return (hasAnyValue && (!line.particulars || (!item?.amountOnly && Number(line.copies) <= 0) || Number(line.price) <= 0)) || choiceInfoMissing || nameInfoMissing;
    });
    if (hasPartialLine) {
      setError("Complete the particulars, required details, and price for each row, or leave the row empty.");
      return;
    }
    const filledLines = lines.filter((line) => line.particulars && (findCashReceiptItem(line.particulars)?.amountOnly || Number(line.copies) > 0) && Number(line.price) > 0);
    if (!filledLines.length) {
      setError("Add at least one particulars row with a price.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/cash-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyName,
          gstin,
          items: filledLines.map((line) => ({
            particulars: composeParticulars(findCashReceiptItem(line.particulars)!, { choice: line.choice, id: line.memberNo, name: line.courseName, detail: line.detail }),
            copies: findCashReceiptItem(line.particulars)?.amountOnly ? 1 : Number(line.copies),
            price: Number(line.price),
            billNo: line.billNo,
            billDate: line.billDate,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save the receipt.");
        return;
      }
      router.push(`/cash-receipt/${data.id}`);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
      <div className="flex items-center gap-4"><Image src={LOGO_PATH} alt="Organisation logo" width={1085} height={258} className="h-12 w-auto" /><div><h1 className="font-heading text-2xl text-brand">Cash Receipt</h1><p className="text-sm text-gray-600">{branch}</p></div></div>
      <div className="flex items-center gap-4 text-sm text-gray-600"><span>{issuedBy}</span><button type="button" onClick={async () => { await fetch("/api/cash-receipt/logout", { method: "POST" }); router.replace("/cash-receipt/login"); router.refresh(); }} className="text-brand underline">Sign out</button></div>
    </header>
    <form onSubmit={submit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap justify-between gap-4 text-sm"><p className="font-medium text-brand">Receipt No.: <span className="text-gray-500">Assigned on saving</span></p><p className="font-medium text-brand">Date: <span className="text-gray-700">{todayInIst()}</span></p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-brand">M/s - Party Name<input required value={partyName} onChange={(event) => setPartyName(event.target.value)} className={`${inputClass} mt-1 font-normal`} /></label>
        <label className="text-sm font-medium text-brand">GSTIN (optional)<input value={gstin} onChange={(event) => setGstin(event.target.value.toUpperCase())} maxLength={15} className={`${inputClass} mt-1 font-normal`} /></label>
      </div>
      <div className="overflow-x-auto rounded-md border border-gray-300">
        <table className="w-full min-w-[740px] border-collapse text-sm">
          <thead className="bg-gray-100 text-brand"><tr><th className="w-[50%] border-b border-r border-gray-300 px-3 py-3 text-left">Particulars</th><th className="w-[14%] border-b border-r border-gray-300 px-3 py-3 text-left">Copies</th><th className="w-[16%] border-b border-r border-gray-300 px-3 py-3 text-left">Price</th><th className="w-[20%] border-b border-gray-300 px-3 py-3 text-right">Amount (Rs.)</th></tr></thead>
          <tbody>
            {lines.map((line) => {
              const item = findCashReceiptItem(line.particulars);
              const isHallHiring = !!item?.amountOnly;
              const idLabel = item?.choices?.find((entry) => entry.label === line.choice)?.askId;
              const amount = lineAmount(line);
              return <tr key={line.id}>
                <td className="border-b border-r border-gray-300 p-2">
                  <select aria-label="Particulars" value={line.particulars} onChange={(event) => updateLine(line.id, "particulars", event.target.value)} className={inputClass}>
                    <option value="">Select particulars</option>
                    {CASH_RECEIPT_ITEMS.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
                  </select>
                  {item?.choices ? <div className="mt-2 grid gap-2">
                    <select aria-label="Item type" value={line.choice} onChange={(event) => updateLine(line.id, "choice", event.target.value)} className={inputClass}>
                      <option value="">Select one</option>
                      {item.choices.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
                    </select>
                    {idLabel ? <input aria-label={idLabel} required maxLength={100} placeholder={idLabel} value={line.memberNo} onChange={(event) => updateLine(line.id, "memberNo", event.target.value)} className={inputClass} /> : null}
                  </div> : null}
                  {item?.askDetail ? <input aria-label="Specify other particulars" placeholder="Specify" value={line.detail} onChange={(event) => updateLine(line.id, "detail", event.target.value)} className="mt-2 w-full border-b border-gray-400 px-1 py-1 text-sm outline-none" /> : null}
                  {item?.askName ? <input aria-label={item.askName} required maxLength={200} placeholder={item.askName} value={line.courseName} onChange={(event) => updateLine(line.id, "courseName", event.target.value)} className="mt-2 w-full border-b border-gray-400 px-1 py-1 text-sm outline-none" /> : null}
                  {isHallHiring ? <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><label>Bill No. <input value={line.billNo} onChange={(event) => updateLine(line.id, "billNo", event.target.value)} className="w-24 border-b border-gray-400 px-1 py-1 outline-none" /></label><label>Date <input type="date" value={line.billDate} onChange={(event) => updateLine(line.id, "billDate", event.target.value)} className="border-b border-gray-400 px-1 py-1 outline-none" /></label></div> : null}
                </td>
                <td className="border-b border-r border-gray-300 p-2">{isHallHiring ? <input aria-label="Copies" type="text" value="" disabled tabIndex={-1} className={`${inputClass} cursor-not-allowed bg-gray-100`} /> : <input aria-label="Copies" type="number" min="1" step="1" value={line.copies} onChange={(event) => updateLine(line.id, "copies", event.target.value)} className={inputClass} />}</td>
                <td className="border-b border-r border-gray-300 p-2"><input aria-label="Price" type="number" min="0.01" step="0.01" value={line.price} readOnly={!!item?.choices} onChange={(event) => updateLine(line.id, "price", event.target.value)} className={`${inputClass} read-only:bg-gray-100`} /></td>
                <td className="border-b border-gray-300 px-3 py-2 text-right">{amount ? amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
              </tr>;
            })}
            <tr className="bg-gray-50 font-semibold"><td colSpan={3} className="border-r border-gray-300 px-3 py-3 text-right">Total</td><td className="px-3 py-3 text-right">{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={lines.length >= 20} onClick={addLine} className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand disabled:opacity-50">+ Add Particular</button>{lines.length > 1 ? <button type="button" onClick={() => setLines((current) => current.slice(0, -1))} className="text-sm text-gray-600 underline">Remove last row</button> : null}</div>
      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-3"><Link href="/" className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-brand">Cancel</Link><button disabled={saving} className="rounded-md bg-brand px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save & Print Receipt"}</button></div>
    </form>
  </main>;
}
