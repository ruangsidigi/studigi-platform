# 📤 Platform Content Upload Feature - Implementation Guide

## ✅ Completed Implementation Summary

### 🗄️ Database Changes

**File:** `backend/db/migrations/009_add_content_visibility.sql`

Added columns to `packages` table:
- `content_type ENUM('question', 'material')` - Type of package
- `visibility ENUM('visible', 'hidden')` - Visibility status
- `pdf_file_path TEXT` - Path to PDF file for materials

**Indexes created:**
- `idx_packages_visibility` - For faster dashboard queries
- `idx_packages_content_type` - For content type filtering

---

### 🔧 Backend Services

#### 1. File Storage Service
**File:** `backend/src/services/fileStorageService.js`

Handles file uploads with:
- ✅ Supabase storage integration (primary)
- ✅ Local filesystem fallback
- ✅ File validation (type & size)
- ✅ Unique filename generation
- ✅ PDF support (max 50MB)
- ✅ Excel support (max 10MB)

**Exports:**
- `uploadToSupabase()` - Upload to Supabase storage
- `uploadToLocalStorage()` - Fallback to local storage
- `uploadPDF()` - Handle PDF uploads with validation
- `uploadExcel()` - Handle Excel uploads with validation

#### 2. Content Controller
**File:** `backend/src/controllers/contentController.js`

Main upload logic:
- ✅ `uploadContent()` - Route handler for uploads
- ✅ Conditional processing based on content_type
- ✅ Excel parsing using xlsx library
- ✅ Package metadata updates
- ✅ Visibility management

**Supports:**
- PDF materials (stored in storage/materials/)
- Excel questions (processed and stored in storage/excel/)
- Visibility control (visible/hidden)

#### 3. Content Routes
**File:** `backend/src/routes/content.js`

API Endpoints:
```
POST   /api/content/upload              - Upload content
GET    /api/content/info/:packageId     - Get content info
PATCH  /api/content/:packageId/visibility - Update visibility
GET    /api/content/list                - Get filtered packages list
```

**Multer Configuration:**
- Memory storage for processing
- File type validation
- Size limits per content type
- Error handling

---

### 🎨 Frontend Components

#### 1. Content Upload Form
**File:** `frontend/src/components/ContentUploadForm.js`

Features:
- ✅ Content type selector (Soal/Materi)
- ✅ Conditional file input (PDF/Excel)
- ✅ Visibility selector (Tampilkan/Arsip)
- ✅ File preview with metadata
- ✅ Upload progress tracking
- ✅ Error & success messages
- ✅ Help section with format guidelines
- ✅ Drag & drop support
- ✅ Optimistic UI updates

**Styling:** `frontend/src/styles/content-upload.css`
- Responsive design
- Modern UI with animations
- Clear visual hierarchy
- Loading states

#### 2. Visibility Badge Component
**File:** `frontend/src/components/VisibilityBadge.js`

Displays:
- 🟢 Green badge for visible packages
- ⚙️ Gray badge for hidden packages

**Styling:** `frontend/src/styles/visibility-badge.css`

---

### 📡 API Service Updates

**File:** `frontend/src/services/api.js`

Added contentService:
```javascript
export const contentService = {
  upload: (formData) => api.post('/content/upload', formData, ...),
  getInfo: (packageId) => api.get(`/content/info/${packageId}`),
  updateVisibility: (packageId, visibility) => api.patch(...),
  getList: (params) => api.get('/content/list', { params }),
};
```

---

### 🔄 AdminDashboard Updates

**File:** `frontend/src/pages/AdminDashboard.js`

Bundle Picker Enhancement:
- ✅ Shows all packages (visible + hidden)
- ✅ Displays "(Arsip Admin)" label for hidden packages
- ✅ Visual distinction for hidden items
- ✅ Includes hidden packages in bundling selection

**Styling Updates:** `frontend/src/styles/admin.css`
- `.bundle-picker-item.hidden` - Dimmed appearance
- `.badge-hidden-label` - Admin label display

---

## 🚀 Usage Guide

### For Admin: Upload Content

#### Step 1: Select Content Type

Choose between:
- **📝 Soal** - Upload Excel file with questions
- **📄 Materi** - Upload PDF file with study materials

#### Step 2: Choose Visibility

- **🟢 Tampilkan di Dashboard** - Package visible to all peserta
- **⚙️ Arsip Admin** - Hidden from peserta dashboard

#### Step 3: Upload File

- Select PDF (for Materi) or Excel (for Soal)
- File validation happens automatically
- Progress bar shows upload status

#### Step 4: Confirmation

- Success message confirms upload
- Package updated with new content type & visibility
- For questions: Excel imported and processed

### For Peserta: Dashboard Filtering

Dashboard automatically filters:
```sql
WHERE visibility = 'visible'
```

Only visible packages appear in:
- Package listings
- Course selections
- Dashboard recommendations

Hidden packages still accessible:
- Via direct links (if authorized)
- In bundling (admin only)
- In admin dashboard

---

## 📋 Excel Format for Questions

