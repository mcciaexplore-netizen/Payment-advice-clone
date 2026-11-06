import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import defaultConfig from "@/config/org.config";
import { validateOrgConfig, type OrgConfig } from "@/lib/config";

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));
vi.mock("@/components/public/PublicLoginMenu", () => ({ PublicLoginMenu: () => null }));

// These tests import whole pages and forms; give them room when the full suite runs in parallel.
vi.setConfig({ testTimeout: 30_000 });

const clone = (): OrgConfig => structuredClone(defaultConfig);

/** Loads a fresh copy of the app modules against a modified organisation config. */
async function withConfig(change: (config: OrgConfig) => void) {
  const config = clone();
  change(config);
  vi.resetModules();
  vi.doMock("@/config/org.config", () => ({ default: config }));
  return config;
}

describe("validateOrgConfig", () => {
  it("accepts the shipped config", () => {
    expect(() => validateOrgConfig(clone())).not.toThrow();
  });

  it("names every problem it finds", () => {
    const config = clone();
    config.branches = [{ name: "A", code: "X" }, { name: "A", code: "X" }];
    config.theme.brand = "navy";
    config.serialOrgCode = "";
    let message = "";
    try { validateOrgConfig(config); } catch (error) { message = (error as Error).message; }
    for (const part of ['duplicate branch name "A"', 'duplicate branch code "X"', "theme.brand", "serialOrgCode"]) expect(message).toContain(part);
  });

  it("requires at least one branch, but allows no departments and no executive authority", () => {
    const noBranch = clone();
    noBranch.branches = [];
    expect(() => validateOrgConfig(noBranch)).toThrow(/at least one entry/);
    const minimal = clone();
    minimal.departments = [];
    minimal.executiveAuthorityName = null;
    minimal.financeCcEmail = null;
    expect(() => validateOrgConfig(minimal)).not.toThrow();
  });

  it("checks the Cash Receipt items", () => {
    const config = clone();
    config.cashReceiptItems = [
      { label: "Fee" },
      { label: "Fee" },
      { label: "Mixed", askName: "Name", askDetail: true },
      { label: "Pick", choices: [{ label: "A", price: 0 }] },
    ];
    let message = "";
    try { validateOrgConfig(config); } catch (error) { message = (error as Error).message; }
    for (const part of ['duplicate cashReceiptItems label "Fee"', "use only one of", "needs a label and a price above 0"]) expect(message).toContain(part);
    config.cashReceiptItems = [];
    expect(() => validateOrgConfig(config)).toThrow(/cashReceiptItems needs at least one entry/);
  });

  it("rejects a malformed finance CC address", () => {
    const config = clone();
    config.financeCcEmail = "not-an-email";
    expect(() => validateOrgConfig(config)).toThrow(/financeCcEmail/);
  });
});

describe("module switches", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("@/config/org.config"));

  it("maps a Payment Advice family submission onto its module", async () => {
    const { paymentAdviceModuleFor } = await import("@/lib/modules");
    expect(paymentAdviceModuleFor("NEFT", false)).toBe("paymentAdvice");
    expect(paymentAdviceModuleFor("CASH", false)).toBe("cashVoucher");
    expect(paymentAdviceModuleFor("NEFT", true)).toBe("advance");
    expect(paymentAdviceModuleFor("CASH", true)).toBe("advance");
  });

  it("a disabled module 404s on pages and APIs; enabled modules pass", async () => {
    await withConfig((config) => { config.modules.cashReceipt = false; });
    const { requireModule, moduleDisabledResponse } = await import("@/lib/modules");
    expect(() => requireModule("cashReceipt")).toThrow("NEXT_NOT_FOUND");
    expect(() => requireModule("refund")).not.toThrow();
    expect(moduleDisabledResponse("cashReceipt")?.status).toBe(404);
    expect(moduleDisabledResponse("refund")).toBeNull();
  });

  it("the home page only lists enabled modules", async () => {
    await withConfig((config) => {
      config.modules.cashReceipt = false;
      config.modules.forwardingMemo = false;
      config.modules.advance = false;
    });
    const { default: Home } = await import("@/app/page");
    const html = renderToStaticMarkup(createElement(Home));
    for (const href of ["/payment-advice", "/cash-voucher", "/refund"]) expect(html).toContain(`href="${href}"`);
    for (const href of ["/cash-receipt", "/forwarding-memo", "/advance"]) expect(html).not.toContain(`href="${href}"`);
  });

  it("the Finance Admin nav drops disabled modules", async () => {
    await withConfig((config) => { config.modules.refund = false; config.modules.forwardingMemo = false; });
    const { readFileSync } = await import("node:fs");
    // AdminNav is a client component; assert through the helper it derives from.
    const { isModuleEnabled } = await import("@/lib/config");
    expect(isModuleEnabled("refund")).toBe(false);
    expect(isModuleEnabled("cashReceipt")).toBe(true);
    expect(readFileSync("components/admin/AdminNav.tsx", "utf8")).toContain('module: "refund"');
  });
});

