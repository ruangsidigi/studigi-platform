/**
 * Content Controller
 * Handles uploads for materials (PDF) and questions (Excel)
 */

const supabase = require('../config/supabase');
const fileStorageService = require('../services/fileStorageService');
const questionService = require('../services/questionService');
const xlsx = require('xlsx');

/**
 * Upload content based on type
 * POST /api/content/upload
 * Body: { packageId, contentType, visibility, file, packageName }
 */
const uploadContent = async (req, res) => {
  try {
    const { packageId, contentType, visibility, packageName } = req.body;
    const file = req.file;

    // Validation
    if (!packageId) {
      return res.status(400).json({ error: 'packageId is required' });
    }

    if (!contentType || !['question', 'material'].includes(contentType)) {
      return res.status(400).json({ error: 'contentType must be "question" or "material"' });
    }

    if (!visibility || !['visible', 'hidden'].includes(visibility)) {
      return res.status(400).json({ error: 'visibility must be "visible" or "hidden"' });
    }

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Verify package exists
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, name')
      .eq('id', parseInt(packageId))
      .single();

    if (pkgError || !pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    let uploadResult;
    let processResult;

    if (contentType === 'material') {
      // Handle PDF upload
      try {
        uploadResult = await fileStorageService.uploadPDF(
          file.buffer,
          file.originalname,
          pkg.name
        );
      } catch (error) {
        return res.status(400).json({ error: `PDF upload failed: ${error.message}` });
      }

      // Update package with PDF path and content type
      const { error: updateError } = await supabase
        .from('packages')
        .update({
          content_type: 'material',
          visibility: visibility,
          pdf_file_path: uploadResult.path,
          updated_at: new Date(),
        })
        .eq('id', parseInt(packageId));

      if (updateError) {
        return res.status(500).json({ error: `Failed to update package: ${updateError.message}` });
      }

      processResult = {
        type: 'material',
        filePath: uploadResult.path,
        fileName: file.originalname,
        publicUrl: uploadResult.publicUrl,
      };

    } else if (contentType === 'question') {
      // Handle Excel upload
      try {
        // First upload the file
        uploadResult = await fileStorageService.uploadExcel(
          file.buffer,
          file.originalname
        );

        // Parse Excel file
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
          return res.status(400).json({ error: 'Excel file is empty' });
        }

        // Process questions (use existing service)
        const processedQuestions = await questionService.processExcelQuestions(
          data,
          parseInt(packageId)
        );

        // Update package with content type and visibility
        const { error: updateError } = await supabase
          .from('packages')
          .update({
            content_type: 'question',
            visibility: visibility,
            updated_at: new Date(),
          })
          .eq('id', parseInt(packageId));

        if (updateError) {
          return res.status(500).json({ error: `Failed to update package: ${updateError.message}` });
        }

        processResult = {
          type: 'question',
          filePath: uploadResult.path,
          fileName: file.originalname,
          questionsProcessed: processedQuestions.length,
          questions: processedQuestions.slice(0, 5), // Return first 5 for preview
        };

      } catch (error) {
        return res.status(400).json({ error: `Excel processing failed: ${error.message}` });
      }
    }

    res.json({
      success: true,
      message: `Content uploaded successfully`,
      packageId: parseInt(packageId),
      contentType,
      visibility,
      ...processResult,
    });

  } catch (error) {
    console.error('Content upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
};

/**
 * Get content info for a package
 * GET /api/content/info/:packageId
 */
const getContentInfo = async (req, res) => {
  try {
    const { packageId } = req.params;

    const { data: pkg, error } = await supabase
      .from('packages')
      .select('id, name, content_type, visibility, pdf_file_path, description')
      .eq('id', parseInt(packageId))
      .single();

    if (error || !pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json({
      packageId: pkg.id,
      packageName: pkg.name,
      contentType: pkg.content_type || 'question',
      visibility: pkg.visibility || 'visible',
      pdfPath: pkg.pdf_file_path,
      description: pkg.description,
    });

  } catch (error) {
    console.error('Error getting content info:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update package visibility
 * PATCH /api/content/:packageId/visibility
 * Body: { visibility }
 */
const updateVisibility = async (req, res) => {
  try {
    const { packageId } = req.params;
    const { visibility } = req.body;

    if (!visibility || !['visible', 'hidden'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value' });
    }

    const { error } = await supabase
      .from('packages')
      .update({
        visibility,
        updated_at: new Date(),
      })
      .eq('id', parseInt(packageId));

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      message: 'Visibility updated',
      packageId: parseInt(packageId),
      visibility,
    });

  } catch (error) {
    console.error('Error updating visibility:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get list of packages with filters
 * GET /api/content/list?visibility=visible&contentType=question
 */
const getPackagesList = async (req, res) => {
  try {
    const { visibility, contentType, userId } = req.query;

    let query = supabase
      .from('packages')
      .select('id, name, content_type, visibility, description, price, question_count');

    // Filter by visibility
    if (visibility) {
      query = query.eq('visibility', visibility);
    }

    // Filter by content type
    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      total: data.length,
      packages: data,
    });

  } catch (error) {
    console.error('Error getting packages list:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  uploadContent,
  getContentInfo,
  updateVisibility,
  getPackagesList,
};
