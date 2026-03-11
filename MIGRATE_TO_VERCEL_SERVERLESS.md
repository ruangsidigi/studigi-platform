# Migrasi Backend ke Vercel Serverless

Backend Anda sudah siap untuk Vercel. Panduan ini meliputi setup, deployment, dan cutover.

## Persiapan: Apa yang Sudah Ada

✅ Backend sudah punya:
- Entry serverless: `backend/api/index.js` (wrapper Express dengan `serverless-http`)
- Routing Vercel: `backend/vercel.json` (route `/api/*` ke `backend/api/index.js`)
- Konfigurasi port dinamis: environment variable `PORT` dari Vercel
- Health endpoint: `GET /health` dan `GET /api/health`
- Storage cloud-only: fallback lokal sudah dimatikan
- Webhook idempotent: payment webhook tahan retry

## Langkah 1 – Push Repo ke GitHub

Jika belum ada, commit semua perubahan dan push ke GitHub (dengan akses publik untuk Vercel).

```bash
cd c:\Users\ACER\tryout-skd-cpns
git add .
git commit -m "Backend hardened for Vercel serverless + idempotent webhook + cloud storage only"
git push origin main
```

Catat **repository URL** dari GitHub (format: `https://github.com/username/repo-name`).

## Langkah 2 – Import Repo ke Vercel

1. Buka [vercel.com](https://vercel.com) → login akun Anda
2. Klik **Add New** → **Project**
3. Klik **Import Git Repository**
4. Cari repo GitHub Anda dan pilih
5. Klik **Import**

## Langkah 3 – Konfigurasi Project di Vercel

Di form konfigurasi:

### Build & Deployment
- **Framework**: Other (Node.js)
- **Root Directory**: `backend` (penting!)
- **Build Command**: `npm install` (atau kosong jika tidak ada build)
- **Output Directory**: `.` (default)
- **Install Command**: `npm ci` atau `npm install`

### Environment Variables (wajib diisi)

Klik **Environment Variables** dan tambah satu-satu:

#### Wajib untuk API hidup:
- `NODE_ENV` = `production`
- `DATABASE_URL` = koneksi Postgres production (dari Railway/Supabase lama)
- `PG_CONNECTION_STRING` = _kosong_ (atau sama dengan `DATABASE_URL`)
- `JWT_SECRET` = secret yang sama seperti di Railway

#### Wajib untuk CORS frontend:
- `FRONTEND_URL` = URL frontend Vercel Anda (contoh: `https://frontend-xxx.vercel.app`)
- `CORS_ORIGINS` = daftar origin (contoh: `https://frontend-xxx.vercel.app,https://domain-custom.com`)

#### Email (jika email tersetup di Railway):
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587` atau `465`
- `SMTP_SECURE` = `true` (jika port 465) atau `false` (jika 587)
- `SMTP_USER` = email Gmail pengirim
- `SMTP_PASS` = Gmail App Password (16 karakter)
- `MAIL_FROM` = format nama, contoh `Studigi <pengirim@gmail.com>`

#### Opsional (hanya jika dipakai di Railway):
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (jika Supabase)
- `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_KEY`, `STORAGE_SECRET`, `CDN_URL` (jika S3/storage custom)
- `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION` (jika payment)
- `RESEND_API_KEY`, `RESEND_FROM`, `MAIL_TRANSPORT`, `MAIL_FORCE_RESEND` (jika email Resend)
- `REDIS_URL`, `BULLMQ_ENABLED`, `BULLMQ_QUEUE_NAME` (jika background job BullMQ)

## Langkah 4 – Deploy

1. Klik **Deploy**
2. Tunggu sampai selesai (build + deployment biasanya 1-3 menit)
3. Setelah sukses, copy URL backend Vercel yang diberikan (format: `https://xxx.vercel.app`)

## Langkah 5 – Verifikasi Backend Hidup

Di browser atau terminal:

```bash
# Health check
curl https://xxx.vercel.app/health
curl https://xxx.vercel.app/api/health

# Keduanya harus return JSON: { "status": "ok" }
```

Jika ada error 404/500, cek **Vercel Logs** (dashboard project → "Deployments" → log terakhir).

## Langkah 6 – Update Frontend ke Vercel Backend URL

### Option A: Deploy Frontend di Vercel juga (rekomendasi)

1. Buka frontend project di Vercel
2. Settings → Environment Variables
3. Ubah / tambah:
   - `REACT_APP_API_URL` = `https://xxx.vercel.app/api` (URL backend Vercel + `/api`)
4. Redeploy frontend (push perubahan atau manual redeploy di dashboard)

### Option B: Frontend masih di tempat lain

1. Edit `frontend/.env.production`:
   ```
   REACT_APP_API_URL=https://xxx.vercel.app/api
   ```
2. Edit `frontend/vercel.json`:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://xxx.vercel.app/api/:path*"
       },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
