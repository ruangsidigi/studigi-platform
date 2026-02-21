const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const fs = require('fs');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get questions by package
router.get('/package/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;

    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('package_id', packageId)
      .order('number', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single question
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: question, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload questions from Excel
router.post(
  '/upload',
  authenticateToken,
  authorizeRole(['admin']),
  upload.single('file'),
  async (req, res) => {
    try {
      const { packageId } = req.body;

      if (!packageId || !req.file) {
        return res.status(400).json({ error: 'Package ID and file are required' });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Excel file is empty' });
      }

      // Transform data
      const questions = rows.map((row) => ({
        package_id: parseInt(packageId),
        number: row.number,
        question_text: row.question_text,
        option_a: row.option_a,
        option_b: row.option_b,
        option_c: row.option_c,
        option_d: row.option_d,
        option_e: row.option_e,
        correct_answer: row.correct_answer,
        explanation: row.explanation,
        category: row.category, // TWK, TIU, TKP
        point_a: row.point_a || null,
        point_b: row.point_b || null,
        point_c: row.point_c || null,
        point_d: row.point_d || null,
        point_e: row.point_e || null,
        image_url: row.image_url || null,
        created_at: new Date(),
      }));

      // Insert to database
      const { data, error } = await supabase
        .from('questions')
        .insert(questions)
        .select();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({
        message: `${data.length} questions imported successfully`,
        count: data.length,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Update question
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data: updatedQuestion, error } = await supabase
      .from('questions')
      .update({
        ...updateData,
        updated_at: new Date(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Question updated successfully',
      question: updatedQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete question
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload image for question (via URL or direct update)
router.post(
  '/:id/image',
  authenticateToken,
  authorizeRole(['admin']),
  upload.single('image'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { imageUrl } = req.body;

      // Either use provided URL or upload file as base64
      let finalImageUrl = imageUrl;

      if (req.file && !imageUrl) {
        // Convert file to base64 if file uploaded
        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype || 'image/jpeg';
        finalImageUrl = `data:${mimeType};base64,${base64}`;
      }

      if (!finalImageUrl) {
        return res.status(400).json({ error: 'Image URL or file is required' });
      }

      // Update question with image URL or base64
      const { data: updatedQuestion, error: updateError } = await supabase
        .from('questions')
        .update({
          image_url: finalImageUrl,
          updated_at: new Date(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      res.json({
        message: 'Image updated successfully',
        image_url: finalImageUrl,
        question: updatedQuestion,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
