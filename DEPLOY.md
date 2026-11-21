# Deploying CoverFlow UAT (Always-On Gmail-Gated Link)

CoverFlow packages the **Web App (Broker Portal + Client App)**, **Fastify API**, **PDF Generator**, **Gmail Allowlist Gate**, and **Broker Remarks System** into a single Docker container (`Dockerfile`, PostgreSQL-backed, binds `$PORT` / default `8080`).

---

## Required Environment Variables (All Hosts)

Set these 4 environment variables on your host (**never commit them to Git**):

| Variable | Example Value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@host/neondb?sslmode=require` | PostgreSQL connection string (Neon Free Postgres or Railway Postgres) |
| `UAT_ADMIN_EMAIL` | `yourname@gmail.com` | Your Admin Gmail (unlocks the **Admin & Remarks** tab) |
| `UAT_ADMIN_PASSCODE` | `YourStrongPass2026` | Private Admin sign-in passcode |
| `UAT_BROKER_CODE` | `COVERFLOW-UAT` | Shared broker invite passcode (rotatable anytime in Admin panel) |

*(Optional: Set `GOOGLE_CLIENT_ID` if you later enable 1-click Google Sign-In.)*

---

## Option 1: Railway (Recommended — Fastest, Zero Cold-Starts)

1. Go to **[railway.com/dashboard](https://railway.com/dashboard)** → **New Project → Deploy from GitHub Repo** → select `Goldenfrogtime/insurance-underwriting`.
2. Railway automatically detects `Dockerfile` and starts building.
3. Add a PostgreSQL database:
   - Either paste your **Neon PostgreSQL** `DATABASE_URL` into Railway **Variables**, **or** click **+ New → Database → Add PostgreSQL** inside Railway and reference `${{Postgres.DATABASE_URL}}`.
4. In your CoverFlow service → **Variables**, add:
   - `DATABASE_URL`
   - `UAT_ADMIN_EMAIL`
   - `UAT_ADMIN_PASSCODE`
   - `UAT_BROKER_CODE`
   - `PORT` = `8080`
5. Go to **Settings → Networking → Generate Domain** → your live HTTPS URL is ready (e.g. `https://insurance-underwriting-production.up.railway.app`).

---

## Option 2: Render (Free Tier + Neon Postgres)

1. Go to **[dashboard.render.com](https://dashboard.render.com)** → **New → Web Service** → connect `Goldenfrogtime/insurance-underwriting`.
2. Choose **Runtime: Docker**, **Instance Type: Free**, and add the 4 environment variables above (using your Neon PostgreSQL `DATABASE_URL`).
3. Click **Create Web Service**. *(Note: Render Free sleeps after 15 mins idle and wakes in ~30–50s on the first click.)*

---

## Option 3: Google Cloud Run (Free Tier — 2M reqs/mo)

1. Open **[Google Cloud Console → Cloud Run](https://console.cloud.google.com/run)** with a billing-enabled project.
2. Click **Deploy container → Service → Continuously deploy from a repository** → connect `Goldenfrogtime/insurance-underwriting` (`^main$`, `/Dockerfile`).
3. Set **Region** (`africa-south1` or `europe-west1`), **Port** `8080`, **Memory** `512 MiB`, **Min instances** `0`, **Allow unauthenticated invocations**, and add the 4 environment variables above.
4. Click **Create**.

---

## Post-Deploy: Onboarding & Controlling Brokers

1. Open your deployed HTTPS URL and sign in with `UAT_ADMIN_EMAIL` + `UAT_ADMIN_PASSCODE`.
2. Open the **Admin & Remarks** tab (hidden from brokers):
   - Add each broker's **Gmail address**, name, brokerage, and optional expiry date.
   - Click **Copy WhatsApp / Email Invite** and share it with them.
3. **Full Control at Any Time:**
   - **Revoke 1 broker:** Click **Revoke** next to their Gmail (immediately kills their active session).
   - **Pause everyone:** Click **Pause All Broker Access** (Master Kill-Switch).
   - **Rotate passcode:** Update the Broker Access Code anytime.
   - **Export feedback:** Review remarks in-app or click **Export CSV**.
