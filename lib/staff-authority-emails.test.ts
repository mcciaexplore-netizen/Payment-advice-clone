import { describe, expect, it } from "vitest";
import { normalizeName } from "./staff-authority-emails";

describe("normalizeName", () => {
  it("is case-insensitive", () => {
    expect(normalizeName("RAVI SAMPLE")).toBe(normalizeName("Ravi Sample"));
  });

  it("collapses extra internal whitespace", () => {
    expect(normalizeName("MEERA  SAMPLE")).toBe(normalizeName("Meera Sample"));
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeName("  Asha Sample  ")).toBe(normalizeName("Asha Sample"));
  });
});