3. Commit dan push
4. Redeploy frontend

## Langkah 7 – Test Koneksi Frontend → Backend

1. Buka frontend URL
2. DevTools → Network tab
3. Coba login atau action yang hit API (contoh: load branding, ambil package list)
4. Pastikan:
   - Request menuju domain Vercel backend (bukan localhost/Railway lama)
   - Response 200/201 (tidak 404/500/CORS error)
   - Data muncul di UI

## Langkah 8 – Checklist Verifikasi per Endpoint

Sebelum matikan Railway, verifikasi endpoint penting ini berhasil di Vercel:

- `GET /api/health` → 200 JSON
- `POST /api/auth/login` → 200 + token
- `GET /api/branding` → 200 + logo/header_color
- `GET /api/packages` → 200 + package list
- `POST /api/content/upload` → 400+ (terima file, tolak jika salah format)
- `POST /api/payments/checkout` (jika payment aktif) → 200 + snap_token (Midtrans)
- `POST /api/payments/webhook` (simulasi) → 200 acknowledged
- `GET /api/users/profile` → 200 + user data

Jika semua sukses, lanjut ke Langkah 9.

## Langkah 9 – Matikan Railway Lama

Jika semuanya stabil 15-30 menit di Vercel:

1. Buka Railway dashboard
2. Services → backend service lama → Settings
3. Klik **Danger Zone** → **Delete Service**
4. Konfirmasi

Atau lebih aman: pause dulu, jangan hapus selamanya.

## Rollback (Jika Ada Error)

Jika ada masalah di Vercel:

1. **Frontend balik ke Railway lama:**
   ```
   REACT_APP_API_URL=https://studigi.up.railway.app/api
   ```
   Redeploy frontend.

2. **Re-enable Railway service** (jika sudah dihapus, buat baru).

3. **Cek logs Vercel** untuk debugging:
   - Dashboard → Deployments → latest → Logs/Output

## Troubleshooting Umum

### 502 / 503 Error
- Cek env variables di Vercel (terutama `DATABASE_URL`, `JWT_SECRET`)
- Vercel logs → lihat error detail

### CORS Blocked
- Pastikan `FRONTEND_URL` dan `CORS_ORIGINS` di Vercel backend sudah sesuai URL frontend final
- Redeploy backend jika ada perubahan env

### Timeout (>30 detik)
- Vercel function ada timeout max 30s (Hobby) / 60s (Pro)
- Endpoint berat (upload besar, query kompleks) bisa timeout
- Solusi: pecah jadi operation async atau upgrade plan

### Login gagal / 401
- Cek `JWT_SECRET` cocok antara old Railway dan Vercel baru
- Jika berbeda, refresh login di frontend

### Database connection error
- Pastikan `DATABASE_URL` sudah di-copy tepat dari Railway → Vercel
- Test koneksi lokal dulu: `node -e "const pg = require('pg'); const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()').then(r => console.log(r.rows)).catch(e => console.error(e)); pool.end();"`

## Catatan Akhir

- Vercel Hobby Plan (gratis): 5 concurrent functions, 3 deployments/day, limit execution 30s
- Jika traffic naik, upgrade ke Pro (~$20/bulan)
- Monitor Vercel usage di dashboard (Functions → Metrics)
- Cold start: function idle → request pertama bisa 1-2 detik lebih lambat (normal)

---

Siap? Mulai dari Langkah 1. Jika ada pertanyaan atau stuck, tanyakan.
