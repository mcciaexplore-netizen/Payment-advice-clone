/**
 * Demo seed: takes an empty, migrated database to a working demo of the app
 * for a fictional organisation. Idempotent - re-running skips anything that
 * already exists (and never changes an existing password).
 *
 *   npm run db:migrate && npm run db:seed
 *
 * Creates, using the branches / departments / executive authority from
 * config/org.config.ts:
 *   - recommending authorities, staff (with emails) and their authority options
 *   - fictional vendors with bank accounts
 *   - one login per role, all on @example.com addresses: Finance Admin (ALL),
 *     Payment Advice and Cash Voucher Finance, one Authority login per
 *     authority, Branch / Department / Self team dashboards, Cash Receipt
 *
 * Each login gets a random password that is printed ONCE at the end; only the
 * bcrypt hash is stored. Set SEED_ADMIN_EMAIL to give the Finance Admin login
 * your own address. Refuses to run once real submissions exist, unless --force.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import crypto from "node:crypto";
import { count, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import {
  adminUserRoles,
  adminUsers,
  paymentAdvices,
  recommendingAuthorities,
  staffAuthorityOptions,
  staffMembers,
  vendorBankAccounts,
  vendors,
} from "../lib/db/schema";
import { hashPassword } from "../lib/admin-users";
import { ORG } from "../lib/config";
import type { AdminRole } from "../lib/auth";

const emailFor = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com`;

const KABIR = "Kabir Sample";
const TARA = "Tara Sample";
const executive = ORG.executiveAuthorityName;
const AUTHORITIES = [...(executive ? [executive] : []), KABIR, TARA];

// Submitters and their recommending authorities (first = default option, a second adds a choice).
const SUBMITTERS: { name: string; authorities: string[] }[] = [
  { name: "Priya Sample", authorities: [KABIR] },
  { name: "Rahul Sample", authorities: [KABIR, TARA] },
  { name: "Sunita Sample", authorities: [TARA] },
  { name: "Vikas Sample", authorities: [executive ?? KABIR] },
  { name: "Meena Sample", authorities: [KABIR] },
  { name: "Arjun Sample", authorities: executive ? [TARA, executive] : [TARA] },
];

const VENDORS = [
  { companyName: "Acme Stationers Pvt Ltd", isMsme: true },
  { companyName: "Sample Print House", isMsme: true },
  { companyName: "Demo Catering Services", isMsme: true },
  { companyName: "Example Travels LLP", isMsme: false },
  { companyName: "Test Office Supplies", isMsme: true },
  { companyName: "Placeholder IT Solutions", isMsme: false },
  { companyName: "Dummy Courier Co", isMsme: true },
  { companyName: "Fictional Event Managers", isMsme: false },
];

type Account = { fullName: string; email: string; role: AdminRole; authorityName?: string; scopeValue?: string };

function buildAccounts(): Account[] {
  const accounts: Account[] = [
    { fullName: "Demo Admin (All Access)", email: process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || "admin@example.com", role: "ALL" },
    { fullName: "Ravi Sample", email: emailFor("Ravi Sample"), role: "PAYMENT_ADVICE" },
    { fullName: "Nisha Sample", email: emailFor("Nisha Sample"), role: "CASH_VOUCHER" },
    ...AUTHORITIES.map((name) => ({ fullName: name, email: emailFor(name), role: "AUTHORITY" as const, authorityName: name })),
    { fullName: "Meena Sample", email: emailFor("Meena Sample"), role: "BRANCH", scopeValue: ORG.branches[0].name },
    { fullName: "Priya Sample", email: emailFor("Priya Sample"), role: "SELF" },
    { fullName: "Cashier Sample", email: emailFor("Cashier Sample"), role: "CASH_RECEIPT", scopeValue: ORG.branches[0].name },
  ];
  if (ORG.departments.length > 0) {
    accounts.push({ fullName: "Arjun Sample", email: emailFor("Arjun Sample"), role: "DEPARTMENT", scopeValue: ORG.departments[0] });
  }
  return accounts;
}

async function seedPeople() {
  const authorityIds = new Map<string, string>();
  for (const name of AUTHORITIES) {
    const [existing] = await db.select().from(recommendingAuthorities).where(eq(recommendingAuthorities.authorityName, name)).limit(1);
    if (existing) { authorityIds.set(name, existing.id); continue; }
    const [created] = await db.insert(recommendingAuthorities).values({ authorityName: name, email: emailFor(name) }).returning();
    authorityIds.set(name, created.id);
  }

  // Verifiers and sanctioners are looked up by name in the staff roster for their email.
  const rosterNames = new Set<string>([...ORG.verifierNames, ...ORG.sanctionerNames.filter((n) => !AUTHORITIES.includes(n)), ...SUBMITTERS.map((s) => s.name)]);
  const existingStaff = await db.select().from(staffMembers);
  const staffIds = new Map(existingStaff.map((s) => [s.fullName.toLowerCase(), s.id]));
  let staffCreated = 0;
  for (const name of rosterNames) {
    if (staffIds.has(name.toLowerCase())) continue;
    const [created] = await db.insert(staffMembers).values({ fullName: name, email: emailFor(name) }).returning();
    staffIds.set(name.toLowerCase(), created.id);
    staffCreated += 1;
  }

  for (const submitter of SUBMITTERS) {
    const staffId = staffIds.get(submitter.name.toLowerCase())!;
    for (const [index, authority] of submitter.authorities.entries()) {
      await db.insert(staffAuthorityOptions)
        .values({ staffMemberId: staffId, recommendingAuthorityId: authorityIds.get(authority)!, sortOrder: index + 1 })
        .onConflictDoNothing();
    }
  }
  return { authorityIds, staffCreated };
}

async function seedVendors() {
  const existing = new Set((await db.select({ name: vendors.companyName }).from(vendors)).map((v) => v.name.toLowerCase()));
  let created = 0;
  for (const [index, vendor] of VENDORS.entries()) {
    if (existing.has(vendor.companyName.toLowerCase())) continue;
    const n = String(index + 1).padStart(2, "0");
    const [row] = await db.insert(vendors).values({
      companyName: vendor.companyName,
      contactPerson: "Demo Contact",
      contactPhone: `90000000${n}`,
      address: `${index + 1} Example Street, Sample City 000 000`,
      email: `accounts@${vendor.companyName.toLowerCase().replace(/[^a-z]+/g, "")}.example.com`,
      gstin: `00AAAAA00${n}A1Z0`,
      isMsme: vendor.isMsme,
      udyamNumber: vendor.isMsme ? `UDYAM-XX-00-00000${n}` : null,
    }).returning({ id: vendors.id });
    await db.insert(vendorBankAccounts).values({
      vendorId: row.id,
      bankAccountNo: `0000000000${n}`,
      bankIfsc: "DEMO0000001",
      beneficiaryName: vendor.companyName,
    }).onConflictDoNothing();
    created += 1;
  }
  return created;
}

async function seedLogins(authorityIds: Map<string, string>) {
  const accounts = buildAccounts();
  const emails = accounts.map((a) => a.email);
  const existing = await db.select({ email: adminUsers.email }).from(adminUsers).where(inArray(adminUsers.email, emails));
  const have = new Set(existing.map((u) => u.email));
  const created: (Account & { password: string })[] = [];
  for (const account of accounts) {
    if (have.has(account.email)) continue;
    const password = crypto.randomBytes(15).toString("base64url");
    const recommendingAuthorityId = account.authorityName ? authorityIds.get(account.authorityName)! : null;
    const [user] = await db.insert(adminUsers).values({
      fullName: account.fullName,
      email: account.email,
      passwordHash: await hashPassword(password),
      // Deprecated compatibility columns; admin_user_roles below is authoritative.
      role: account.role,
      recommendingAuthorityId,
    }).returning({ id: adminUsers.id });
    await db.insert(adminUserRoles).values({
      adminUserId: user.id,
      role: account.role,
      recommendingAuthorityId,
      scopeValue: account.scopeValue ?? null,
    });
    created.push({ ...account, password });
  }
  return { created, skipped: accounts.length - created.length };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example).");
  const force = process.argv.includes("--force");
  const [{ total }] = await db.select({ total: count() }).from(paymentAdvices);
  if (total > 0 && !force) {
    throw new Error(`Refusing to seed: ${total} submission(s) already exist, so this is not a fresh demo database. Re-run with --force if you really want the demo records added.`);
  }

  console.log(`Seeding demo data for "${ORG.orgName}" (${ORG.branches.length} branch(es), ${ORG.departments.length} department(s))...`);
  const { authorityIds, staffCreated } = await seedPeople();
  const vendorsCreated = await seedVendors();
  const { created, skipped } = await seedLogins(authorityIds);

  console.log(`Staff added: ${staffCreated}. Vendors added: ${vendorsCreated}. Logins added: ${created.length} (${skipped} already existed, passwords unchanged).`);
  if (created.length === 0) return;
  console.log("\nDemo logins - passwords are shown ONCE and cannot be recovered. Log in at /admin/login");
  console.log("(Authority / team / cash-receipt logins use their own login pages), then change or delete these accounts before real use.\n");
  for (const account of created) {
    console.log(`  ${account.role.padEnd(14)} ${account.email.padEnd(34)} ${account.password}   (${account.fullName}${account.scopeValue ? `, ${account.scopeValue}` : ""})`);
  }
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
