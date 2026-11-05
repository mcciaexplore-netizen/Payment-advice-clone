import { branchCodeFor } from "@/lib/config";

export function getCashReceiptFinancialYear(date: string) {
  const [calendarYear, month] = date.slice(0, 10).split("-").map(Number);
  const startYear = month < 4 ? calendarYear - 1 : calendarYear;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function formatCashReceiptNumber(branch: string, date: string, sequence: number) {
  const code = branchCodeFor(branch);
  if (!code) throw new Error(`No Cash Receipt code is configured for branch: ${branch}`);
  return `CR/${code}/${getCashReceiptFinancialYear(date)}/${String(sequence).padStart(4, "0")}`;
}
