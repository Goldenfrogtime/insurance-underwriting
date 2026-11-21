# CoverFlow — Product, Discovery & Engineering Notes

Working notes documenting the underwriting discovery analysis, V1 scope decisions, architecture trade-offs, and the roadmap for connecting **CoverFlow**, **ClaimFlow**, and **AutoFix GMS**.

---

## 1. Incumbent (Smart Policy) Audit vs. CoverFlow V1

Analysis of the Smart Policy broker portal (`wfFIQNM.aspx` / `wfICNM.aspx`) recording and screenshots revealed why standard issuance took 6+ minutes and where CoverFlow intentionally simplifies the flow:

| Friction Observed in Smart Policy | CoverFlow V1 Solution |
| :--- | :--- |
| **Client-First 55+ field modal** before quoting | **Plate-First Step 1:** Enter Registration No. only; defer KYC to pre-issuance (Step 3). |
| **100+ field green rating form** mixing fetched TRA facts with rating controls | Compact read-only **TRA Verified Vehicle Card** + dynamic class-specific inputs only. |
| **Passive `2205` active-cover warning** still allowed overlapping submission | Auto-proposes `startDate = expiry + 1 day` and blocks overlapping bind at readiness gate. |
| **Misleading `Approved` status** shown on unpaid vehicle rows | Strict state machine (`Quoted (Not Issued)` vs. `Cover Issued (TIRA Verified)`). |
| **Manual `Capture Receipt` reference typing** | Control Number generation + authoritative payment confirmation state (`PENDING`, `CONFIRMED`, `REVERSED`, `UNAVAILABLE`). |
| **Free-text `Override %` & `Additional Discount %`** | Locked down to validated rules + mandatory evidence refs (undocumented discounts explicitly excluded with reason). |
| **Broker-only ASP.NET desktop UI** | Unified API powering both **Broker Portal** and mobile-first **Client Self-Service App**. |

---

## 2. Locked V1 Scope vs. V2 Backlog

### Included in V1
- Standard private motor fast path + full TIRA MRO commercial, tanker, trailer, 2W/3W, and per-seat passenger-carrying classification.
- Multi-vehicle quotations (add multiple vehicles to one quote, reprice with quote versioning).
- Real-world Tanzanian market extensions confirmed from Smart Policy review:
  1. **Add-ons:** PVT (`0.25%`), Excess Protector (`0.25%`), Excess Buy-Back (`10%`), Loss of Use (`TZS 50k`, Private-only), Geo Extension (`5%`), Windscreen & Accessories.
  2. **First Loss Payee** (bank / asset-finance toggle).
  3. **Short-Period Cover** (`<1m` through `7–8m` MRO percentage schedule).
  4. **Control Number + Printable PDFs** (Quotation, Proforma, AML/CFT Proposal, Debit Note, Cover Note with QR).
  5. **Valuation Guidance** (suggested market value min/recommended/max range for self-service & sanity checks).
- Built-in **Broker UAT Controls**: Gmail allowlist gate, Master Kill-Switch, PDF & UI sandbox watermarks, floating Remarks drawer, and Admin CSV export.

### Deferred to V2 / Next Phases
- **Insurer Admin Workbench:** Insurer login for managing custom rate schedules, age/valuation thresholds, and live referral/correction approval queues (currently simulated with `[Sandbox]` buttons in V1).
- **Chassis-Only Lookup:** Unregistered / brand-new import vehicles without plates yet.
- **Bulk Excel Fleet Upload:** Spreadsheet import for 50+ vehicle corporate fleets.
- **Takaful Products:** Islamic insurance product variants.
- **Live External API Adapters:** Swapping `packages/adapters/src/mocks.ts` with sandbox/production adapters once partner API credentials are obtained:
  - TRA Motor Registry API
  - TIRA MIS (Active cover check + Cover Note / Sticker issuance + Cancellation)
  - NIDA / TIN KYC Verification
  - Payment Aggregator (Selcom / AzamPay / GePG / Mobile Money webhooks)
  - Launch Insurer Core APIs (e.g., MUA, Sanlam Allianz, Mayfair, Newtan)

---

## 3. Database & Deployment Notes

- **Local Development:** Uses SQLite (`apps/api/prisma/schema.prisma`, `DATABASE_URL="file:./dev.db"`) for zero-setup startup.
- **Cloud Production / UAT (`Dockerfile`):** Uses PostgreSQL (`apps/api/prisma/schema.postgres.prisma`).
  - Whenever `schema.prisma` is updated locally, keep `schema.postgres.prisma` in sync (identical models, `provider = "postgresql"`).
  - When using **Neon PostgreSQL**, use the **Direct** (non-pooler) connection string with `?sslmode=require` so `prisma db push` runs cleanly on container boot.
- **Security:** Never commit `.env` or live `DATABASE_URL` strings to Git. All secrets are passed via host Environment Variables (`DATABASE_URL`, `UAT_ADMIN_EMAIL`, `UAT_ADMIN_PASSCODE`, `UAT_BROKER_CODE`, optional `GOOGLE_CLIENT_ID`).

---

## 4. Ecosystem Integration Checklist (ClaimFlow & AutoFix GMS)

When bringing in the **ClaimFlow** and **AutoFix GMS** repositories:
1. **Shared Vehicle & Policy Identity:** Match vehicles on `normalizedPlate` + `chassisNo`, and policies on `coverNoteNo` / `stickerNo`.
2. **FNOL Policy Verification:** Have ClaimFlow call `GET /api/v1/ecosystem/policies/verify?plate=...` to pull active cover dates, sum insured, exact excess rules, First Loss Payee, and pre-cover baseline photos.
3. **NCD / Claims-Free Feedback Loop:** Have ClaimFlow call `POST /api/v1/ecosystem/claims-feedback` when claims are opened/settled so CoverFlow automatically updates renewal rating from `SELF_DECLARED` to `VERIFIED_WITH_CLAIM`.
4. **Garage Handoff:** Pass the verified vehicle snapshot (`make`, `model`, `manufactureYear`, `chassisNo`, `engineNo`) and policy excess terms from ClaimFlow → AutoFix GMS.
5. **Unified Auth (Phase 2):** Introduce shared JWT / SSO across CoverFlow, ClaimFlow, and AutoFix GMS (replacing the temporary UAT session gate).
