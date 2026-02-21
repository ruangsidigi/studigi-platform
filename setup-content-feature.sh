#!/bin/bash

# Quick Start: Content Upload Feature Integration
# Run these commands in order to set up the feature

echo "════════════════════════════════════════════════════════"
echo "📤 Content Upload Feature - Quick Setup"
echo "════════════════════════════════════════════════════════"
echo ""

# Step 1: Run database migration
echo "Step 1️⃣  Running database migration..."
echo "   - Running: backend/db/migrations/009_add_content_visibility.sql"
echo "   - Note: Execute this in Supabase SQL editor"
echo ""

# Step 2: Verify backend files
echo "Step 2️⃣  Verifying backend files..."
if [ -f "backend/src/services/fileStorageService.js" ]; then
  echo "   ✅ fileStorageService.js created"
else
  echo "   ⚠️  fileStorageService.js NOT found"
fi

if [ -f "backend/src/controllers/contentController.js" ]; then
  echo "   ✅ contentController.js created"
else
  echo "   ⚠️  contentController.js NOT found"
fi

if [ -f "backend/src/routes/content.js" ]; then
  echo "   ✅ content.js routes created"
else
  echo "   ⚠️  content.js routes NOT found"
fi

echo ""

# Step 3: Check if routes are registered
echo "Step 3️⃣  Checking route registration..."
if grep -q "'/api/content'" "backend/src/server.js"; then
  echo "   ✅ Content routes registered in server.js"
else
  echo "   ⚠️  Content routes NOT registered - add this line:"
  echo "      app.use('/api/content', require('./routes/content'));"
fi

echo ""

# Step 4: Verify frontend files
echo "Step 4️⃣  Verifying frontend files..."
if [ -f "frontend/src/components/ContentUploadForm.js" ]; then
  echo "   ✅ ContentUploadForm.js created"
else
  echo "   ⚠️  ContentUploadForm.js NOT found"
fi

if [ -f "frontend/src/components/VisibilityBadge.js" ]; then
  echo "   ✅ VisibilityBadge.js created"
else
  echo "   ⚠️  VisibilityBadge.js NOT found"
fi

if [ -f "frontend/src/pages/ContentManagementPage.js" ]; then
  echo "   ✅ ContentManagementPage.js created"
else
  echo "   ⚠️  ContentManagementPage.js NOT found"
fi

echo ""

# Step 5: Create storage directories
echo "Step 5️⃣  Creating storage directories..."
mkdir -p "storage/materials"
mkdir -p "storage/excel"
echo "   ✅ Created /storage/materials/"
echo "   ✅ Created /storage/excel/"

echo ""

# Step 6: Summary
echo "════════════════════════════════════════════════════════"
echo "✅ Setup Complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1️⃣  DATABASE:"
echo "   - Go to Supabase SQL Editor"
echo "   - Execute: backend/db/migrations/009_add_content_visibility.sql"
echo ""
echo "2️⃣  BACKEND:"
echo "   - Make sure HTTP calls work with token auth"
echo "   - Test endpoint: POST /api/content/upload"
echo ""
echo "3️⃣  FRONTEND:"
echo "   - Import ContentUploadForm in your admin page"
echo "   - Import VisibilityBadge where needed"
echo "   - Use ContentManagementPage as reference template"
echo ""
echo "4️⃣  INTEGRATION:"
echo "   - Add route to /api/content in App.js"
echo "   - Add link to Admin Dashboard menu"
echo "   - Update dashboard queries to filter by visibility"
echo ""
echo "5️⃣  TESTING:"
echo "   - Upload a test PDF (Materi)"
echo "   - Upload a test Excel (Soal)"
echo "   - Toggle visibility on packages"
echo "   - Verify peserta dashboard shows only visible packages"
echo ""
echo "📚 Documentation:"
echo "   - See: CONTENT_UPLOAD_GUIDE.md for full details"
echo "   - See: backend/docs/DASHBOARD_QUERIES.js for query examples"
echo ""
echo "════════════════════════════════════════════════════════"
