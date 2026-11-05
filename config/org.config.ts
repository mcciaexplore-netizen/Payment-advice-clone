/**
 * Organisation configuration - the ONE file to edit when setting the app up
 * for a new organisation. No code changes are needed for anything listed here.
 *
 * Shapes and validation live in lib/config.ts. Secrets (database URL, API keys,
 * email credentials) do NOT belong here - they come from environment variables
 * (see .env.example).
 */
import type { OrgConfig } from "@/lib/config";

const config: OrgConfig = {
  /** Product name shown in titles, headers and emails. */
  appName: "Payment Desk",
  /** Legal / display name of the organisation (headers, PDFs, emails). */
  orgName: "Your Organisation Name",
  /** Name of the department the forms are submitted to. */
  departmentName: "Finance & Accounts Department",
  /** Addressee printed on Forwarding Memos ("To <this>"). */
  forwardingMemoAddressee: "The Chief Accountant",
  /** Public path of the logo (file lives in /public). Keep a ~4.2:1 ratio. */
  logoPath: "/logo.png",
  /** Code embedded in generated numbers, e.g. PD/2026-27/0001, CASH/PD/2026-27/0001. */
  serialOrgCode: "PD",

  /** Accent colours. `brand` is the primary accent used across the UI, PDFs and emails. */
  theme: {
    brand: "#0B1F3A",
    forest: "#2E8B57",
    amber: "#E8A33D",
  },

  /** Printed on Cash Receipts, the cash-voucher PDF header and emails. */
  contact: {
    addressLine1: "123 Example Road",
    addressLine2: "Sample City 000 000",
    phone: "000-00000000",
    gstin: "00AAAAA0000A1Z0",
    pan: "AAAAA0000A",
    /** Account that branch cash collections are deposited into (daily Cash Receipts report). */
    depositAccountNo: "000000000000000",
  },

  /**
   * Branches / offices. At least one is required (Cash Receipts and Refunds
   * store a branch). With exactly one branch the branch selector is hidden and
   * that branch is used automatically. `code` is the short code in Cash
   * Receipt numbers: CR/<code>/<FY>/NNNN. Branch names are stored on records,
   * so do not rename a branch once it has data.
   */
  branches: [
    { name: "Main Office", code: "MAIN" },
    { name: "Branch Office 1", code: "BR1" },
    { name: "Branch Office 2", code: "BR2" },
    { name: "Branch Office 3", code: "BR3" },
    { name: "Branch Office 4", code: "BR4" },
  ],

  /**
   * Departments shown in the "Your Department" selector. Leave the list empty
   * to hide department selectors entirely. An entry named "OTHERS" lets the
   * submitter type a free-text department.
   */
  departments: ["ADMIN", "OPERATIONS", "SALES", "OTHERS"],

  /**
   * Name of the recommending authority (as stored in the authority list) that
   * gets the read-only executive dashboard instead of approve/reject actions.
   * Set to null if the organisation has no such role.
   */
  executiveAuthorityName: "DG",

  /** Finance mailbox CC'd on every vendor MSME-request email. null = no fixed CC. */
  financeCcEmail: "finance@example.com",

  /**
   * What can be collected on a Cash Receipt (one dropdown entry each):
   * - label: shown in the dropdown and printed on the receipt
   * - report: column in the daily Cash Receipts report (omit = "Other")
   * - choices: pick one; its price fills in and is locked. askId also asks for an ID
   * - askName: asks for a required name (the text is the placeholder)
   * - askDetail: asks for an optional "Specify" note
   * - amountOnly: no quantity, the price is the amount; asks Bill No. / Date
   * Without any of these an item is plain: quantity x price.
   */
  cashReceiptItems: [
    {
      label: "Sale of Publications",
      report: "Publications",
      choices: [
        { label: "Handbook - Member", price: 900, askId: "Member ID" },
        { label: "Handbook - Non-member", price: 1500 },
        { label: "Guide Book", price: 500 },
      ],
    },
    { label: "Sale of Materials", report: "Material Sales" },
    { label: "Casual Sale", report: "Casual Sales" },
    { label: "Printout / Xerox" },
    { label: "Hall Hiring Charges", report: "Hall Rent", amountOnly: true },
    { label: "Course / Seminar Fee", report: "Seminar / Workshop", askName: "Course / seminar name" },
    { label: "Others (Specify)", askDetail: true },
  ],

  /** Legacy Finance verify / sanction dropdowns (kept for historical records). */
  verifierNames: ["Ravi Sample", "Nisha Sample", "Aman Sample", "Yash Sample"],
  sanctionerNames: ["Kabir Sample", "DG"],

  /** Turn whole modules on/off. A disabled module disappears from the home page, routes and APIs. */
  modules: {
    paymentAdvice: true,
    cashVoucher: true,
    advance: true,
    refund: true,
    cashReceipt: true,
    forwardingMemo: true,
  },
};

export default config;
