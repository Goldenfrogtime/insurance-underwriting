# CoverFlow — Motor Insurance Underwriting Platform (V1)

**CoverFlow** is a modern, **< 3-minute "Plate-to-Sticker"** motor insurance underwriting platform built for the Tanzanian insurance market (TIRA / TRA compliant workflow). It serves as the underwriting foundation of a connected insurance ecosystem alongside **ClaimFlow** (Claims) and **AutoFix GMS** (Garages).

---

## Key Capabilities (V1)

- **One Core Engine, Two Surfaces:**
  - **Broker Portal:** Plate-first underwriting, multi-vehicle quotes, client reuse, private Commission & Insurer Settlement drawer (`12.5%` commission + `18%` VAT on commission), WhatsApp payment message copy, Broker Debit Notes, and TIRA MIS communication logs.
  - **Client Self-Service App:** Mobile-first 4-step flow, instant multi-insurer comparison, market valuation guidance, Mobile Money / Control Number checkout, and Digital Motor Sticker Wallet.
- **TIRA MRO Motor Rating Engine (`@coverflow/domain`):**
  - Full 2015 TIRA Market Adopted Actuarial Motor Rates (Private Cars, Motorcycles/Bodaboda, Bajaji, Commercial Own Goods & General Cartage with tonnage bands, Trailers, Oil Tankers, Passenger Carrying per-seat pricing, and Special Types).
  - Market extensions: **PVT (`0.25%`)**, **Excess Protector (`0.25%`)**, **Excess Buy-Back (`10%`)**, **Loss of Use**, **Geographical Extension**, **Windscreen & Accessories**, **First Loss Payee**, **Short-Period cover**, validated discounts (Tracker, TATOA/TABOA, Fleet >50), and **18% VAT**.
- **Strict Compliance & State Machine:**
  - Separates `DRAFT → QUOTED → REFERRED → ISSUE_READY → PAYMENT_PENDING → PAYMENT_CONFIRMED → SUBMITTING_TIRA → ISSUED / DELIVERED`.
  - Auto-handles TIRA `2205` active-cover overlaps by suggesting `expiry + 1 day` and blocking overlapping bind.
  - Preserves original TRA vehicle records when proposing use/seat corrections (requiring insurer acceptance before bind).
  - Never trusts manually typed receipt references—requires authoritative payment confirmation.
- **Broker UAT Controls (Built-In):**
  - Server-side **Gmail Allowlist Gate** + rotatable invite passcode + optional Google OAuth (`GOOGLE_CLIENT_ID`).
  - **Admin Control Panel** (hidden from brokers): Master Pause Kill-Switch, Approve/Revoke/Expire Gmail testers, triage remarks, and **Export CSV**.
  - Persistent **Sandbox Test Watermark** in UI and stamped diagonally across all generated PDFs.
  - Floating **"Leave Remark"** drawer on every screen auto-capturing broker Gmail, mode, step, plate, and quote number.
- **Printable PDF Documents:** Quotation, Proforma Invoice, AML/CFT Proposal Form, Broker Debit Note, and TIRA Cover Note with embedded QR code.

---

## Monorepo Architecture

```text
coverflow/
├── packages/
│   ├── domain/        # Pure TypeScript rating engine, state machine, Zod schemas, ecosystem contracts (Vitest tested)
│   └── adapters/      # Pluggable TRA, TIRA MIS, NIDA/TIN KYC, Valuation & Payment interfaces + realistic mock providers
├── apps/
│   ├── api/           # Fastify 5 + Prisma 6 (SQLite local / PostgreSQL cloud) + PDFKit/QR + UAT Auth + Static Web host
│   └── web/           # React 19 + Vite 6 + Tailwind CSS v4 (Broker Portal + Client App + Admin Panel)
├── Dockerfile         # Multi-stage production container (PostgreSQL, binds $PORT)
├── render.yaml        # Render Blueprint config
├── DEPLOY.md          # Deployment guide (Railway, Render, Google Cloud Run)
└── NOTES.md           # Product decisions, Smart Policy gap analysis, V2 backlog & ecosystem roadmap
```

---

## Local Quickstart

**Prerequisites:** Node.js `>= 22` and `npm`.

```bash
# 1. Install dependencies
npm install

# 2. Initialize local SQLite database & Prisma client
npm run db:generate --workspace=@coverflow/api
npm run db:push --workspace=@coverflow/api

# 3. Build all workspaces & run unit tests
npm run build
npm run test

# 4. Start CoverFlow (serves both Web UI and API on port 4001)
npm run dev:api
```

Open **http://localhost:4001**.

### Local Default UAT Accounts
- **Admin:** `admin@coverflow.co.tz` / Passcode: `ADMIN-2026` *(sees the **Admin & Remarks** tab)*
- **Sample Broker:** `broker.test@gmail.com` / Passcode: `COVERFLOW-UAT`

*(Override via `UAT_ADMIN_EMAIL`, `UAT_ADMIN_PASSCODE`, and `UAT_BROKER_CODE` environment variables in production.)*

---

## Sandbox Test Plates (Mock TRA & TIRA Scenarios)

| Plate | Vehicle | Scenario Tested |
| :--- | :--- | :--- |
| `T101ABC` | 2019 Toyota Harrier | Clean private car fast path (< 2 min quote-to-sticker) |
| `T999ECS` | 2001 Toyota Landcruiser | Active TIRA cover (`2205`) expiring `2027-07-05` → auto-proposes `2027-07-06` |
| `T999ECX` | 2006 Toyota IST | Multi-vehicle quote bundle companion |
| `T999EDM` | 2021 Toyota Landcruiser | High-value TZS 200M benchmark (`3.5%` + `18% VAT` = `TZS 8,260,000`) |
| `T450DLD` | 2017 Toyota Coaster | City Daladala bus (28 seats — per-seat rating `8% + 15,000/seat`) |
| `T770TRK` | 2020 Toyota Hilux | Fetched as Commercial Own Goods → test use-correction & referral workflow |
| `T880TNK` | 2020 Scania R450 | Steel Oil Tanker `< 10 yrs` (`6%`, min `TZS 2M`, `15%` SI excess) |
| `MC204BDA` | 2023 Bajaj Boxer BM150 | Motorcycle with Bodaboda passenger extension (`+TZS 15,000`) |
| `T999ERR` | 2018 Subaru Forester | Simulates TIRA MIS rejection (`TIRA402`) with actionable recovery |

---

## Ecosystem Integration API (ClaimFlow & AutoFix GMS)

- **`GET /api/v1/ecosystem/policies/verify?plate=T101ABC`**
  Returns active TIRA cover note/sticker numbers, insurer, cover type, sum insured, exact excess terms, First Loss Payee, verified vehicle VIN/engine specs, and timestamped pre-cover baseline photos.
- **`POST /api/v1/ecosystem/claims-feedback`**
  Allows **ClaimFlow** to report verified claim events back to CoverFlow so renewal underwriting automatically switches from `SELF_DECLARED_CLAIMS_FREE` to `VERIFIED_WITH_CLAIM`.

---

## Deployment

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step instructions to deploy CoverFlow using `Dockerfile` on **Railway**, **Render**, or **Google Cloud Run** with PostgreSQL.
