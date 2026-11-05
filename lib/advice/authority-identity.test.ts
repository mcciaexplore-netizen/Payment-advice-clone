import { describe, expect, it } from "vitest";
import { emailsMatch, identityCookieName } from "./authority-identity";

describe("emailsMatch", () => {
  it("matches identical emails", () => {
    expect(emailsMatch("a@b.com", "a@b.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(emailsMatch("user1@example.com", "user1@example.com")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(emailsMatch("  user1@example.com ", "user1@example.com")).toBe(true);
  });

  it("rejects a different email", () => {
    expect(emailsMatch("guess@evil.com", "user13@example.com")).toBe(false);
  });
});

describe("identityCookieName", () => {
  it("embeds the token so each token gets an independent cookie", () => {
    expect(identityCookieName("abc123")).toBe("pd_authority_identity_abc123");
  });
});
