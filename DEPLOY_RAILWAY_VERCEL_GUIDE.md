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

#### Opsional (hanya jika pakai upload file/material)

- `STORAGE_ENDPOINT`
- `STORAGE_BUCKET`
- `STORAGE_KEY`
- `STORAGE_SECRET`
- `CDN_URL`

#### Opsional (hanya jika pakai payment provider nyata)

- `PAYMENT_API_KEY`

5. Setelah semua variable diisi, klik **Deploy** ulang (redeploy) jika Railway tidak auto-redeploy.

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

### Railway Variables (template)

```
DATABASE_URL=...
JWT_SECRET=...
NODE_ENV=production
FRONTEND_URL=https://namafrontend.vercel.app
CORS_ORIGINS=https://namafrontend.vercel.app
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

---

## 7) Catatan Penting untuk Project Ini

Frontend memiliki banyak endpoint fitur lanjutan. Backend modular yang aktif saat ini baru mencakup endpoint inti tertentu (auth, branding, materials upload, payments placeholder). Jadi:

1. Koneksi login + branding + health bisa dibuat stabil dulu.
2. Endpoint lain bisa disambung bertahap per modul setelah deploy dasar berhasil.
