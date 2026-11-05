/**
 * Name normalisation used to match a typed or configured name (e.g. a
 * verifier or sanctioner) against staff_members. See lib/staff-email.ts.
 */

/** Case-insensitive, tolerant of leading/trailing/collapsed-internal whitespace,
 * so "MEERA  SAMPLE" (double space) normalises the same as "Meera Sample". */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
