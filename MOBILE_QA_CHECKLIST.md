# MOBILE QA CHECKLIST

Gunakan device width: **390 x 844** (iPhone 12/13) + **360 x 800** (Android umum).

## 1) Login / Register
- [ ] Halaman tidak overflow horizontal.
- [ ] Form input tetap terlihat saat keyboard muncul.
- [ ] Tombol submit bisa ditekan tanpa menutup keyboard manual.
- [ ] Link pindah Login/Register tetap terbaca dan bisa diklik.

## 2) Navbar
- [ ] Logo tidak terpotong.
- [ ] Menu bisa diakses di layar kecil (wrap/scroll horizontal jika penuh).
- [ ] Nama user tidak menabrak tombol logout.

## 3) Dashboard Peserta
- [ ] Tombol aksi (Adaptive Dashboard, Materi Saya) stack rapi.
- [ ] Kartu kategori tampil 1 kolom di HP.
- [ ] Tidak ada teks/card keluar layar.

## 4) Halaman Quiz
- [ ] Teks soal terbaca nyaman, tidak terlalu kecil.
- [ ] Opsi jawaban mudah ditap (jarak cukup).
- [ ] Navigator nomor soal tidak overflow.
- [ ] Footer aksi (Previous/Finish/Next) tetap bisa diakses di bawah.
- [ ] Gambar soal tidak terpotong.

## 5) Halaman Results
- [ ] Header + tombol review tidak bertabrakan.
- [ ] Grid skor responsif (2 kolom / 1 kolom saat sempit).
- [ ] Expand pembahasan soal tidak merusak layout.

## 6) Halaman Review
- [ ] Header skor tetap rapi di HP.
- [ ] Sidebar/filter soal tetap bisa dipakai.
- [ ] Tombol navigasi soal sebelumnya/berikutnya nyaman ditap.
- [ ] Panel pembahasan tidak overflow.

## 7) Adaptive Dashboard
- [ ] Kartu progress/insight tampil 1 kolom.
- [ ] Progress bar dan nilai tidak saling bertumpuk.
- [ ] Tabel Study Plan bisa discroll horizontal tanpa merusak halaman.

## 8) Admin Dashboard
- [ ] Tab admin bisa digeser horizontal.
- [ ] Tabel panjang bisa discroll horizontal.
- [ ] Form Kelola Paket, Materi PDF, Campaign tetap usable di HP.

---

## Smoke Test Cepat (5 Menit)
1. Login user biasa.
2. Buka Dashboard peserta.
3. Mulai 1 quiz, jawab 3 soal.
4. Finish dan buka Results + Review.
5. Login admin, cek tab Kelola Paket + Campaign.

Jika semua lolos, build siap untuk rilis mobile baseline.