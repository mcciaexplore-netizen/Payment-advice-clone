import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ gmailSendMail: vi.fn(), auditInsertValues: vi.fn() }));
vi.mock("resend", () => ({ Resend: vi.fn() }));
vi.mock("nodemailer", () => {
  const createTransport = vi.fn(() => ({ sendMail: mocks.gmailSendMail }));
  return { default: { createTransport }, createTransport };
});
vi.mock("@/lib/db", () => ({ db: { insert: vi.fn(() => ({ values: mocks.auditInsertValues })) } }));

import { notifyCashReceiptReceived, notifyPaymentDone } from "./notify";
import { renderCashReceiptReceivedEmail } from "./templates";

const DATA = {
  serialNo: "CR/MAIN/2026-27/0001",
  issuerName: "Gita Sample",
  partyName: "Forbes <Marshall> & Co",
  amount: "1,500.00",
  receiptDate: "2026-10-30",
  receivedOn: "30/10/2026, 05:30 pm",
  receivedBy: "Nisha Sample",
};
const RECEIPT_ID = "11111111-1111-4111-8111-111111111111";

describe("Cash received email template", () => {
  it("has the requested subject and every detail, HTML-escaped", () => {
    const { subject, html } = renderCashReceiptReceivedEmail({ ...DATA, note: "short by 50" });
    expect(subject).toBe("Cash received: CR/MAIN/2026-27/0001");
    for (const text of ["Cash Received", "Dear Gita Sample", "Receipt No.", "CR/MAIN/2026-27/0001", "Forbes &lt;Marshall&gt; &amp; Co", "₹ 1,500.00", "30/10/2026", "30/10/2026, 05:30 pm", "Nisha Sample", "Note", "short by 50"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("<Marshall>");
    expect(subject + html).not.toContain("—");
  });

  it("leaves the Note row out when there is no note", () => {
    expect(renderCashReceiptReceivedEmail({ ...DATA, note: null }).html).not.toContain(">Note<");
  });
});

describe("send outcome for the Cash received email", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.spyOn(console, "info").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => vi.unstubAllEnvs());

  it("preview mode (the default) sends nothing and reports preview", async () => {
    await expect(notifyCashReceiptReceived(DATA, "user16@example.com", RECEIPT_ID)).resolves.toBe("preview");
    expect(mocks.gmailSendMail).not.toHaveBeenCalled();
  });

  it("live mode reports sent on success", async () => {
    vi.stubEnv("EMAIL_MODE", "live");
    vi.stubEnv("GMAIL_USER", "user17@example.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "x");
    mocks.gmailSendMail.mockResolvedValue({ messageId: "<1@gmail.com>" });
    await expect(notifyCashReceiptReceived(DATA, "user16@example.com", RECEIPT_ID)).resolves.toBe("sent");
    expect(mocks.gmailSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "user16@example.com", subject: "Cash received: CR/MAIN/2026-27/0001" }));
  });

  it("a provider failure reports failed (never throws) and logs EMAIL_SEND_FAILED against the Cash Receipt", async () => {
    vi.stubEnv("EMAIL_MODE", "live");
    vi.stubEnv("GMAIL_USER", "user17@example.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "x");
    mocks.gmailSendMail.mockRejectedValue(new Error("SMTP down"));
    await expect(notifyCashReceiptReceived(DATA, "user16@example.com", RECEIPT_ID)).resolves.toBe("failed");
    expect(mocks.auditInsertValues).toHaveBeenCalledWith(expect.objectContaining({ cashReceiptId: RECEIPT_ID, action: "EMAIL_SEND_FAILED" }));
  });

  it("existing callers are unchanged: a Payment Done failure still logs against the advice", async () => {
    vi.stubEnv("EMAIL_MODE", "live");
    vi.stubEnv("GMAIL_USER", "user17@example.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "x");
    mocks.gmailSendMail.mockRejectedValue(new Error("SMTP down"));
    await notifyPaymentDone({ displayNo: "PD/2026-27/0001", submittedByName: "A", documentLabel: "Payment Advice", payeeName: "P", amount: "1", formDate: "2026-10-30" }, "a@b.co", "advice-1");
    expect(mocks.auditInsertValues).toHaveBeenCalledWith(expect.objectContaining({ paymentAdviceId: "advice-1", action: "EMAIL_SEND_FAILED" }));
  });
});
