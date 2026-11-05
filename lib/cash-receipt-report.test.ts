import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { CASH_RECEIPT_ITEMS } from "@/lib/cash-receipt-items";
import {
  CASH_RECEIPT_DEPOSIT_ACCOUNT_NO,
  REPORT_CATEGORIES,
  buildCashReceiptReportWorkbook,
  buildReportRows,
  categoryForParticulars,
  formatReportDate,
  parseReportRange,
  reportFilename,
  reportTotals,
  type ReportReceipt,
} from "@/lib/cash-receipt-report";

/** Distinct receipts, deliberately out of order. */
const FIXTURE: ReportReceipt[] = [
  {
    // Items in several categories.
    serialNo: "CR/MAIN/2026-27/0002",
    receiptDate: "2026-09-11",
    partyName: "Forbes Marshall Pvt. Ltd.",
    branch: "Main Office",
    total: "2650.00",
    items: [
      { particulars: "Sale of Publications - Handbook - Non-member", amount: "1500.00" },
      { particulars: "Hall Hiring Charges", amount: "1000.00" },
      { particulars: "Casual Sale", amount: "150.00" },
    ],
  },
  {
    // Two items in the same category, one with a composed suffix.
    serialNo: "CR/MAIN/2026-27/0001",
    receiptDate: "2026-09-11",
    partyName: "Ross Boilers",
    branch: "Main Office",
    total: "1250.50",
    items: [
      { particulars: "Course / Seminar Fee: GST Workshop", amount: "750.50" },
      { particulars: "Course / Seminar Fee", amount: "500.00" },
    ],
  },
  {
    // Unmapped categories: Printout / Xerox has no column, Others (Specify) is Other.
    serialNo: "CR/MAIN/2026-27/0003",
    receiptDate: "2026-09-12",
    partyName: "Revan Cooling Systems",
    branch: "Main Office",
    total: "320.00",
    items: [
      { particulars: "Printout / Xerox", amount: "20.00" },
      { particulars: "Others (Specify): Membership form", amount: "100.00" },
      { particulars: "Sale of Materials", amount: "200.00" },
    ],
  },
  {
    serialNo: "CR/MAIN/2026-27/0000",
    receiptDate: "2026-09-10",
    partyName: "Optima Life Sciences Pvt. Ltd.",
    branch: "Main Office",
    total: "900.00",
    items: [{ particulars: "Sale of Publications - Handbook - Member (Member ID: 77)", amount: "900.00" }],
  },
];

async function roundTrip(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buffer);
  return read.getWorksheet("Cash Receipts")!;
}

describe("category mapping", () => {
  it("maps every configured item to its report column, and anything unknown goes to Other", () => {
    const mapped = Object.fromEntries(CASH_RECEIPT_ITEMS.map((item) => [item.label, categoryForParticulars(item.label)]));
    expect(mapped).toEqual({
      "Sale of Publications": "Publications",
      "Sale of Materials": "Material Sales",
      "Casual Sale": "Casual Sales",
      "Printout / Xerox": "Other",
      "Hall Hiring Charges": "Hall Rent",
      "Course / Seminar Fee": "Seminar / Workshop",
      "Others (Specify)": "Other",
    });
    expect(REPORT_CATEGORIES).toEqual(["Publications", "Material Sales", "Casual Sales", "Hall Rent", "Seminar / Workshop", "Other"]);
    expect(categoryForParticulars("Something brand new")).toBe("Other");
    expect(categoryForParticulars("Sale of Publications - Guide Book")).toBe("Publications");
    expect(categoryForParticulars("Course / Seminar Fee: Export basics")).toBe("Seminar / Workshop");
    // A prefix must end at a word boundary, not just share letters.
    expect(categoryForParticulars("Sale of Publicationss")).toBe("Other");
  });
});

describe("buildReportRows", () => {
  const rows = buildReportRows(FIXTURE);

  it("produces exactly one row per receipt, sorted by date then serial", () => {
    expect(rows.map((row) => row.serialNo)).toEqual([
      "CR/MAIN/2026-27/0000",
      "CR/MAIN/2026-27/0001",
      "CR/MAIN/2026-27/0002",
      "CR/MAIN/2026-27/0003",
    ]);
  });

  it("fills several categories on one row, and sums two items in the same category", () => {
    expect(rows[2].categoryPaise).toEqual({ Publications: 150000, "Hall Rent": 100000, "Casual Sales": 15000 });
    expect(rows[1].categoryPaise).toEqual({ "Seminar / Workshop": 125050 });
    expect(rows[3].categoryPaise).toEqual({ Other: 12000, "Material Sales": 20000 });
  });

  it("totals every category column and the grand total", () => {
    const totals = reportTotals(rows);
    expect(totals.categoryPaise).toEqual({
      Publications: 240000,
      "Material Sales": 20000,
      "Casual Sales": 15000,
      "Hall Rent": 100000,
      "Seminar / Workshop": 125050,
      Other: 12000,
    });
    expect(totals.totalPaise).toBe(512050);
    const categorySum = Object.values(totals.categoryPaise).reduce((a, b) => a + b, 0);
    expect(categorySum).toBe(totals.totalPaise);
  });
});

