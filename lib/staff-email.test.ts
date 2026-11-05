import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const from = vi.fn();
  const select = vi.fn(() => ({ from }));
  return { from, select };
});
vi.mock("@/lib/db", () => ({ db: { select: mocks.select } }));

import { resolveStaffEmailByName } from "./staff-email";
import { VERIFIER_NAMES, SANCTIONER_NAMES } from "./validation/payment-advice";

const STAFF_ROWS = [
  { fullName: "Ravi Sample", email: "ravis@example.com" },
  { fullName: "NISHA SAMPLE", email: "nishas@example.com" },
  { fullName: "AMAN SAMPLE", email: "amans@example.com" },
  { fullName: "YASH SAMPLE", email: "yashs@example.com" },
  { fullName: "KABIR SAMPLE", email: "kabirs@example.com" },
  { fullName: "MEERA SAMPLE", email: "meeras@example.com" },
  { fullName: "No Email Person", email: null },
];

describe("resolveStaffEmailByName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockResolvedValue(STAFF_ROWS);
  });

  it("resolves case-insensitively", async () => {
    expect(await resolveStaffEmailByName("Ravi Sample")).toBe("ravis@example.com");
  });

  it("resolves tolerant of collapsed whitespace", async () => {
    expect(await resolveStaffEmailByName("Meera Sample")).toBe("meeras@example.com");
  });

  it("returns null for a name with no matching staff row", async () => {
    expect(await resolveStaffEmailByName("Nobody Here")).toBeNull();
  });

  it("returns null when the matched staff row itself has no email on file", async () => {
    expect(await resolveStaffEmailByName("No Email Person")).toBeNull();
  });

  it('resolves 5 of the 6 hardcoded verifier/sanctioner names to a real email; "DG" resolves to null like any unmatched name', async () => {
    const names = [...VERIFIER_NAMES, ...SANCTIONER_NAMES];
    const results = await Promise.all(names.map((n) => resolveStaffEmailByName(n)));
    const byName = Object.fromEntries(names.map((n, i) => [n, results[i]]));
    expect(byName["Ravi Sample"]).toBe("ravis@example.com");
    expect(byName["Nisha Sample"]).toBe("nishas@example.com");
    expect(byName["Aman Sample"]).toBe("amans@example.com");
    expect(byName["Yash Sample"]).toBe("yashs@example.com");
    expect(byName["Kabir Sample"]).toBe("kabirs@example.com");
    expect(byName["DG"]).toBeNull();
  });
});
