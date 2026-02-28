# Panduan Lengkap Deploy Backend Railway + Frontend Vercel

Panduan ini dibuat khusus untuk struktur project ini.

## 0) Persiapan Sebelum Klik Apa Pun

1. Pastikan project sudah ada di GitHub (branch utama yang mau dideploy).
2. Siapkan data berikut (nanti dipaste di Railway/Vercel):
   - `DATABASE_URL` (PostgreSQL connection string)
   - `JWT_SECRET` (string random minimal 32 karakter)
   - URL frontend Vercel (contoh: `https://namaproject.vercel.app`)
3. Pastikan backend dan frontend lokal minimal bisa start:
   - Backend health: `http://localhost:5000/health`
   - Frontend lokal: `http://localhost:3000`

---

## 1) Deploy Backend ke Railway

### A. Buat service baru dari GitHub

1. Buka Railway dashboard.
2. Klik **New Project**.
3. Klik **Deploy from GitHub repo**.
4. Pilih repository project ini.
5. Saat diminta root directory/service path, pilih folder: **`backend`**.

### B. Set Build & Start command

Di service Railway backend:

1. Buka tab **Settings**.
2. Cari bagian **Build** / **Deploy**.
3. Pastikan command:
   - Build command: `npm install`
   - Start command: `npm start`
4. Simpan perubahan.

### C. Tambahkan Environment Variables backend

Masuk ke tab **Variables**, lalu klik **New Variable** satu per satu:

#### Wajib (minimal agar API hidup)

- `DATABASE_URL` = connection string PostgreSQL production
- `JWT_SECRET` = string acak kuat (contoh panjang 40+ karakter)
- `NODE_ENV` = `production`

`PORT` **tidak perlu diisi manual di Railway** (Railway otomatis inject `PORT`).

#### Wajib untuk CORS frontend Vercel

- `FRONTEND_URL` = URL frontend Vercel kamu (contoh `https://nama-frontend.vercel.app`)
- `CORS_ORIGINS` = daftar origin dipisah koma, contoh:
  - `https://nama-frontend.vercel.app,https://www.domainkamu.com`

#### Wajib untuk Verifikasi Email + Lupa Password (Gmail SMTP)

- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `465`
- `SMTP_SECURE` = `true`
- `SMTP_USER` = alamat Gmail pengirim (contoh: `akunanda@gmail.com`)
- `SMTP_PASS` = **App Password Gmail 16 karakter** (bukan password login Gmail)
- `MAIL_FROM` = format nama pengirim, contoh `Studigi <akunanda@gmail.com>`

Alternatif pasangan Gmail yang valid:
- `SMTP_PORT=587`
- `SMTP_SECURE=false`

Jika tetap gagal dari environment serverless tertentu, siapkan fallback API email:
- `RESEND_API_KEY` (opsional, tapi direkomendasikan sebagai backup)
- `RESEND_FROM` (contoh: `Studigi <noreply@domainanda.com>`)
- `MAIL_TRANSPORT=resend` (agar kirim mencoba Resend dulu, bukan SMTP)
- `MAIL_FORCE_RESEND=true` (opsional, memaksa mode Resend)

Untuk test cepat Resend tanpa domain custom, bisa pakai:
- `RESEND_FROM=onboarding@resend.dev`
Catatan: alamat ini biasanya hanya bisa kirim ke email akun Resend Anda sendiri.

#### Opsional (hanya jika pakai upload file/material)

- `STORAGE_ENDPOINT`
- `STORAGE_BUCKET`
- `STORAGE_KEY`
- `STORAGE_SECRET`
- `CDN_URL`

#### Opsional (hanya jika pakai payment provider nyata)

- `PAYMENT_API_KEY`

5. Setelah semua variable diisi, klik **Deploy** ulang (redeploy) jika Railway tidak auto-redeploy.

### C1. Cara membuat Gmail App Password (wajib untuk SMTP_PASS)

