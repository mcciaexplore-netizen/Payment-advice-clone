import { ORG, type CashReceiptItemConfig } from "@/lib/config";

export const CASH_RECEIPT_ITEMS: readonly CashReceiptItemConfig[] = ORG.cashReceiptItems;

export function findCashReceiptItem(label: string): CashReceiptItemConfig | undefined {
  return CASH_RECEIPT_ITEMS.find((item) => item.label === label);
}

/**
 * The text stored and printed for a receipt line, from the item and whatever
 * extra the item asked for, e.g. "Sale of Publications - Handbook - Member
 * (Member ID: 123)", "Course / Seminar Fee: GST Workshop", "Others (Specify): Xyz".
 */
export function composeParticulars(
  item: CashReceiptItemConfig,
  extra: { choice?: string; id?: string; name?: string; detail?: string },
): string {
  if (item.choices) {
    const choice = item.choices.find((entry) => entry.label === extra.choice);
    const id = choice?.askId ? ` (${choice.askId}: ${extra.id?.trim()})` : "";
    return `${item.label} - ${extra.choice}${id}`;
  }
  if (item.askDetail && extra.detail?.trim()) return `${item.label}: ${extra.detail.trim()}`;
  if (item.askName && extra.name?.trim()) return `${item.label}: ${extra.name.trim()}`;
  return item.label;
}
