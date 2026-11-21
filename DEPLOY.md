# Deploying CoverFlow UAT on Google Cloud Run (\$0 Free Tier)

CoverFlow packages the **Web App (Broker Portal + Client App)**, **Fastify API**, **PDF Generator**, **Gmail Allowlist Gate**, and **Broker Remarks System** into a single Cloud Run container.

- **Compute:** Google Cloud Run Free Tier (**2M free requests/month**, scales to zero, wakes in ~2s, automatic HTTPS).
- **Database:** Pair with **[Neon](https://neon.tech) Free PostgreSQL** (500 MB free forever, no credit card) so your broker remarks & Gmail allowlist persist permanently without paying for Google Cloud SQL (~\$10+/mo).

---

## Step 1: Create a Free PostgreSQL Database (60 seconds)

1. Go to [neon.tech](https://neon.tech) (or [supabase.com](https://supabase.com)) → **Sign up with Google** → **Create Project** (`coverflow-uat`).
2. Copy the PostgreSQL connection string (`DATABASE_URL`), which looks like:
   ```
   postgresql://user:password@ep-xxxxx.aws.neon.tech/neondb?sslmode=require
   ```

---

## Step 2: Deploy to Google Cloud Run

### Method A — No CLI Needed (Google Cloud Console + GitHub)

1. Push the `coverflow/` folder to a **private GitHub repository**.
2. Open **[Google Cloud Console → Cloud Run](https://console.cloud.google.com/run)** → click **Deploy container → Service**.
3. Choose **Continuously deploy from a repository (Source)** → click **Set up with Cloud Build** → connect your GitHub repo (`Dockerfile` is auto-detected at `/Dockerfile`).
4. Configure Service Settings:
   - **Service name:** `coverflow-uat`
   - **Region:** `europe-west1` or `africa-south1` (Johannesburg — lowest latency for East Africa!)
   - **Authentication:** Select **Allow unauthenticated invocations** *(CoverFlow's own server-side Gmail Allowlist Gate protects the app, or you can enable Cloud Run IAP on top for Google SSO).*
   - **Container port:** `8080`
   - **Memory:** `512 MiB` · **Min instances:** `0` (keeps it \$0!) · **Max instances:** `2`
5. Expand **Variables & Secrets → Environment Variables** and add:
   - `DATABASE_URL` = *(your Neon PostgreSQL connection string)*
   - `UAT_ADMIN_EMAIL` = `yourname@gmail.com` *(your Gmail — becomes Admin)*
   - `UAT_ADMIN_PASSCODE` = `YourStrongAdminPass2026` *(keep private)*
   - `UAT_BROKER_CODE` = `COVERFLOW-UAT` *(share with approved brokers; rotatable anytime in-app)*
6. Click **Create** — in ~2 minutes Cloud Run gives you an HTTPS URL like:
   `https://coverflow-uat-xxxxx.a.run.app`

---

### Method B — 1-Command Deploy via `gcloud` CLI (Optional)

If you install Google Cloud SDK (`brew install --cask google-cloud-sdk`):

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

cd "/Users/barakaituwe/Documents/antigravity/insurance underwriting/coverflow"

gcloud run deploy coverflow-uat \
  --source . \
  --region africa-south1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars "DATABASE_URL=YOUR_NEON_POSTGRES_URL,UAT_ADMIN_EMAIL=yourname@gmail.com,UAT_ADMIN_PASSCODE=YourStrongAdminPass2026,UAT_BROKER_CODE=COVERFLOW-UAT"
```

---

## Step 3: Onboard & Control Brokers

1. Open your Cloud Run HTTPS URL and sign in with `UAT_ADMIN_EMAIL` + `UAT_ADMIN_PASSCODE`.
2. Go to the **Admin & Remarks** tab (hidden from brokers):
   - Add each broker's **Gmail address**, name, brokerage, and optional expiry date.
   - Click **Copy WhatsApp / Email Invite** and send it to them.
3. **Full Control at Any Time:**
   - **Revoke 1 broker:** Click **Revoke** next to their Gmail (kills their active session immediately).
   - **Pause everyone:** Click **Pause All Broker Access** (Master Kill-Switch).
   - **Export feedback:** Review remarks in-app or click **Export CSV**.

---

## Optional Upgrade: 1-Click "Sign in with Google"

CoverFlow's backend already supports verifying Google ID tokens! To enable Google SSO later, create an OAuth Client ID in Google Cloud Console (`APIs & Services → Credentials`) and set `GOOGLE_CLIENT_ID` as an env var on Cloud Run.
