# Setup Guide - SKD CPNS Tryout System

Panduan lengkap untuk setup sistem tryout SKD CPNS dari awal.

## Prerequisites

Pastikan Anda sudah memiliki:
- Node.js v14 atau lebih tinggi (download di https://nodejs.org)
- npm atau yarn
- Akun Supabase (gratis di https://supabase.com)
- Git (opsional, untuk version control)

## Step 1: Buat Project Supabase

1. Kunjungi https://supabase.com
2. Klik "Sign Up" dan daftar
3. Klik "New Project"
4. Isi form:
   - **Project Name**: `skd-cpns-tryout` (atau nama lainnya)
   - **Database Password**: Buat password yang kuat
   - **Region**: Pilih region terdekat (Asia Southeast - Jakarta)
5. Tunggu project dibuat (± 2 menit)

## Step 2: Setup Database Schema

1. Di Supabase dashboard, buka **SQL Editor**
2. Klik **New Query**
3. Copy-paste seluruh isi file `database_schema.sql` dari project folder
4. Klik **Run** untuk menjalankan
5. Tunggu hingga semua query berhasil (akan terlihat di bagian results)

## Step 3: Dapatkan Kredensial API

1. Di Supabase, buka **Project Settings** (ikon gear)
2. Pilih **API** di sidebar kiri
3. Salin:
   - **Project URL** (sebagai SUPABASE_URL)
   - **anon public** key (sebagai SUPABASE_KEY)

## Step 4: Setup Backend

### A. Konfigurasi Environment

1. Buka folder `backend`
2. File `.env` sudah ada, edit dengan text editor:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...xxxxx
JWT_SECRET=super-secret-key-ubah-ini-di-production-minimal-32-karakter
PORT=5000
NODE_ENV=development
```

Gantikan SUPABASE_URL dan SUPABASE_KEY dengan kredensial dari Step 3

### B. Install Dependencies

```bash
cd backend
npm install
```

### C. Test Backend

```bash
npm run dev
```

Seharusnya terlihat:
```
Server running on port 5000
```

Buka browser: http://localhost:5000/health
Seharusnya terlihat: `{"status":"Server is running"}`

## Step 5: Setup Frontend

### A. Konfigurasi Environment

File `frontend/.env` sudah ada dengan konfigurasi default:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### B. Install Dependencies

```bash
cd frontend
npm install
```

### C. Run Frontend

```bash
npm start
```

Seharusnya browser otomatis membuka http://localhost:3000

## Step 6: Login Pertama Kali

Setelah kedua server berjalan:

1. **Frontend** berjalan di http://localhost:3000
2. **Backend** berjalan di http://localhost:5000

### Login dengan akun admin default:

**Email**: `admin@skdcpns.com`  
**Password**: `admin123`

Mari test:
1. Klik "Login" di halaman login
2. Masukkan email dan password di atas
3. Seharusnya redirect ke admin dashboard

## Step 7: Impor Data Soal

### Membuat File Excel

1. Buat file dengan nama `soal_twk.xlsx` (atau nama lainnya)
2. Buat header dengan kolom berikut:

| number | question_text | option_a | option_b | option_c | option_d | option_e | correct_answer | explanation | category | point_a | point_b | point_c | point_d | point_e | image_url |
|--------|---------------|----------|----------|----------|----------|----------|----------------|-------------|----------|---------|---------|---------|---------|---------|-----------|

Contoh data:

| number | question_text | option_a | option_b | option_c | option_d | option_e | correct_answer | explanation | category | point_a | point_b | point_c | point_d | point_e | image_url |
|--------|---------------|----------|----------|----------|----------|----------|----------------|-------------|----------|---------|---------|---------|---------|---------|-----------|
| 1 | Berapa ibukota Indonesia? | Bandung | Jakarta | Yogyakarta | Surabaya | Medan | B | Jakarta adalah ibukota Indonesia sejak 1945 | TWK | | | | | | |
| 2 | Manakah pahlawan nasional? | Dilan | Soekarno | Ucup | Asep | Suryani | B | Soekarno adalah presiden Indonesia pertama | TWK | | | | | | |

Catatan:
- Untuk soal figural TIU (no 59-65), isi kolom `image_url` dengan URL gambar
- Untuk soal TKP, isi kolom `point_a` sampai `point_e` dengan poin untuk setiap jawaban
- Untuk soal TWK dan TIU, point_a-e boleh kosong

### Upload ke Admin Dashboard

1. Login sebagai admin
2. Klik **Admin Dashboard**
3. Pilih tab **Upload Soal**
4. Pilih paket yang sudah dibuat (atau buat paket baru di tab **Kelola Paket**)
5. Upload file Excel
6. Klik **Upload Soal**
7. Tunggu hingga selesai

## Step 8: Buat Akun Pengguna (untuk testing)

1. Klik **Register** di halaman utama
2. Isi form:
   - Nama: `Peserta Test`
   - Email: `peserta@example.com`
   - Password: `password123`
3. Confirm password dan daftar

## Step 9: Test Fitur Tryout

### Sebagai Peserta:
1. Login dengan akun peserta
2. Di dashboard, akan terlihat paket yang tersedia
3. Pilih paket dan klik **Tambah ke Keranjang**
4. Checkout dengan harga yang ditampilkan
5. Setelah checkout, klik **Mulai Tryout**

### Selama Tryout:
- Timer akan menghitung mundur
- Jawab soal dengan klik pilihan jawaban
- Gunakan navigasi di sebelah kanan untuk loncat ke soal tertentu
- Klik **Finish Tryout** saat selesai

### Hasil dan Pembahasan:
- Lihat score untuk TWK, TIU, TKP
- Status LULUS/TIDAK LULUS akan muncul
- Klik nomor soal yang salah untuk melihat pembahasan

## Troubleshooting

### "Cannot GET /health"

**Masalah**: Backend tidak running
**Solusi**: 
```bash
cd backend
npm run dev
```

### "Error: getaddrinfo ENOTFOUND localhost"

**Masalah**: Backend tidak terhubung
**Solusi**: Pastikan backend sudah running di port 5000

### "SUPABASE_URL error"

**Masalah**: Environment variable tidak terbaca
**Solusi**: 
1. Pastikan file `.env` sudah di folder backend
2. Restart backend: `npm run dev`

### Kolom tidak muncul waktu upload soal

**Masalah**: Format Excel salah
**Solusi**: Pastikan header kolom persis seperti template (case-sensitive)

### Timer tidak countdown

**Masalah**: Hook React issue
**Solusi**: Refresh halaman browser

## Production Deployment

Untuk deploy ke production:

### Backend (Heroku/Railway)
```bash
# Set environment variables di production
# Deploy code Anda
```

### Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy folder build/
```

### Update REACT_APP_API_URL
Ubah ke URL backend production, bukan localhost

## Database Maintenance

### Backup Database
1. Buka Supabase dashboard
2. **Backups** di sidebar
3. Download backup database secara berkala

### Monitor Usage
1. Buka **Project Settings > Database**
2. Lihat usage dan rate limits

## Support

Jika ada masalah:
1. Cek console browser (F12 > Console)
2. Cek terminal backend untuk error logs
3. Baca file README.md di folder backend dan frontend
4. Cek dokumentasi Supabase: https://supabase.com/docs

---

Selamat! Sistem sudah siap digunakan. Mulai tambahkan soal dan paket tryout Anda!
