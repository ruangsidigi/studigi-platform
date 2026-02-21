# Quick Start - SKD CPNS Tryout System

Setup cepat hanya dalam 5 menit!

## 1️⃣ Setup Supabase (2 menit)

### Buat Project Supabase

1. Buka https://supabase.com
2. Klik **Create a new project**
3. Isi form:
   - Project Name: `skd-cpns`
   - Database Password: `buatandasendiri` (catat password ini)
   - Region: Asia Southeast (Surabaya/Jakarta)
4. Tunggu ± 1-2 menit hingga project jadi

### Copy API Credentials

1. Di Supabase Dashboard, buka menu **Project Settings** (ikon gear) di kanan bawah
2. Pilih **API** di sidebar
3. Copy:
   - **Project URL** → SUPABASE_URL
   - **anon public** → SUPABASE_KEY

### Setup Database

1. Buka **SQL Editor**
2. Klik **+ New Query**
3. Copy-paste semua kode dari file `database_schema.sql` di project root
4. Klik **Run** (segitiga hijau)
5. ✅ Selesai!

## 2️⃣ Konfigurasi Backend (.env)

Edit file `backend/.env` dan sesuaikan:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...xxxxx
JWT_SECRET=ganti-dengan-string-random-minimal-32-huruf
PORT=5000
NODE_ENV=development
```

**Dapatkan SUPABASE_URL dan SUPABASE_KEY dari Step 1!**

## 3️⃣ Start Server

### Di Folder Project Root

**Windows:**
```bash
start.bat
```

**macOS/Linux:**
```bash
bash start.sh
```

Atau manual:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

## 4️⃣ Login & Explore! 🎉

Buka http://localhost:3000

**Login sebagai Admin:**
- Email: `admin@skdcpns.com`
- Password: `admin123`

**Apa yang bisa dilakukan sekarang:**

### Admin:
- ✅ Lihat dashboard (stats, recent purchases)
- ✅ Buat paket baru
- ✅ Upload soal dari Excel
- ✅ Lihat hasil tryout pengguna
- ✅ Lihat daftar pengguna

### User/Peserta:
- ✅ Register akun baru
- ✅ Lihat paket yang tersedia
- ✅ Tambah ke keranjang
- ✅ Checkout (diskon untuk 3+ paket)
- ✅ Mulai tryout dengan timer
- ✅ Lihat hasil dan pembahasan

## 5️⃣ Upload Soal (Optional)

### Format Excel

Buat file Excel (.xlsx) dengan kolom:

```
number | question_text | option_a | option_b | option_c | option_d | option_e | correct_answer | explanation | category | point_a | point_b | point_c | point_d | point_e | image_url
```

Contoh isi:

```
1 | Apa ibukota Indonesia? | Bandung | Jakarta | Yogyakarta | Surabaya | Medan | B | Jakarta adalah ibukota | TWK | | | | | |
```

Lihat `EXCEL_TEMPLATE.md` untuk info lengkap.

### Upload Langkah

1. Login admin → Admin Dashboard
2. Tab **Upload Soal**
3. Pilih paket (atau buat paket baru di tab **Kelola Paket**)
4. Pilih file Excel
5. Klik **Upload Soal**

## URL Penting

| Service | URL | 
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| Health Check | http://localhost:5000/health |
| Supabase Dashboard | https://supabase.com |

## Troubleshooting

### ❌ "Cannot connect to backend"
- Pastikan backend sudah running: `npm run dev` di folder backend
- Check port 5000 tidak terpakai

### ❌ "SUPABASE_URL tidak ada"
- Buka file `backend/.env`
- Isi SUPABASE_URL dan SUPABASE_KEY dari Step 1
- Restart backend

### ❌ "Database error"
- Cek internet connection
- Pastikan SQL dari `database_schema.sql` sudah dijalankan
- Verify Supabase project sudah aktif

### ❌ "npm: command not found"
- Install Node.js dari https://nodejs.org
- Restart terminal setelahnya

## Next Steps

1. **Upload soal** - Buat file Excel dan upload via admin
2. **Buat paket** - Kelola paket di Admin Dashboard
3. **Test tryout** - Login sebagai user dan ikuti tryout
4. **Invite pengguna** - Share link ke teman untuk test

## Dokumentasi Lengkap

- **SETUP_GUIDE.md** - Panduan detail setup step-by-step
- **EXCEL_TEMPLATE.md** - Format file Excel untuk soal
- **README.md** - Overview sistem lengkap
- **backend/README.md** - Detail API dan backend
- **frontend/README.md** - Detail frontend React

---

**🎯 Target setup: 5 menit**  
**✨ Siap pakai setelah ini!**

Selamat! Sistem sudah siap. Edit soal dan mulai bisnis kursus online Anda! 🚀