describe("parseReportRange", () => {
  const today = "2026-10-09";
  it("defaults both dates to today", () => {
    expect(parseReportRange(new URLSearchParams(), today)).toEqual({ ok: true, from: today, to: today, depositDate: null });
  });
  it("rejects malformed, impossible, reversed, and over-long ranges", () => {
    expect(parseReportRange(new URLSearchParams({ dateFrom: "2026-13-01" }), today).ok).toBe(false);
    expect(parseReportRange(new URLSearchParams({ dateFrom: "2026-02-30" }), today).ok).toBe(false);
    expect(parseReportRange(new URLSearchParams({ dateFrom: "'; drop table x" }), today).ok).toBe(false);
    expect(parseReportRange(new URLSearchParams({ dateFrom: "2026-10-09", dateTo: "2026-10-08" }), today).ok).toBe(false);
    expect(parseReportRange(new URLSearchParams({ dateFrom: "2025-01-01", dateTo: "2026-10-09" }), today).ok).toBe(false);
    expect(parseReportRange(new URLSearchParams({ depositDate: "15-09-2026" }), today).ok).toBe(false);
  });
});

describe("buildCashReceiptReportWorkbook", () => {
  it("writes a real .xlsx whose cells read back with the sample's layout and correct numbers", async () => {
    const sheet = await roundTrip(buildCashReceiptReportWorkbook({ receipts: FIXTURE, from: "2026-09-10", to: "2026-09-12", depositDate: "2026-09-15" }));

    expect(sheet.getCell("A1").value).toBe("Cash Collected Rs.5120.50/- at Main Office from 10-9-2026 to 12-9-2026");
    expect(sheet.getCell("A2").value).toBe(`Cash Rs.5120.50/- deposited in the organisation's Account No. ${CASH_RECEIPT_DEPOSIT_ACCOUNT_NO} on 15-9-2026`);
    expect(CASH_RECEIPT_DEPOSIT_ACCOUNT_NO).toBe("000000000000000");
    expect(sheet.getCell("A1").font?.bold).toBe(true);
    expect(sheet.getCell("A2").font?.bold).toBe(true);
    expect(sheet.getCell("A1").isMerged && sheet.getCell("J1").isMerged).toBe(true);

    const header = sheet.getRow(3).values as unknown[];
    expect(header.slice(1)).toEqual(["Cash Receipt No.", "Date", "Customer name", ...REPORT_CATEGORIES, "Total"]);
    expect(header).not.toContain("Document No.");
    for (let column = 1; column <= 10; column++) {
      const cell = sheet.getRow(3).getCell(column);
      expect(cell.font?.bold).toBe(true);
      expect(cell.font?.color?.argb).toBe("FF0000FF");
      expect(cell.border?.top?.style).toBe("thin");
    }

    // Rows 4-7: one per receipt, no repeats.
    const serials = [4, 5, 6, 7].map((row) => sheet.getCell(`A${row}`).value);
    expect(serials).toEqual(["CR/MAIN/2026-27/0000", "CR/MAIN/2026-27/0001", "CR/MAIN/2026-27/0002", "CR/MAIN/2026-27/0003"]);
    expect(new Set(serials).size).toBe(4);

    // Receipt with several categories (row 6): D=Publications .. I=Other, J=Total.
    expect(sheet.getCell("D6").value).toBe(1500);
    expect(sheet.getCell("E6").value).toBeNull();
    expect(sheet.getCell("F6").value).toBe(150);
    expect(sheet.getCell("G6").value).toBe(1000);
    expect(sheet.getCell("J6").value).toBe(2650);
    // Two items in one category summed (row 5, Seminar / Workshop).
    expect(sheet.getCell("H5").value).toBe(1250.5);
    // Unmapped Printout / Xerox + Others land in Other (row 7, column I).
    expect(sheet.getCell("I7").value).toBe(120);
    expect(sheet.getCell("E7").value).toBe(200);

    // Amounts are numbers, dates are real dates.
    expect(typeof sheet.getCell("J4").value).toBe("number");
    expect(sheet.getCell("B4").value).toEqual(new Date(Date.UTC(2026, 8, 10)));
    expect(sheet.getCell("B4").numFmt).toBe("dd-mm-yyyy");
    expect(sheet.getCell("C4").value).toBe("Optima Life Sciences Pvt. Ltd.");

    // Totals row 8: SUM formulas with cached results for every category and the grand total.
    const expected: Record<string, number> = { D: 2400, E: 200, F: 150, G: 1000, H: 1250.5, I: 120, J: 5120.5 };
    for (const [letter, result] of Object.entries(expected)) {
      const cell = sheet.getCell(`${letter}8`);
      expect(cell.formula).toBe(`SUM(${letter}4:${letter}7)`);
      expect(cell.result).toBe(result);
      expect(cell.font?.bold).toBe(true);
    }
    expect(sheet.rowCount).toBe(8);

    expect(sheet.pageSetup.orientation).toBe("landscape");
    expect(sheet.pageSetup.fitToPage).toBe(true);
    expect(sheet.pageSetup.fitToWidth).toBe(1);
    expect(sheet.pageSetup.fitToHeight).toBe(0);
  });

  it("uses 'on {date}' for a single day and leaves a blank deposit date to fill in by hand", async () => {
    const sheet = await roundTrip(buildCashReceiptReportWorkbook({ receipts: [FIXTURE[3]], from: "2026-09-10", to: "2026-09-10" }));
    expect(sheet.getCell("A1").value).toBe("Cash Collected Rs.900/- at Main Office on 10-9-2026");
    expect(sheet.getCell("A2").value).toBe(`Cash Rs.900/- deposited in the organisation's Account No. ${CASH_RECEIPT_DEPOSIT_ACCOUNT_NO} on ____________`);
  });
});

describe("small formatters", () => {
  it("formats dates unpadded and builds a safe filename", () => {
    expect(formatReportDate("2026-09-01")).toBe("1-9-2026");
    expect(reportFilename("Main Office", "2026-09-10", "2026-09-12")).toBe("CashReceipts_Main-Office_2026-09-10_2026-09-12.xlsx");
  });
});
