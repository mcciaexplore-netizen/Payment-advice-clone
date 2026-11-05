import { ORG } from "@/lib/config";

/**
 * Identity strings, read from config/org.config.ts. Kept as named constants so
 * existing imports keep working; edit the config file, not this one.
 */
export const APP_NAME = ORG.appName;
export const DEPARTMENT_NAME = ORG.departmentName;
export const ORG_NAME = ORG.orgName;
export const ORG_NAME_UPPER = ORG_NAME.toUpperCase();
export const ORG_ADDRESS_LINE_1 = ORG.contact.addressLine1;
export const ORG_ADDRESS_LINE_2 = ORG.contact.addressLine2;
export const ORG_PHONE = ORG.contact.phone;
export const ORG_GSTIN = ORG.contact.gstin;
export const ORG_PAN = ORG.contact.pan;
/** Account that branch cash collections are deposited into (daily Cash Receipts report). */
export const ORG_DEPOSIT_ACCOUNT_NO = ORG.contact.depositAccountNo;
/** Public path of the logo image (also embedded in PDFs and emails). */
export const LOGO_PATH = ORG.logoPath;
/** File-system path of the logo, relative to the project root. */
export const LOGO_FILE = `public${ORG.logoPath}`;
/** "To ..." line on Forwarding Memos (screen and PDF). */
export const FORWARDING_MEMO_ADDRESSEE = ORG.forwardingMemoAddressee;
/** Code embedded in generated reference numbers, e.g. PD/2026-27/0001. */
export const SERIAL_ORG_CODE = ORG.serialOrgCode;