1. Login ke akun Gmail yang akan jadi pengirim.
2. Buka **Manage your Google Account**.
3. Masuk ke tab **Security**.
4. Aktifkan **2-Step Verification** terlebih dahulu (jika belum aktif).
5. Setelah aktif, buka menu **App passwords**.
6. Pilih app: `Mail`, device: `Other` (isi misalnya `Studigi Railway`).
7. Klik **Generate**.
8. Copy password 16 karakter (tanpa spasi) ke `SMTP_PASS` di Railway.
9. Simpan, lalu redeploy backend.

### D. Ambil URL backend Railway

1. Di halaman service, buka tab **Settings** / **Networking**.
2. Copy public domain Railway, contoh:
   - `https://backend-xxx.up.railway.app`
3. Simpan URL ini, akan dipakai di Vercel.

### E. Tes backend Railway langsung

Di browser:

- `https://backend-xxx.up.railway.app/health`
- `https://backend-xxx.up.railway.app/api/health`

Keduanya harus return JSON status ok.

---

## 2) Deploy Frontend ke Vercel

### A. Import project

1. Buka Vercel dashboard.
2. Klik **Add New...** → **Project**.
3. Pilih repo GitHub project ini.
4. Saat form konfigurasi muncul, set:
   - **Framework Preset**: Create React App (biasanya auto)
   - **Root Directory**: `frontend`

### B. Isi Environment Variables di Vercel

Di bagian **Environment Variables**, tambah:

- `REACT_APP_API_URL` = `https://backend-xxx.up.railway.app/api`

Pastikan ada `/api` di belakang URL.

### C. Deploy

1. Klik **Deploy**.
2. Tunggu selesai build.
3. Copy URL frontend Vercel yang dihasilkan.

### D. Sinkronisasi balik ke Railway (penting)

Setelah dapat URL frontend final dari Vercel:

1. Kembali ke Railway backend.
2. Update variable:
   - `FRONTEND_URL` = URL frontend final
   - `CORS_ORIGINS` = tambahkan URL frontend final
3. Redeploy backend Railway.

### E. Input di Vercel (yang perlu diisi)

Untuk arsitektur **backend di Railway + frontend di Vercel**, variabel email SMTP **tidak wajib** di Vercel frontend.

Jika kamu juga menjalankan backend serverless di Vercel (folder `api/`), baru isi juga variabel ini di project Vercel backend:
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

Praktik yang disarankan: tetap pakai Railway untuk backend utama agar koneksi SMTP lebih stabil, dan Vercel untuk frontend saja.

---

## 3) Checklist Koneksi Frontend ↔ Backend

1. Dari frontend Vercel, buka DevTools → Network.
2. Coba login.
3. Pastikan request menuju domain Railway (bukan localhost).
4. Pastikan tidak ada error:
   - `CORS`
   - `Network Error`
   - `404` untuk endpoint inti (`/api/auth/login`, `/api/branding`, `/api/health`)

---

## 4) Perubahan Kode yang Sudah Disesuaikan

Untuk mempermudah koneksi deploy, codebase sudah diperbaiki:

1. CORS backend diaktifkan dan bisa whitelist origin dari env.
2. Login backend sekarang mengembalikan format `{ token, user }` agar cocok dengan frontend.
3. JWT verify/sign memakai fallback aman saat secret belum diset.
4. Endpoint upload material mendukung dua path:
   - `/api/materials`
   - `/api/materials/upload`
5. Response branding sudah menyediakan key camelCase + snake_case agar kompatibel frontend.

---

## 5) Jika Masih Gagal, Cek Dengan Urutan Ini

1. **Frontend masih nembak localhost**
   - Salah setting `REACT_APP_API_URL` di Vercel.
   - Solusi: update env lalu redeploy frontend.

2. **CORS blocked**
   - `FRONTEND_URL` / `CORS_ORIGINS` di Railway belum sesuai URL frontend final.
   - Solusi: update variable dan redeploy backend.

3. **Login 401/500**
   - Cek `JWT_SECRET` dan `DATABASE_URL`.
   - Cek data user di database.

4. **Endpoint 404**
   - Pastikan request ke `.../api/...`.
   - Pastikan service Railway mengarah ke folder `backend`.

