# SKD CPNS Tryout System

Platform tryout SKD CPNS lengkap dengan sistem pembelajaran dan penilaian otomatis.

## Fitur

✅ **Sistem Autentikasi**
- Register dan login untuk pengguna
- Lupa password dan reset password
- Role-based access (admin & user)

✅ **Manajemen Paket**
- Paket tryout dan latihan soal
- Kategori materi: TWK, TIU, TKP
- Harga flexible dengan diskon bulk

✅ **Sistem Soal**
- Import soal dari Excel langsung ke database
- Dukungan gambar untuk soal figural
- Poin berbeda per jawaban (khusus TKP)

✅ **Sistem Ujian**
- Timer 100 menit untuk setiap tryout
- Navigasi soal interaktif
- Save answer otomatis
- Scoring real-time

✅ **Penilaian & Hasil**
- Perhitungan skor TWK, TIU, TKP terpisah
- Status lulus/tidak lulus dengan kriteria:
  - TWK > 65
  - TIU > 85
  - TKP > 166
- Pembahasan on-demand (klik soal yang salah)

✅ **Admin Dashboard**
- Kelola paket
- Upload soal dari Excel
- Lihat hasil tryout semua pengguna
- Dashboard statistik

✅ **Shopping Cart**
- Beli 1 atau multiple paket
- Diskon 10% untuk pembelian 3+ paket
- Tracking pembelian

## Quick Start

### 1. Setup Backend

```bash
cd backend

# Copy .env dan edit dengan kredensial Supabase Anda
cp .env.example .env

# Install dependencies
npm install

# Run backend
npm run dev
```

Backend akan berjalan di `http://localhost:5000`

### 2. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run frontend
npm start
```

Frontend akan berjalan di `http://localhost:3000`

### 3. Setup Database (Supabase)

1. Buat project baru di [Supabase](https://supabase.com)
2. Buka Supabase SQL Editor
3. Copy semua SQL dari `database_schema.sql`
4. Jalankan SQL tersebut

### 4. Konfigurasi Environment Variables

**Backend** (`backend/.env`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
JWT_SECRET=your-super-secret-jwt-key
PORT=5000
```

**Frontend** (`frontend/.env`):
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Default Admin Account

Email: `admin@skdcpns.com`  
Password: `admin123`

## Struktur Project

```
tryout-skd-cpns/
├── backend/                 # Node.js + Express Server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth middleware
│   │   ├── config/         # Database config
│   │   └── server.js       # Main server file
│   ├── package.json
│   ├── .env
│   └── README.md
│
├── frontend/               # React App
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API calls
│   │   ├── context/       # Auth context
│   │   ├── styles/        # CSS files
│   │   └── App.js
│   ├── package.json
│   ├── .env
│   └── README.md
│
├── database_schema.sql    # SQL untuk database setup
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register pengguna
- `POST /api/auth/login` - Login pengguna
- `POST /api/auth/forgot-password` - Request reset password
- `POST /api/auth/reset-password` - Reset password dengan token

### Packages
- `GET /api/packages` - Lihat semua paket
- `POST /api/packages` - Buat paket (admin)
- `PUT /api/packages/:id` - Edit paket (admin)
- `DELETE /api/packages/:id` - Hapus paket (admin)

### Questions
- `GET /api/questions/package/:packageId` - Lihat soal per paket
- `POST /api/questions/upload` - Upload soal dari Excel (admin)
- `PUT /api/questions/:id` - Edit soal (admin)
- `DELETE /api/questions/:id` - Hapus soal (admin)

### Tryouts
- `POST /api/tryouts/start` - Mulai tryout
- `POST /api/tryouts/submit-answer` - Submit jawaban
- `POST /api/tryouts/finish` - Selesaikan tryout
- `GET /api/tryouts/:sessionId/results` - Lihat hasil & pembahasan

### Purchases
- `GET /api/purchases` - Lihat pembelian user
- `POST /api/purchases` - Beli paket
- `GET /api/purchases/admin/all` - Lihat semua pembelian (admin)

### Admin
- `GET /api/admin/stats` - Dashboard statistik
- `GET /api/admin/users` - Daftar pengguna
- `GET /api/admin/tryout-results` - Hasil tryout semua user

## Format Excel untuk Upload Soal

Header kolom yang diharapkan:

| number | question_text | option_a | option_b | option_c | option_d | option_e | correct_answer | explanation | category | point_a | point_b | point_c | point_d | point_e | image_url |
|--------|---------------|----------|----------|----------|----------|----------|----------------|-------------|----------|---------|---------|---------|---------|---------|-----------|

- **number**: Nomor urut soal
- **question_text**: Teks pertanyaan
- **option_a-e**: Pilihan jawaban A-E
- **correct_answer**: Jawaban benar (A/B/C/D/E)
- **explanation**: Pembahasan soal
- **category**: Kategori jenis soal (TWK/TIU/TKP)
- **point_a-e**: Poin untuk setiap jawaban (spesial untuk TKP)
- **image_url**: URL gambar untuk soal figural

## Kriteria Lulus

- **TWK**: > 65% (dari jumlah soal TWK)
- **TIU**: > 85% (dari jumlah soal TIU)
- **TKP**: > 166 (total poin dari semua soal TKP)

Peserta **LULUS** jika memenuhi SEMUA kriteria di atas.

## Features untuk Enhancement

- [ ] Integrasi payment gateway (Midtrans/Stripe)
- [ ] Email notifications
- [ ] Sertifikat digital
- [ ] Analytics lebih detail
- [ ] Mobile app version
- [ ] Soal terbaru notifikasi
- [ ] Community forum

## Troubleshooting

### Koneksi database error
- Pastikan SUPABASE_URL dan SUPABASE_KEY benar
- Cek ketersediaan internet
- Verify database sudah di-setup dengan schema yang benar

### Login error
- Cek email dan password
- Pastikan user sudah terdaftar
- Check JWT_SECRET configuration

### Excel upload error
- Pastikan format kolom sesuai dengan template
- Gunakan Excel format .xlsx atau .xls
- Kategori soal harus TWK/TIU/TKP

## Technical Stack

**Backend:**
- Node.js v14+
- Express.js
- Supabase (PostgreSQL)
- JWT authentication
- XLSX parsing

**Frontend:**
- React 18
- React Router v6
- Axios
- CSS3
- Responsive design

**Deployment:**
- Backend: Heroku, Railway, atau VPS
- Frontend: Vercel, Netlify, atau Surge
- Database: Supabase (managed)

## License

MIT

## Support

Untuk pertanyaan atau masalah, silakan buka issue di repository ini.

---

**Dibuat dengan ❤️ untuk membantu Anda lolos SKD CPNS**
