# Migrasi Backend dari Railway ke Render

Dokumen ini khusus untuk repo ini: backend Node.js di folder `backend/` dan frontend React di `frontend/` (deploy ke Vercel).

## Ringkasan Arsitektur Target

- Backend: Render Web Service (long-running Node app)
- Frontend: Vercel
- Database: tetap (Supabase/Postgres yang sama)
- Domain API baru: `https://<service-name>.onrender.com`

Backend ini sudah cocok untuk Render karena:
- Start command sudah ada: `npm start` (menjalankan `backend/server.js`)
- Port memakai `process.env.PORT` melalui `shared/config/index.js`
- Health endpoint tersedia: `GET /health` dan `GET /api/health`

## Yang Sudah Saya Siapkan di Repo

1. `render.yaml` di root repo (Blueprint Render).
2. Daftar env variable backend sudah dipetakan ke konfigurasi Render.

File referensi:
- `render.yaml`
- `backend/package.json`
- `backend/shared/config/index.js`
- `backend/src/server.js`

## Langkah 1 - Persiapan Data dari Railway

Di Railway service backend lama, salin semua variable yang dipakai backend, minimal:

- `DATABASE_URL` atau `PG_CONNECTION_STRING`
- `JWT_SECRET`
- `FRONTEND_URL`
- `CORS_ORIGINS`

Jika fitur terkait dipakai, salin juga:

- Email: `SMTP_*`, `MAIL_FROM`, `RESEND_*`, `MAIL_TRANSPORT`, `MAIL_FORCE_*`, `APPS_SCRIPT_*`
- Storage: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_KEY`, `STORAGE_SECRET`, `CDN_URL`
- Payment: `MIDTRANS_*`, `PAYMENT_API_KEY`, `SYSTEM_PAYMENT_MODE`
- Queue: `BULLMQ_ENABLED`, `REDIS_URL`, `BULLMQ_QUEUE_NAME`
- Supabase: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Catatan:
- Jangan set `PORT` manual di Render. Render inject `PORT` otomatis.
- `NODE_ENV=production` wajib.

## Langkah 2 - Deploy Backend ke Render (Blueprint)

### Opsi A (disarankan): Pakai `render.yaml`

1. Push perubahan repo ini ke GitHub.
2. Buka Render Dashboard -> `New` -> `Blueprint`.
3. Pilih repository ini.
4. Render akan membaca `render.yaml` dan membuat `studigi-backend` service.
5. Isi semua env dengan nilai dari Railway (yang `sync: false` harus Anda isi manual).
6. Klik `Apply` / `Create Resources`.
7. Tunggu deploy selesai.

### Opsi B: Manual Web Service

1. Render Dashboard -> `New` -> `Web Service`.
2. Connect GitHub repo ini.
3. Set:
- Root Directory: `backend`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`
4. Tambahkan env variables yang sama seperti Railway.
5. Deploy.

## Langkah 3 - Verifikasi Backend Render

Setelah deploy, ambil URL Render, contoh:
- `https://studigi-backend.onrender.com`

Tes endpoint:

- `https://studigi-backend.onrender.com/health`
- `https://studigi-backend.onrender.com/api/health`

Keduanya harus mengembalikan status OK (JSON).

## Langkah 4 - Pindahkan Frontend ke URL Backend Render

Di project frontend Vercel, ubah env:

- `REACT_APP_API_URL=https://studigi-backend.onrender.com/api`

Lalu redeploy frontend di Vercel.

### Penting

Masih ada hardcode Railway di `frontend/vercel.json` untuk rewrite fallback `/api/*`.
Setelah URL Render final ada, ganti:

- dari `https://studigi.up.railway.app/api/:path*`
- menjadi `https://<service-name>.onrender.com/api/:path*`

Kemudian commit + redeploy frontend.

## Langkah 5 - Sinkronisasi CORS di Backend Render

Di env Render backend, pastikan:

- `FRONTEND_URL=https://<frontend-vercel-domain>`
- `CORS_ORIGINS=https://<frontend-vercel-domain>,https://<domain-custom-anda-jika-ada>`

Lalu redeploy backend Render.

## Langkah 6 - Cutover Tanpa Downtime

Urutan aman:

1. Deploy Render backend dulu.
2. Test endpoint penting di Render (`/health`, login, endpoint utama).
3. Ubah `REACT_APP_API_URL` frontend ke Render.
4. Redeploy frontend.
5. Monitoring 15-30 menit (error login, CORS, payment webhook, email).
6. Jika stabil, nonaktifkan Railway service lama.

## Checklist Verifikasi Pasca Migrasi

- `GET /health` sukses.
- `GET /api/health` sukses.
- Login user sukses (`/api/auth/login`).
- Branding dan dashboard load normal.
- Upload (jika dipakai) berhasil.
- Email verifikasi/lupa password terkirim.
- Payment webhook (Midtrans) masuk ke domain Render baru.

## Update Endpoint Pihak Ketiga Setelah Cutover

Jika menggunakan Midtrans/layanan webhook lain:

- Update callback/webhook dari domain Railway ke domain Render.
- Contoh baru: `https://studigi-backend.onrender.com/api/payments/webhook`

## Rollback Plan (Jika Ada Error)

1. Kembalikan env frontend Vercel:
- `REACT_APP_API_URL=https://studigi.up.railway.app/api`
2. Redeploy frontend.
3. Investigasi log Render, perbaiki env/koneksi.
4. Coba cutover lagi setelah valid.

## Troubleshooting Cepat

- Build gagal: pastikan Root Directory `backend`.
- App hidup tapi request gagal: cek `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`.
- CORS error: pastikan domain frontend final sudah masuk `FRONTEND_URL` dan `CORS_ORIGINS`.
- 502/timeout awal: Render Free bisa cold start; gunakan health ping periodik jika perlu.

## Catatan Eksekusi oleh Saya vs Anda

Saya sudah menjalankan bagian yang bisa dilakukan dari kode repository (menambahkan konfigurasi Render + panduan teknis).

Langkah yang wajib Anda lakukan manual di dashboard (karena butuh akses akun/secret):
- Membuat service di Render
- Mengisi env secrets
- Menghubungkan domain/SSL
- Mengubah env di Vercel
