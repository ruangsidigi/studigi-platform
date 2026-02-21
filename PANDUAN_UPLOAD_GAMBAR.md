# 📖 Panduan Upload Gambar Soal - Studigi

## Masalah: Gambar Tidak Muncul di Soal

Jika kamu melihat peringatan `⚠️ Gambar tidak bisa ditampilkan`, ini berarti File tidak bisa diakses.

---

## ✅ Solusi 1: Google Drive (Terserah Kamu)

### Syarat Penting!
**FILE HARUS DI-SHARE DENGAN SETTING "Public" atau "Anyone with the link"**

### Langkah-Langkah:

1. **Upload gambar ke Google Drive**
   - Buka drive.google.com
   - Klik "New" → "File upload"
   - Pilih file gambar soal

2. **PENTING: Set Sharing ke "Public/Anyone with link"**
   ```
   Klik kanan file → Share
   ↓
   Klik "Restricted" (di bawah)
   ↓
   Pilih "Anyone with the link" (JANGAN "Restricted")
   ↓
   Klik Share atau "Copy link"
   ```

3. **Copy Link Sharing**
   - Format: `https://drive.google.com/file/d/[FILE_ID]/view?usp=sharing`
   - Atau: `https://drive.google.com/file/d/[FILE_ID]/view?usp=drive_link`

4. **Paste di Studigi**
   - Login admin
   - Admin Dashboard → Edit Soal
   - Pilih soal yang mau ditambah gambar
   - Scroll ke "Gambar Soal"
   - Paste URL di field "URL Gambar"
   - Tekan "Simpan URL Gambar"

5. **Verifikasi**
   - Gambar akan otomatis ter-convert
   - Ambil tryout → gambar harus muncul

---

## ⭐ Solusi 2: ImgBB (RECOMMENDED - Lebih Mudah!)

ImgBB adalah hosting gambar **GRATIS, CEPAT, dan RELIABLE**.  
Semua gambar langsung bisa diakses publik tanpa perlu sharing setting!

### Langkah-Langkah:

1. **Buka ImgBB**
   - Kunjungi: https://imgbb.com

2. **Upload Gambar**
   - Drag & drop file atau klik "Select Image"
   - Tunggu selesai

3. **Copy Link**
   - Lihat sebelah kanan → "Direct Link"
   - Copy URL (contoh: `https://i.ibb.co/xxxxx/xxxxx.jpg`)

4. **Paste di Studigi**
   - Admin Dashboard → Edit Soal
   - Pilih soal
   - Scroll ke "Gambar Soal"
   - Paste URL ImgBB
   - Tekan "Simpan URL Gambar"

5. **Verifkasi**
   - Ambil tryout → gambar langsung muncul ✅

---

## 🔧 Troubleshooting

### ❌ Google Drive: "Gambar tidak bisa ditampilkan"

**Penyebab:** File belum di-share public

**Solusi:**
- [ ] Cek sharing setting → Harus "Anyone with the link" atau "Public"
- [ ] Pastikan bukan "Restricted"
- [ ] Generate link sharing baru & coba lagi
- [ ] Atau gunakan ImgBB (lebih mudah)

### ❌ ImgBB: Gambar tidak muncul

**Penyebab:** Copy URL yang salah format

**Solusi:**
- [ ] Copy dari "Direct Link" (bukan "HTML" atau "Markdown")
- [ ] URL harus berakhir dengan `.jpg`, `.png`, `.gif`, dll
- [ ] Contoh benar: `https://i.ibb.co/xxxxx/xxxxx.jpg`

### ❌ Preview admin OK, tapi di soal tidak muncul

**Solusi:**
- [ ] Refresh halaman (tekan F5)
- [ ] Buka browser DevTools (F12) → Console tab
- [ ] Lihat error message untuk detail lebih lanjut

---

## 📝 Catatan

- **Google Drive:** Perlu hati-hati setting sharing, tapi gratis unlimited
- **ImgBB:** Recommended karena simple, no login needed, auto public
- **Imgur:** Alternatif lain, tapi butuh account

---

**Pertanyaan?** Cek tab "Panduan Gambar" di Admin Dashboard untuk instruksi lengkap!
