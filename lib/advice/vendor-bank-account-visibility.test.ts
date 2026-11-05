import { describe, expect, it } from "vitest";
import { isBankAccountVisibleToEmail } from "./vendor-bank-accounts";

describe("isBankAccountVisibleToEmail", () => {
  it("is visible to everyone when restrictedToEmails is null (the default)", () => {
    expect(isBankAccountVisibleToEmail(null, "")).toBe(true);
    expect(isBankAccountVisibleToEmail(null, "anyone@example.com")).toBe(true);
  });

  it("is visible to everyone when restrictedToEmails is an empty array", () => {
    expect(isBankAccountVisibleToEmail([], "anyone@example.com")).toBe(true);
  });

  it("is visible to a submitter whose email is in the allowed list", () => {
    expect(isBankAccountVisibleToEmail(["ashas@example.com"], "ashas@example.com")).toBe(true);
  });

  it("matches case-insensitively on both sides", () => {
    expect(isBankAccountVisibleToEmail(["ashas@example.com"], "ashas@example.com")).toBe(true);
    expect(isBankAccountVisibleToEmail(["ashas@example.com"], "ashas@example.com")).toBe(true);
  });

  it("tolerates surrounding whitespace on the submitted email", () => {
    expect(isBankAccountVisibleToEmail(["ashas@example.com"], "  ashas@example.com  ")).toBe(true);
  });

  it("is hidden from a submitter not in the allowed list — no partial match, no hint", () => {
    expect(isBankAccountVisibleToEmail(["ashas@example.com"], "user14@example.com")).toBe(false);
    expect(isBankAccountVisibleToEmail(["ashas@example.com"], "")).toBe(false);
  });

  it("is hidden from an empty/blank submitted email when a restriction exists", () => {
    expect(isBankAccountVisibleToEmail(["ashas@example.com"], "   ")).toBe(false);
  });

  it("supports more than one allowed email on the same account", () => {
    const allowed = ["ashas@example.com", "user14@example.com"];
    expect(isBankAccountVisibleToEmail(allowed, "user14@example.com")).toBe(true);
    expect(isBankAccountVisibleToEmail(allowed, "user15@example.com")).toBe(false);
  });
});
