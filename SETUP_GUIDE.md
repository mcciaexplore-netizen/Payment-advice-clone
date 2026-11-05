# Payment Desk – Setup & Handover Guide

How to set this template up for a new organisation (one deployment per organisation),
and how to pull later template updates. Everything organisation-specific is in
`config/org.config.ts` plus a few image files; secrets are environment variables.

## 0. Accounts the client owns

The client creates and owns all of these (we are invited as collaborators and removed at the end):

| Service | Used for | Notes |
|---|---|---|
| GitHub | The code repository | Create a repo from this template (private recommended) |
| Vercel | Hosting | Connect the repo; Hobby/Pro per the client's needs |
| Neon | Postgres database | The app needs a real Neon endpoint (WebSocket driver, real transactions) |
| Vercel Blob | Attachment storage | A **Private** store in the same Vercel project |
| Google AI Studio (optional) | Invoice auto-fill (`GEMINI_API_KEY`) | If skipped, auto-fill is off and forms work manually |
| Gmail or Resend (optional) | Sending real emails | If skipped, emails are only logged (`EMAIL_MODE=preview`) |

## 1. Create the repository

1. Create a new GitHub repo (empty) in the client's account.
2. Push this template's code to it (or use "Use this template" if the template lives on GitHub).
3. Check `git log` and the tree contain no other organisation's data before connecting Vercel.

## 2. Database (Neon)

1. Create a Neon project (pick a region near the users).
2. Dashboard -> **Connect** -> choose the **pooled** connection string (`postgresql://…`, with the password shown).
3. Keep it for step 4. Do not paste it into chats or commit it.

## 3. File storage (Vercel Blob)

1. In the Vercel project -> **Storage** -> **Create** -> **Blob**.
2. Access: **Private**. Keep the variable prefix `BLOB`. Make sure the read-write token option is on.
3. The token appears as `BLOB_READ_WRITE_TOKEN` (store -> `.env.local` tab).

## 4. Environment variables

Local development: `cp .env.example .env.local`, then fill it in.
Vercel: Project -> Settings -> Environment Variables (set for **Production and Preview**), then redeploy.

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `AUTH_SECRET` | yes | New random value, 32+ characters (`openssl rand -base64 32`). Never reuse another deployment's. |
| `BLOB_READ_WRITE_TOKEN` | yes | From the Blob store |
| `EMAIL_MODE` | no | `preview` (default: logs only) or `live` |
| `EMAIL_PROVIDER` | if live | `gmail` or `resend` |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | if gmail | Sending account and a 16-char App Password |
| `RESEND_API_KEY`, `EMAIL_FROM` | if resend | API key; sender on a domain verified in Resend |
| `EMAIL_TEST_OVERRIDE_RECIPIENT` | no | While testing live email: redirect all mail to this address |
| `GEMINI_API_KEY` | no | Enables invoice auto-fill |

The server refuses to start, naming the problem, if a required variable is missing or malformed.
Never set `TEST_DATABASE_URL` to a real database (the serial-number tests write to it).

## 5. Configure the organisation (no code edits)

Edit `config/org.config.ts` (every field is documented inside it):

- **Identity:** `appName`, `orgName`, `departmentName`, `forwardingMemoAddressee`, `serialOrgCode`
  (prefix in numbers like `PD/2026-27/0001`).
- **Contact block** (printed on Cash Receipts and the cash-voucher header): address, phone, GSTIN, PAN, deposit account.
- **Theme:** `theme.brand` (+ `forest`, `amber`) in `#RRGGBB`.
- **Branches:** at least one. One branch hides the branch selector. Each has a short `code` used in Cash Receipt numbers.
  **Do not rename a branch once it has data** (names are stored on records and Cash Receipt counters).
- **Departments:** the list for "Your Department". Empty list hides department selectors. `OTHERS` enables free text.
- **Executive authority:** the authority name that gets the read-only dashboard (`null` if none), and `financeCcEmail`.
- **Cash Receipt items:** what can be collected and how each item lands in the daily report (`cashReceiptItems`).
- **Modules:** switch Payment Advice, Cash Voucher, Advance, Refund, Cash Receipt, Forwarding Memo on or off.
  A disabled module vanishes from the home page and its routes/APIs return 404.

Replace the images (keep the file names):

