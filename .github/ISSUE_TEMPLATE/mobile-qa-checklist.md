---
name: Mobile QA Checklist
about: Validasi cepat kualitas tampilan dan UX di perangkat handphone sebelum rilis
title: "[Mobile QA]"
labels: [qa, mobile]
assignees: []
---

## Device & Browser
- Device width: [ ] 390 x 844 (iPhone 12/13)
- Device width: [ ] 360 x 800 (Android)
- Browser: [ ] Chrome [ ] Safari [ ] Lainnya: 

## 1) Login / Register
- [ ] Tidak ada overflow horizontal
- [ ] Input tetap terlihat saat keyboard muncul
- [ ] Tombol submit tetap mudah diakses
- [ ] Link Login/Register bisa diklik normal

## 2) Navbar
- [ ] Logo tidak terpotong
- [ ] Menu tetap bisa diakses saat sempit
- [ ] Nama user tidak menabrak tombol logout

## 3) Dashboard Peserta
- [ ] Tombol aksi tampil rapi di mobile
- [ ] Kartu kategori tampil rapi (1 kolom)
- [ ] Tidak ada elemen keluar layar

## 4) Quiz
- [ ] Teks soal terbaca nyaman
- [ ] Opsi jawaban mudah ditap
- [ ] Navigator nomor soal tidak overflow
- [ ] Footer Previous/Finish/Next tetap bisa dipakai
- [ ] Gambar soal tidak terpotong

## 5) Results
- [ ] Header + tombol review tidak bertabrakan
- [ ] Grid skor responsif
- [ ] Expand pembahasan tidak merusak layout

## 6) Review
- [ ] Header skor rapi di mobile
- [ ] Sidebar/filter soal tetap usable
- [ ] Tombol navigasi soal nyaman ditap
- [ ] Panel pembahasan tidak overflow

## 7) Adaptive Dashboard
- [ ] Card tampil rapi (single column di mobile)
- [ ] Progress row tidak bertumpuk
- [ ] Tabel Study Plan bisa di-scroll horizontal

## 8) Admin Dashboard
- [ ] Tab admin bisa digeser horizontal
- [ ] Tabel panjang bisa di-scroll horizontal
- [ ] Form Kelola Paket/Materi PDF/Campaign tetap usable

## Smoke Test (5 menit)
- [ ] Login user biasa
- [ ] Buka dashboard peserta
- [ ] Mulai quiz dan jawab minimal 3 soal
- [ ] Finish dan buka Results + Review
- [ ] Login admin, cek Kelola Paket + Campaign

## Catatan Temuan
- Screenshot / rekaman: 
- Halaman terdampak: 
- Severity: [ ] Low [ ] Medium [ ] High
- Rekomendasi perbaikan: 