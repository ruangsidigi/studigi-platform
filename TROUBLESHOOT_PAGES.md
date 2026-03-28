# Troubleshoot: Pages Failing to Load

## Jika halaman masih error:

### A. Clear Cache Sepenuhnya
1. Buka `studigi.vercel.app`
2. Tekan `F12` (Dev Tools)
3. Klik kanan tab → **Empty Cache and Hard Reload**
4. Atau: `Ctrl+Shift+Delete` → Clear browsing data → All time → Clear

### B. Check Browser Console
1. F12 → **Console** tab
2. Setiap error yang muncul, screenshot atau copy paste
3. Setiap halaman yang dibuka, lihat apakah ada error messages

### C. Test Login
Jika sudah clear cache:
1. Coba login (`/login`)
2. Buka halaman Dashboard (`/dashboard`)
3. Check jika error berubah (mungkin memerlukan auth)

### D. Specific Pages to Test:
- ✅ `/home` - Katalog (PUBLIC - tidak perlu login)
- ✅ `/contact-us` - Contact (PUBLIC - tidak perlu login)
- ⚠️ `/library` - Library (PROTECTED - perlu login)
- ⚠️ `/activity` - Activity (PROTECTED - perlu login)
- ⚠️ `/dashboard` - Dashboard (PROTECTED - perlu login)

## Expected Behavior After Fixes:

### Home Page (`/home`)
- ✅ Harus tampil paket-paket (7 paket)
- ✅ Punya tombol "Coba Lagi" kalau ada error
- ✅ Auto-retry 3x jika backend timeout

### Pages Lain (Tanpa Login)
- ✅ Harus bisa navigate
- ✅ Kalau perlu auth, redirect ke `/login` atau tampil error "Access token required"

### Pages Lain (Setelah Login)
- ✅ Harus tampil data dengan normal
- ✅ Kalau error API, tampil error message yang jelas

## Backend Health Check:
```
GET /api/health → 200 OK
GET /api/db-check → 200 OK (+ database timestamp)
GET /api/packages → 200 OK (+ 7 packages)
GET /api/categories → 200 OK (+ categories)
```

## Report These:
1. URL yang dibuka  
2. Status code (F12 → Network tab)
3. Response error message
4. Console errors (F12 → Console tab)