5. **Build fail di Railway**
   - Pastikan build command `npm install` dan start command `npm start`.

---

## 6) Data Copy-Paste Cepat

### Konfigurasi domain Anda (siap pakai)

```
RAILWAY_BACKEND_URL=https://studigi.up.railway.app
VERCEL_FRONTEND_URL=https://sidigi.vercel.app
REACT_APP_API_URL=https://studigi.up.railway.app/api
FRONTEND_URL=https://sidigi.vercel.app
CORS_ORIGINS=https://sidigi.vercel.app
```

### Railway Variables (template)

```
DATABASE_URL=...
JWT_SECRET=...
NODE_ENV=production
FRONTEND_URL=https://namafrontend.vercel.app
CORS_ORIGINS=https://namafrontend.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=akunanda@gmail.com
SMTP_PASS=app_password_16_karakter
MAIL_FROM=Studigi <akunanda@gmail.com>
RESEND_API_KEY=
RESEND_FROM=
MAIL_TRANSPORT=resend
MAIL_FORCE_RESEND=true
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_KEY=
STORAGE_SECRET=
CDN_URL=
PAYMENT_API_KEY=
```

### Vercel Variables (template)

```
REACT_APP_API_URL=https://namabackend.up.railway.app/api
```

### Supabase (yang perlu diinput)

Tidak ada env khusus email yang wajib di Supabase untuk flow ini, karena email dikirim oleh backend.
Yang perlu dilakukan di Supabase:

1. Pastikan tabel token auth tersedia (`auth_tokens`).
2. Pastikan kolom user verifikasi tersedia (`users.email_verified`, `users.email_verified_at`).
3. Jika belum ada, jalankan SQL berikut di SQL Editor Supabase:

```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
   id BIGSERIAL PRIMARY KEY,
   user_id BIGINT NULL,
   email VARCHAR(255) NOT NULL,
   purpose VARCHAR(50) NOT NULL,
   token_hash VARCHAR(128) NOT NULL,
   expires_at TIMESTAMPTZ NOT NULL,
   used_at TIMESTAMPTZ NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_email_purpose ON auth_tokens(email, purpose);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;
```

### GitHub (yang perlu diinput)

- Tidak perlu input secret di GitHub jika deploy dilakukan manual dari dashboard Railway/Vercel.
- Wajib dilakukan: commit + push perubahan terbaru ke branch yang dipakai deploy.
- Jika memakai auto-deploy, push ke branch tersebut akan trigger deploy otomatis.

---

## 7) Catatan Penting untuk Project Ini

Frontend memiliki banyak endpoint fitur lanjutan. Backend modular yang aktif saat ini baru mencakup endpoint inti tertentu (auth, branding, materials upload, payments placeholder). Jadi:

1. Koneksi login + branding + health bisa dibuat stabil dulu.
2. Endpoint lain bisa disambung bertahap per modul setelah deploy dasar berhasil.

---

## 8) Validasi Cepat Setelah Input Variable

Lakukan ini setelah selesai input env di Railway/Vercel dan deploy sukses.

### A. Validasi SMTP dari backend

Jika bisa akses shell service backend, jalankan:

```bash
npm run smtp:test
```

Expected: muncul `[SMTP_TEST] verify OK`.

### B. Validasi alur auth email

Dari lokal project backend:

```bash
cd backend
AUTH_TEST_BASE_URL=https://your-backend-domain/api npm run auth:flow:test
```

PowerShell (Windows):

```powershell
cd backend
$env:AUTH_TEST_BASE_URL="https://studigi.up.railway.app/api"
npm run auth:flow:test
```

Expected hasil:
1. `register` status 201/200.
2. `login_before_verify` status **403** (ini benar: user wajib verifikasi email dulu).
3. `resend_verification` status 200.
4. `forgot_password` status 200.

### C. Validasi link frontend

Pastikan URL berikut bisa dibuka di frontend Vercel:

1. `https://your-frontend-domain/verify-email?token=dummy`
2. `https://your-frontend-domain/reset-password?token=dummy`

Kalau halaman terbuka (meski token dummy invalid), berarti routing frontend sudah benar.