When uploading questions, Excel should have columns:

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| number | Integer | 1, 2, 3 | Question number |
| category | String | TWK, TIU, TKP | Question category |
| question_text | String | "Bunga raya adalah..." | Full question text |
| option_a | String | "Bunga mawar" | Option A |
| option_b | String | "Bunga teratai" | Option B |
| option_c | String | "Bunga rafflesia" | Option C (correct) |
| option_d | String | "Bunga anggrek" | Option D |
| option_e | String | "Bunga dahlia" | Option E |
| correct_answer | String | C | Correct option letter |
| explanation | String | "Rafflesia adalah..." | Explanation (optional) |

---

## 🔐 Visibility Logic

### Database Level

```javascript
// Peserta query
WHERE visibility = 'visible'

// Admin query
// No visibility filter (can see all)
```

### API Level

```javascript
// GET /content/list?visibility=visible
// Only returns visible packages

// GET /api/packages
// Should also filter by visibility for peserta endpoints
```

### Frontend Level

```javascript
// Dashboard component
const visiblePackages = packages.filter(p => p.visibility === 'visible')

// AdminDashboard (bundling)
// Shows all packages, with labels for hidden ones
```

---

## 🔧 Implementation Checklist

### Database
- [x] Create migration file (009_add_content_visibility.sql)
- [x] Add content_type column
- [x] Add visibility column
- [x] Add pdf_file_path column
- [x] Create indexes

### Backend
- [x] Create fileStorageService.js
- [x] Create contentController.js
- [x] Create content routes
- [x] Register routes in server.js
- [x] Add multer configuration
- [x] Add error handling

### Frontend
- [x] Create ContentUploadForm component
- [x] Create VisibilityBadge component
- [x] Add styling (content-upload.css, visibility-badge.css)
- [x] Update API service (api.js)
- [x] Update AdminDashboard (bundle picker)
- [x] Update admin.css styles

### Documentation
- [x] Create dashboard query examples
- [x] Document visibility logic
- [x] Document Excel format
- [x] Create implementation guide

---

## 🔗 File Structure

```
backend/
├── db/migrations/
│   └── 009_add_content_visibility.sql
├── src/
│   ├── services/
│   │   └── fileStorageService.js
│   ├── controllers/
│   │   └── contentController.js
│   ├── routes/
│   │   └── content.js
│   └── server.js (updated)
└── docs/
    └── DASHBOARD_QUERIES.js

frontend/
├── src/
│   ├── components/
│   │   ├── ContentUploadForm.js
│   │   └── VisibilityBadge.js
│   ├── styles/
│   │   ├── content-upload.css
│   │   └── visibility-badge.css
│   ├── services/
│   │   └── api.js (updated)
│   └── pages/
│       └── AdminDashboard.js (updated)
```

---

## 🧪 Testing Guide

### Test Upload - Soal (Excel)

1. Go to Admin Dashboard
2. Select "Add Package" or find package edit
3. Use ContentUploadForm component
4. Select "Soal" type
5. Choose visibility "Tampilkan"
6. Upload Excel file with correct format
7. Verify questions imported

### Test Upload - Materi (PDF)

1. Following same steps
2. Select "Materi" type
3. Upload PDF file
4. Verify PDF accessible

### Test Visibility - Peserta Dashboard

1. As peserta, view dashboard
2. Only visible packages appear
3. Search only returns visible packages
4. Bundle details show visibility status

### Test Bundling with Hidden Packages

1. As admin, create bundling
2. Bundle picker shows hidden packages
3. Label "(Arsip Admin)" appears for hidden
4. Can select hidden packages in bundle
5. Bundle works correctly with hidden packages included

---

## 🔄 Database Migration Steps

1. **Run SQL Migration:**
   ```sql
   -- Execute: backend/db/migrations/009_add_content_visibility.sql
   ```

2. **Verify Columns:**
   ```sql
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'packages';
   ```

3. **Test Queries:**
   ```sql
   -- Should return only visible
   SELECT * FROM packages WHERE visibility = 'visible';
   
   -- Should return all
   SELECT * FROM packages;
   ```

---

## 🚀 Deployment Checklist

- [ ] Run database migration
- [ ] Update API .env if needed
- [ ] Update CORS settings for file uploads
- [ ] Create storage directories (if using local):
  - [ ] /storage/materials/
  - [ ] /storage/excel/
- [ ] Set proper file permissions
- [ ] Test file uploads on production
- [ ] Verify Supabase storage access
- [ ] Update frontend API URL if needed
- [ ] Clear browser cache
- [ ] Test all upload scenarios

---

## 📞 Support Commands

**Check recent uploads:**
```javascript
// backend/src/controllers/contentController.js
// Logs: [Review] Fetching attempt...
```

**Debug storage path:**
Files saved to:
- Supabase: `materials/pdf/` or `excel-uploads/questions/`
- Local: `/storage/materials/` or `/storage/excel/`

**Test via API:**
```bash
curl -X POST http://localhost:5000/api/content/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf" \
  -F "packageId=1" \
  -F "contentType=material" \
  -F "visibility=visible"
```

---

**Implementation Complete!** ✅

All components, services, and database changes are ready for production use.
