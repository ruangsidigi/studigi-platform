# Format Excel untuk Upload Soal

Panduan lengkap format file Excel untuk upload soal ke sistem.

## Kolom yang Harus Ada (WAJIB)

| Nama Kolom | Tipe | Deskripsi |
|-----------|------|-----------|
| number | Integer | Nomor urut soal (1, 2, 3, ...) |
| question_text | Text | Teks lengkap pertanyaan |
| option_a | Text | Pilihan jawaban A |
| option_b | Text | Pilihan jawaban B |
| option_c | Text | Pilihan jawaban C |
| option_d | Text | Pilihan jawaban D |
| option_e | Text | Pilihan jawaban E |
| correct_answer | Text | Jawaban benar (A, B, C, D, atau E) |
| explanation | Text | Pembahasan/penjelasan jawaban |
| category | Text | Kategori: TWK, TIU, atau TKP |
| point_a | Integer | Poin jawaban A (untuk TKP) |
| point_b | Integer | Poin jawaban B (untuk TKP) |
| point_c | Integer | Poin jawaban C (untuk TKP) |
| point_d | Integer | Poin jawaban D (untuk TKP) |
| point_e | Integer | Poin jawaban E (untuk TKP) |
| image_url | Text | URL gambar soal (untuk soal figural) |

## Aturan Penting

### 1. Nama Header (Case Sensitive)
HARUS PERSIS seperti di atas (dengan underscore, bukan spasi)

### 2. Kategori Soal
Hanya 3 pilihan yang valid:
- **TWK** = Test Wawasan Kebangsaan (40 soal)
- **TIU** = Tes Intelegensi Umum (50 soal)
- **TKP** = Tes Karakteristik Pribadi (95 soal)

### 3. Kolom Point (untuk TKP)
- Isi dengan angka poin untuk setiap jawaban
- Misal: A=0, B=1, C=2, D=3, E=4
- Untuk TWK dan TIU, bisa kosong (tidak berpengaruh)

### 4. Kolom image_url
- Opsional
- Gunakan untuk soal figural TIU nomor 59-65
- Isi dengan URL lengkap: `https://example.com/image.jpg`
- Format: JPG atau PNG

### 5. Correct Answer
Hanya 1 karakter: A, B, C, D, atau E (UPPERCASE)

## Contoh File TWK

```
number | question_text | option_a | option_b | option_c | option_d | option_e | correct_answer | explanation | category | point_a | point_b | point_c | point_d | point_e | image_url
1 | Apa ibukota Indonesia? | Bandung | Jakarta | Yogyakarta | Surabaya | Medan | B | Jakarta adalah ibukota Indonesia | TWK | | | | | |
2 | Siapakah proklamator Indonesia? | Soekarno | Hatta | Soekarno dan Hatta | Budi Utomo | Gajah Mada | C | Soekarno dan Hatta memproklamasikan kemerdekaan Indonesia | TWK | | | | | |
3 | Berapa banyak pulau di Indonesia? | 13000 | 17000 | 19000 | 20000 | 25000 | B | Indonesia memiliki kurang lebih 17000 pulau | TWK | | | | | |
```

## Contoh File TIU

```
number | question_text | option_a | option_b | option_c | option_d | option_e | correct_answer | explanation | category | point_a | point_b | point_c | point_d | point_e | image_url
1 | Jika A = 5 dan B = 3, berapa A + B? | 6 | 8 | 7 | 9 | 10 | B | 5 + 3 = 8 | TIU | | | | | |
2 | Lanjutkan deret: 2, 4, 6, 8, ... | 10 | 9 | 12 | 11 | 8 | A | Deret angka genap bertambah 2 | TIU | | | | | |
59 | Manakah gambar yang melanjutkan pola? | Gambar A | Gambar B | Gambar C | Gambar D | Gambar E | C | Analisis pola visual menunjukkan jawaban C | TIU | | | | | | https://example.com/figural-59.jpg
```

## Contoh File TKP

```
number | question_text | option_a | option_b | option_c | option_d | option_e | correct_answer | explanation | category | point_a | point_b | point_c | point_d | point_e | image_url
1 | Anda diminta atasan mengerjakan tugas yang tidak termasuk tanggung jawab Anda. Apa yang Anda lakukan? | Menolak langsung | Menjelaskan dengan sopan | Mengerjakan tanpa protes | Melaporkan ke pimpinan | Membiarkan tugas itu | B | Profesional dengan komunikasi sopan | TKP | 0 | 4 | 2 | 1 | 0
2 | Saat ada konflik dalam tim, Anda akan? | Membiarkan | Mencari penyelesaian | Memihak salah satu | Menghindari | Meninggalkan tim | B | Penyelesaian konstruktif adalah kunci | TKP | 1 | 4 | 2 | 0 | 0
```

## Tips dan Trik

### 1. Membuat Excel di Google Sheets
- Buat di Google Sheets
- Download sebagai .xlsx
- Upload ke sistem

### 2. Membuat dari Template
- Copy contoh di atas
- Paste ke Excel
- Ganti dengan data Anda

### 3. Validasi Data
Sebelum upload, cek:
- ✅ Semua header ada
- ✅ Kategori hanya TWK/TIU/TKP
- ✅ Correct answer hanya A-E
- ✅ Number urut (1, 2, 3, ...)

### 4. Batch Upload
- Bisa upload dari 1 file dengan 100+ soal
- Sistem akan validasi semua sebelum insert

### 5. Edit Soal Setelah Upload
- Admin bisa edit individual soal di dashboard
- Atau upload ulang file yang sudah diperbaiki

## Troubleshooting

### Error: "Column not found"
**Penyebab**: Nama kolom tidak tepat
**Solusi**: Cek spelling dan gunakan underscore, bukan spasi

### Error: "Invalid category"
**Penyebab**: Category bukan TWK/TIU/TKP
**Solusi**: Ganti dengan salah satu dari ketiga kategori

### Error: "Invalid answer"
**Penyebab**: Correct answer bukan A-E
**Solusi**: Pastikan value hanya 1 karakter A, B, C, D, atau E

### Upload tapi soal tidak muncul
**Penyebab**: Package ID mungkin salah atau soal duplicate
**Solusi**: 
1. Cek package ID di dashboard
2. Cek apakah soal sudah ada sebelumnya
3. Try upload ulang dengan double-check

## File Format Support

- ✅ Excel (.xlsx) - RECOMMENDED
- ✅ Excel (.xls) - Lama, masih support
- ✅ CSV (.csv) - Jika diperlukan

Gunakan XLSX untuk hasil terbaik.

## Ukuran File

- Max file size: 5 MB
- Recommended: Kebawah 1000 soal per file
- Jika lebih, split jadi beberapa file

---

Siap membuat soal Anda? Ikuti template di atas dan upload via Admin Dashboard!