describe("organisations with one branch and no departments", () => {
  afterEach(() => vi.doUnmock("@/config/org.config"));

  it("hides the selectors' requirements: department is optional and the single branch is the only valid one", async () => {
    await withConfig((config) => {
      config.branches = [{ name: "Head Office", code: "HO" }];
      config.departments = [];
    });
    const config = await import("@/lib/config");
    expect(config.HAS_SINGLE_BRANCH).toBe(true);
    expect(config.HAS_DEPARTMENTS).toBe(false);
    const { paymentAdviceFormSchema } = await import("@/lib/validation/payment-advice");
    const shape = paymentAdviceFormSchema.shape;
    expect(shape.submittedByDepartmentOption.safeParse(undefined)).toMatchObject({ success: true, data: "" });
    expect(shape.submittedByDepartment.safeParse(undefined)).toMatchObject({ success: true, data: "" });
    expect(shape.branch.safeParse("Head Office").success).toBe(true);
    expect(shape.branch.safeParse("Elsewhere").success).toBe(false);
  });

  it("Refund accepts a blank department when none are configured", async () => {
    await withConfig((config) => {
      config.branches = [{ name: "Head Office", code: "HO" }];
      config.departments = [];
    });
    const { refundRequestSchema } = await import("@/lib/validation/refund-request");
    const shape = refundRequestSchema("2026-10-16").shape;
    expect(shape.submittedByDepartment.safeParse("")).toMatchObject({ success: true, data: "" });
  });

  it("with departments configured, department stays required", async () => {
    await withConfig(() => undefined);
    const { paymentAdviceFormSchema } = await import("@/lib/validation/payment-advice");
    expect(paymentAdviceFormSchema.shape.submittedByDepartmentOption.safeParse(undefined).success).toBe(false);
    expect(paymentAdviceFormSchema.shape.submittedByDepartment.safeParse("").success).toBe(false);
  });

  it("Cash Receipt numbers use the configured branch code, and unknown branches still throw", async () => {
    await withConfig((config) => {
      config.branches = [{ name: "Head Office", code: "HO" }];
    });
    const { formatCashReceiptNumber } = await import("@/lib/cash-receipt-number");
    expect(formatCashReceiptNumber("Head Office", "2026-10-16", 7)).toBe("CR/HO/2026-27/0007");
    expect(() => formatCashReceiptNumber("Nowhere", "2026-10-16", 1)).toThrow(/No Cash Receipt code/);
  });

  it("the executive-authority check follows config (and is off when unset)", async () => {
    await withConfig((config) => { config.executiveAuthorityName = "Chairperson"; });
    const on = await import("@/lib/config");
    expect(on.isExecutiveAuthority(" chairperson ")).toBe(true);
    expect(on.isExecutiveAuthority("DG")).toBe(false);
    await withConfig((config) => { config.executiveAuthorityName = null; });
    const off = await import("@/lib/config");
    expect(off.isExecutiveAuthority("DG")).toBe(false);
  });

  it("serial numbers use the configured organisation code", async () => {
    await withConfig((config) => { config.serialOrgCode = "ACME"; });
    const serial = await import("@/lib/serial");
    expect(serial.formatSerial("2026-27", 5)).toBe("ACME/2026-27/0005");
    expect(serial.formatCashVoucherNo("2026-27", 5)).toBe("CASH/ACME/2026-27/0005");
  });
});

describe("Cash Receipt items", () => {
  afterEach(() => vi.doUnmock("@/config/org.config"));

  it("composes the stored particulars from the item and what it asked for", async () => {
    const { CASH_RECEIPT_ITEMS, composeParticulars, findCashReceiptItem } = await import("@/lib/cash-receipt-items");
    const item = (label: string) => findCashReceiptItem(label)!;
    expect(CASH_RECEIPT_ITEMS.length).toBeGreaterThan(0);
    expect(composeParticulars(item("Sale of Publications"), { choice: "Handbook - Member", id: " 123 " })).toBe("Sale of Publications - Handbook - Member (Member ID: 123)");
    expect(composeParticulars(item("Sale of Publications"), { choice: "Guide Book" })).toBe("Sale of Publications - Guide Book");
    expect(composeParticulars(item("Course / Seminar Fee"), { name: " GST Workshop " })).toBe("Course / Seminar Fee: GST Workshop");
    expect(composeParticulars(item("Others (Specify)"), { detail: "Xyz" })).toBe("Others (Specify): Xyz");
    expect(composeParticulars(item("Others (Specify)"), { detail: " " })).toBe("Others (Specify)");
    expect(composeParticulars(item("Casual Sale"), {})).toBe("Casual Sale");
  });

  it("the form and the report follow the configured items", async () => {
    await withConfig((config) => {
      config.cashReceiptItems = [
        { label: "Consulting Fee", report: "Fees", amountOnly: true },
        { label: "Spare Parts", report: "Parts", choices: [{ label: "Filter", price: 250 }] },
        { label: "Miscellaneous" },
      ];
    });
    const { CashReceiptForm } = await import("@/components/form/CashReceiptForm");
    const html = renderToStaticMarkup(createElement(CashReceiptForm, { branch: "Main Office", issuedBy: "Cashier" }));
    for (const label of ["Consulting Fee", "Spare Parts", "Miscellaneous"]) expect(html).toContain(`<option value="${label}">${label}</option>`);
    expect(html).not.toContain("Hall Hiring Charges");
    const report = await import("@/lib/cash-receipt-report");
    expect(report.REPORT_CATEGORIES).toEqual(["Fees", "Parts", "Other"]);
    expect(report.categoryForParticulars("Spare Parts - Filter")).toBe("Parts");
    expect(report.categoryForParticulars("Miscellaneous")).toBe("Other");
  });
});
