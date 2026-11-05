import orgConfig from "@/config/org.config";

export const MODULE_KEYS = [
  "paymentAdvice",
  "cashVoucher",
  "advance",
  "refund",
  "cashReceipt",
  "forwardingMemo",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface BranchConfig {
  name: string;
  code: string;
}

/** One line type on the Cash Receipt form; also decides its column in the daily report. */
export interface CashReceiptItemConfig {
  /** Shown in the dropdown and printed on the receipt. */
  label: string;
  /** Column in the daily Cash Receipts report. Omit to count it under "Other". */
  report?: string;
  /** Pick one of these; its price fills in and is locked. `askId` also asks for that ID (e.g. "Member ID"). */
  choices?: { label: string; price: number; askId?: string }[];
  /** Asks for a required name/description (text is the field's placeholder), e.g. "Course name". */
  askName?: string;
  /** Asks for an optional "Specify" note. */
  askDetail?: boolean;
  /** No quantity: the price is the amount, and Bill No. / Date are asked (e.g. hall hire). */
  amountOnly?: boolean;
}

export interface OrgConfig {
  appName: string;
  orgName: string;
  departmentName: string;
  logoPath: string;
  serialOrgCode: string;
  theme: { brand: string; forest: string; amber: string };
  contact: {
    addressLine1: string;
    addressLine2: string;
    phone: string;
    gstin: string;
    pan: string;
    depositAccountNo: string;
  };
  branches: BranchConfig[];
  departments: string[];
  /** Who a Forwarding Memo is addressed to ("To ..."). */
  forwardingMemoAddressee: string;
  executiveAuthorityName: string | null;
  financeCcEmail: string | null;
  /** What can be collected on a Cash Receipt (see CashReceiptItemConfig). */
  cashReceiptItems: CashReceiptItemConfig[];
  verifierNames: string[];
  sanctionerNames: string[];
  modules: Record<ModuleKey, boolean>;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Fails fast (at import time) with a message that names the bad setting. */
export function validateOrgConfig(config: OrgConfig): OrgConfig {
  const problems: string[] = [];
  const need = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  need(!!config.appName.trim(), "appName must not be empty");
  need(!!config.orgName.trim(), "orgName must not be empty");
  need(!!config.departmentName.trim(), "departmentName must not be empty");
  need(!!config.forwardingMemoAddressee.trim(), "forwardingMemoAddressee must not be empty");
  need(config.logoPath.startsWith("/"), 'logoPath must start with "/" (a file in /public)');
  need(/^[A-Za-z0-9]{1,10}$/.test(config.serialOrgCode), "serialOrgCode must be 1-10 letters/digits");
  for (const key of ["brand", "forest", "amber"] as const) {
    need(HEX.test(config.theme[key]), `theme.${key} must be a #RRGGBB colour`);
  }
  need(config.branches.length >= 1, "branches needs at least one entry (use one branch for single-office organisations)");
  const names = new Set<string>();
  const codes = new Set<string>();
  for (const branch of config.branches) {
    need(!!branch.name.trim(), "every branch needs a name");
    need(/^[A-Za-z0-9]{1,8}$/.test(branch.code), `branch "${branch.name}": code must be 1-8 letters/digits`);
    need(!names.has(branch.name), `duplicate branch name "${branch.name}"`);
    need(!codes.has(branch.code), `duplicate branch code "${branch.code}"`);
    names.add(branch.name);
    codes.add(branch.code);
  }
  need(new Set(config.departments).size === config.departments.length, "departments contains duplicates");
  need(config.departments.every((department) => !!department.trim()), "departments must not contain empty names");
  need(config.cashReceiptItems.length >= 1, "cashReceiptItems needs at least one entry");
  const itemLabels = new Set<string>();
  for (const item of config.cashReceiptItems) {
    need(!!item.label.trim(), "every cashReceiptItems entry needs a label");
    need(!itemLabels.has(item.label), `duplicate cashReceiptItems label "${item.label}"`);
    itemLabels.add(item.label);
    need([item.choices, item.askName, item.askDetail].filter(Boolean).length <= 1, `cashReceiptItems "${item.label}": use only one of choices, askName, askDetail`);
    need(!item.report || item.report.trim() !== "", `cashReceiptItems "${item.label}": report must not be empty`);
    if (item.choices) {
      need(item.choices.length >= 1, `cashReceiptItems "${item.label}": choices must not be empty`);
      const choiceLabels = new Set<string>();
      for (const choice of item.choices) {
        need(!!choice.label.trim() && choice.price > 0, `cashReceiptItems "${item.label}": every choice needs a label and a price above 0`);
        need(!choiceLabels.has(choice.label), `cashReceiptItems "${item.label}": duplicate choice "${choice.label}"`);
        choiceLabels.add(choice.label);
      }
    }
  }
  need(config.verifierNames.length >= 1, "verifierNames needs at least one entry");
  need(config.sanctionerNames.length >= 1, "sanctionerNames needs at least one entry");
  if (config.financeCcEmail !== null) {
    need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.financeCcEmail), "financeCcEmail must be an email address or null");
  }
  for (const key of MODULE_KEYS) need(typeof config.modules[key] === "boolean", `modules.${key} must be true or false`);
  if (problems.length) {
    throw new Error(`Invalid config/org.config.ts:\n - ${problems.join("\n - ")}`);
  }
  return config;
}

export const ORG = validateOrgConfig(orgConfig);

export function isModuleEnabled(module: ModuleKey): boolean {
  return ORG.modules[module];
}

/** Payment Advice, Cash Voucher and Advance share one form, API and edit flow. */
export function anyPaymentAdviceFamilyEnabled(): boolean {
  return ORG.modules.paymentAdvice || ORG.modules.cashVoucher || ORG.modules.advance;
}

/** Branch names as a non-empty tuple, for z.enum(). */
export const BRANCH_NAMES = ORG.branches.map((branch) => branch.name) as [string, ...string[]];

export function branchCodeFor(branch: string): string | undefined {
  return ORG.branches.find((entry) => entry.name === branch)?.code;
}

/** True when the branch selector should be hidden (nothing to choose). */
export const HAS_SINGLE_BRANCH = ORG.branches.length === 1;
/** True when department selectors should be shown. */
export const HAS_DEPARTMENTS = ORG.departments.length > 0;

export function isExecutiveAuthority(authorityName: string | null | undefined): boolean {
  if (!ORG.executiveAuthorityName || !authorityName) return false;
  return authorityName.trim().toUpperCase() === ORG.executiveAuthorityName.trim().toUpperCase();
}
