# Rental Manager — Setup Guide
## Total time: ~20 minutes, no coding required

---

## STEP 1 — Create your Supabase account (free)

1. Go to https://supabase.com and click **Start for free**
2. Sign up with Google or email
3. Click **New project**
4. Give it a name: `rental-manager`
5. Set a database password (save it somewhere)
6. Choose a region close to you (e.g. US East or EU)
7. Click **Create new project** — wait ~2 minutes

---

## STEP 2 — Set up the database

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `SUPABASE_SCHEMA.sql` from this folder
4. Copy everything and paste it into the SQL editor
5. Click **Run** — you should see "Success"

---

## STEP 3 — Create the receipts storage bucket

1. In Supabase, click **Storage** in the left sidebar
2. Click **New bucket**
3. Name it exactly: `receipts`
4. Check **Public bucket** ✓
5. Click **Save**

---

## STEP 4 — Get your Supabase credentials

1. In Supabase, go to **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** (looks like: https://abcxyz.supabase.co)
   - **anon public** key (long string starting with eyJ...)

---

## STEP 5 — Deploy to Vercel (free)

1. Go to https://github.com and create a free account if you don't have one
2. Go to https://vercel.com and sign up with your GitHub account
3. In Vercel, click **Add New Project**
4. Upload this folder — or if you know Git, push it to a GitHub repo first
5. Vercel will detect it's a Next.js app automatically

---

## STEP 6 — Add your environment variables in Vercel

During deployment (or after in Project Settings → Environment Variables), add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | A password you choose (e.g. myrentals2025) |

---

## STEP 7 — Deploy

Click **Deploy**. In ~1 minute you'll get a URL like:
`https://rental-manager-yourname.vercel.app`

Open it on your phone or laptop — that's your app, live, with real storage.

---

## HOW TO USE DAY TO DAY

1. Open your app URL
2. Go to **Billing** tab — you'll see all properties
3. Any property not billed yet shows a **Create charge** button
4. Enter rent + service amounts, upload receipt (JPG or PDF), add a note
5. Hit **Open WhatsApp** — message is pre-written, just tap Send
6. Manually attach the receipt photo in that same WhatsApp chat
7. When tenant pays, hit **Mark paid**
8. **History** tab shows everything by month/year — your Excel replacement

---

## QUESTIONS?

Come back to Claude and paste any error message — I'll fix it immediately.
