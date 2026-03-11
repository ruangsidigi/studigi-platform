# Deploy Backend ke Vercel – Checklist Eksekusi

Backend Anda sudah siap. Panduan ini **konkret** dengan env variable Anda yang sebenarnya.

## Info Singkat
- **Repo**: https://github.com/ruangsidigi/studigi-platform
- **Backend entry**: `backend/api/index.js`
- **Frontend**: Vercel (https://studigi.vercel.app)
- **Database**: Supabase (postgres pooler)

---

## Setup Vercel Backend (Estimated ~10 menit)

### Tahap 1: Sign In & Import Repo

1. Buka https://vercel.com → **Sign In** (pakai GitHub account)
2. Klik **Add New** → **Project**
3. Klik **Import Git Repository**
4. Search: `studigi-platform` → pilih `ruangsidigi/studigi-platform` → klik **Import**

### Tahap 2: Konfigurasi Build

Di form yang muncul:

- **Project Name**: tetap `studigi-platform` atau ganti `studigi-backend`
- **Framework**: Other
- **Root Directory**: `backend` ← **PENTING**
- **Build Command**: `npm install` (biarkan apa adanya/kosong)
- **Install Command**: `npm ci`
- **Output Directory**: `.` (default)

Jangan klik **Deploy** dulu. Lanjut ke Tahap 3.

### Tahap 3: Environment Variables Vercel Backend

**Masih di form konfigurasi**, klik **Environment Variables**.

Tambah satu-satu variable berikut:

| Key | Value | Sumber |
|-----|-------|--------|
| `NODE_ENV` | `production` | tetap |
| `DATABASE_URL` | `postgresql://postgres.bequugagflkevskuecug:RuangsiDigidualima@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres` | dari backend/.env |
| `JWT_SECRET` | `DiLKI2qNQMK2yTfMp48YnTotJiYxzdAWDCwTSuuwfP7hbSkHuKx43Br2zoL/Rf6T9xCYhMWkCiih2PuIE9jO2Q==` | dari backend/.env |
| `FRONTEND_URL` | `https://studigi.vercel.app` | frontend URL Vercel existing |
| `CORS_ORIGINS` | `https://studigi.vercel.app` | sama dengan FRONTEND_URL |
| `SUPABASE_URL` | `https://bequugagflkevskuecug.supabase.co` | dari backend/.env |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlcXV1Z2FnZmxrZXZza3VlY3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDk4ODAsImV4cCI6MjA4NjUyNTg4MH0.7n2DKwb7gju3IhQloXivEje-bOYBO7YZEouGBODnlKk` | dari backend/.env |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlcXV1Z2FnZmxrZXZza3VlY3VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk0OTg4MCwiZXhwIjoyMDg2NTI1ODgwfQ.Q5wLXNoXES1Ghf4Ax9cN5yTAuHeWnCjOhHOnFaAagPw` | dari backend/.env |
| `ADMIN_EMAIL` | `ruangsidigi@gmail.com` | dari backend/.env |
| `ADMIN_PASSWORD` | `RuangsiDigi25` | dari backend/.env |
| `MAIL_FROM` | `Studigi <ruangsidigi@gmail.com>` | dari backend/.env |
| `SMTP_HOST` | `smtp.gmail.com` | dari backend/.env |
| `SMTP_PORT` | `465` | dari backend/.env |
| `SMTP_SECURE` | `true` | dari backend/.env |
| `SMTP_USER` | `ruangsidigi@gmail.com` | dari backend/.env |
| `SMTP_PASS` | `oafwadfeykwogjfd` | dari backend/.env (Gmail App Password) |
| `MAIL_TRANSPORT` | `smtp` | default |

**Catatan**: Variabel `MIDTRANS_*`, `STORAGE_*`, `CDN_URL`, dll opsional. Tambah jika sebelumnya aktif di Railway.

Setelah semuanya diisi, klik **Deploy**.

### Tahap 4: Tunggu Deploy Selesai

Vercel akan:
1. Build (`npm ci`)
2. Test start command
3. Deploy ke serverless

Tunggu sampai status jadi **Ready** (hijau). Biasanya 1-3 menit.

Output:
- Backend URL baru: `https://studigi-platform-xxxxx.vercel.app` atau terintegrasi dengan custom domain

**Catat URL backend Vercel baru ini** (format: `https://xxxxxx.vercel.app`).

---

## Tahap 5: Verifikasi Backend Hidup

Di browser atau terminal:

```bash
# Copy URL backend dari Vercel, contoh: https://studigi-platform-7xvk2a1q8.vercel.app

# Test health
curl https://studigi-platform-xxxxx.vercel.app/health

# Keduanya harus return:
# {"status":"ok"}
```

Jika **404** atau **500**:
- Vercel dashboard → **Deployments** → klik deploy terbaru → **Logs** → baca error

---

## Tahap 6: Update Frontend ke Backend Vercel Baru

Frontend Vercel sudah ada. Ubah env-nya:

1. Buka Vercel dashboard → project `studigi` (frontend)
2. Settings → **Environment Variables**
3. Cari `REACT_APP_API_URL`
   - **Lama**: `https://studigi.up.railway.app/api`
   - **Baru**: `https://studigi-platform-xxxxx.vercel.app/api` (backend Vercel baru)
4. Klik edit → ubah value → Save

**Redeploy frontend:**
1. Pergi ke **Deployments**
2. Klik **...** di deploy terbaru → **Redeploy**
3. Tunggu selesai

**Atau:**
- Clone repo lokal, ubah `frontend/.env.production`:
  ```
  REACT_APP_API_URL=https://studigi-platform-xxxxx.vercel.app/api
  ```
  - Commit & push → Vercel auto-deploy

## Tahap 7: Update Frontend vercel.json (Rewrite API)

Frontend punya fallback rewrite ke Railway lama. Update ke Vercel backend baru:

Buka `frontend/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://studigi-platform-xxxxx.vercel.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Commit & push → Vercel auto-redeploy.

---

## Tahap 8: Test Koneksi Frontend ↔ Backend

1. Buka https://studigi.vercel.app
2. DevTools → Network tab → Console
3. Lakukan action: Login / buka branding / ambil package list
4. Verifikasi:
   - Request pergi ke domain `studigi-platform-xxxxx.vercel.app`
   - Response 200 (bukan 404/500/CORS)
   - Data muncul di UI

Jika **CORS error**:
- Verzel backend settings → Environment Variables
- Cek `CORS_ORIGINS` = `https://studigi.vercel.app`
- Redeploy backend

---

## Tahap 9: Checklist Endpoint Penting

Sebelum matikan Railway, test manual di Vercel backend ini:

```bash
BACKEND_URL="https://studigi-platform-xxxxx.vercel.app"

# 1. Health
curl $BACKEND_URL/health

# 2. Login (ganti email/pass sesuai test user)
curl -X POST $BACKEND_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 3. Branding
curl $BACKEND_URL/api/branding

# 4. Packages
curl $BACKEND_URL/api/packages

# 5. User profile (ganti TOKEN dari login)
curl $BACKEND_URL/api/users/profile \
  -H "Authorization: Bearer TOKEN"
```

Jika semua 200 ✅ lanjut Tahap 10.

---

## Tahap 10: Matikan Railway Lama

**Jika semua sudah stabil 15-30 menit:**

1. Buka Railway dashboard → https://railway.app
2. Project → `backend` service
3. Settings → **Danger Zone** → **Delete Service** atau **Pause**
4. Konfirmasi

Rekomendasi: **Pause dulu**, jangan hapus. Jika ada issue, bisa nyalakan lagi dalam 24 jam tanpa setup ulang.

---

## Rollback (Jika Ada Masalah)

Jika Vercel backend error:

1. **Balik frontend ke Railway lama:**
   - Vercel frontend → Environment Variables
   - `REACT_APP_API_URL` = `https://studigi.up.railway.app/api`
   - Redeploy

2. **Railway backend nyalakan lagi** (dari Pause).

3. **Debug Vercel logs:**
   - Dashboard → Deployments → klik deploy → Logs
   - Scroll cari error

---

## Checklist Ringkas

- [ ] Tahap 1: Import repo GitHub ke Vercel ✓
- [ ] Tahap 2: Set root directory ke `backend` ✓
- [ ] Tahap 3: Isi semua env variables Vercel
- [ ] Tahap 4: Deploy sukses (status hijau)
- [ ] Tahap 5: Health check `/health` return OK ✓
- [ ] Tahap 6: Update frontend `REACT_APP_API_URL` ✓
- [ ] Tahap 7: Update `frontend/vercel.json` rewrite API ✓
- [ ] Tahap 8: Test login/branding/package dari frontend ✓
- [ ] Tahap 9: Manual curl test endpoint penting ✓
- [ ] Tahap 10: Matikan Railway ✓

---

## Next: Command Terminal

Setelah deploy, jika mau verify dari terminal lokal:

```bash
# Dari workspace root

# Test backend health
cd backend
npm start  # local test dulu

# Atau test Vercel production
curl https://studigi-platform-xxxxx.vercel.app/api/health

# Test frontend lokal pointing to Vercel backend
cd frontend
REACT_APP_API_URL=https://studigi-platform-xxxxx.vercel.app/api npm start
```

---

**Siap dimulai? Mulai dari Tahap 1. Jika stuck, report error dan URL backend Vercel yang dihasilkan.**