| File | Purpose |
|---|---|
| `public/logo.png` | Logo on pages, PDFs and emails (about 4.2:1; navy/dark artwork on transparent works best) |
| `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `app/favicon.ico` | App icons |
| `public/msme/non-msme-declaration-template.docx` | Template the vendor-request email attaches. Edit it for the organisation. |

Then run `npm run lint && npm test && npm run build` locally to confirm the config is valid.

## 6. Create the schema and starter data

With `.env.local` pointing at the client's Neon database:

```bash
npm install
npm run db:migrate            # builds the schema in the empty database
SEED_ADMIN_EMAIL=person@client.example npm run db:seed   # (PowerShell: $env:SEED_ADMIN_EMAIL="..."; npm run db:seed)
```

The seed prints a random password for each demo login **once**. Copy the Finance Admin login
(`/admin/login`). The demo data (staff, authorities, vendors, other logins) is for testing only.

## 7. Replace demo data with real data

- **Staff roster, recommending authorities, vendors:** use `/admin` (Staff & Authorities, Vendors) or load a
  spreadsheet with `npm run import:master-data -- file.xlsx` (layout described in the script header).
- **Real logins:** create the client's Finance, Authority, team and Cash Receipt users, then delete the demo
  accounts. Staff `email` values drive the "Your Email" auto-fill and notifications.

## 8. Deploy and test

1. Push to the repo; Vercel builds automatically.
2. Open the site and run this checklist, once on the deployed site:
   - Each enabled form: submit with an attachment (Payment Advice, Cash Voucher, Advance, Refund, Forwarding Memo).
   - Authority link: confirm identity, Recommend; then Finance: Mark received, Verify, Save payable, Record payment.
   - Send back, then open the edit link and resubmit.
   - PDFs: Payment Advice, Cash Voucher, Advance, Refund, Forwarding Memo, Cash Receipt (header shows the right name/address).
   - Cash Receipt: save a receipt, check the number format and the daily Excel report columns.
   - Each role's login (Finance sub-roles, Authority, executive authority, Branch/Department/Self, Cash Receipt).
   - On a phone-sized screen: home page and one form.
3. Email go-live: set `EMAIL_MODE=live` with `EMAIL_TEST_OVERRIDE_RECIPIENT` set to a test inbox, verify, then remove the override.

## 9. Handover and clean-up

- Rotate/replace anything temporary: `AUTH_SECRET`, demo passwords, any token that was shared while setting up.
- Delete the demo accounts and demo data you do not want.
- Remove our access from GitHub, Vercel, Neon and Blob; confirm the client is the owner of every one.
- Keep a private note of which environment variables exist (never the values) for the client's IT contact.

## 10. Upgrading to a newer template version

Each client deployment is its own copy. To pull improvements:

```bash
git remote add template <template repo URL>     # once
git fetch template
git merge template/main                        # resolve conflicts; your config/org.config.ts and logo are yours
npm install
npm run db:migrate                             # applies any new migrations (never edit applied migrations)
npm run lint && npm test && npm run build
```

Before merging, read the template's release notes for new fields in `config/org.config.ts` (the app validates the
config at startup and names any missing/invalid field). New modules or settings default to the template's values.
Deploy to a Vercel **Preview** first when possible.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Server returns an error naming environment variables | A required variable is missing or too short; fix in Vercel and redeploy |
| "Invalid config/org.config.ts" at startup | A config value is invalid; the message lists each one |
| Login fails after `db:seed` | Passwords are shown once; delete the user row or re-seed a fresh database |
| Uploads fail | `BLOB_READ_WRITE_TOKEN` missing, or the store is not Private |
| Vendor/staff dropdowns empty | No staff, authorities or vendors yet (step 7) |
| Auto-fill says "not available" | `GEMINI_API_KEY` not set (forms still work manually) |
| A module is "404" | It is switched off in `config/org.config.ts` |

## Known limitations (inherited from the original app, not changed in the template)

- Authority token links (the email approval links) do not re-check the identity on every POST once opened.
- A login stays valid until it expires even if the user is deactivated.
- Only the admin login is rate limited.
- Generated PDF download links are guessable only by UUID (anyone with a link can open that PDF).
- The Cash Receipt counter is keyed by branch name; renaming a branch restarts its numbering.
