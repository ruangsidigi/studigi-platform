const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024,
  },
});

const getUserRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((role) => String(role?.name || role?.role || '').toLowerCase())
    .filter(Boolean);
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  const roleNames = getUserRoleNames(req.user);
  const isAdmin =
    roleNames.includes('admin') ||
    String(req.user.role || '').toLowerCase() === 'admin' ||
    String(req.user.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin only' });
  return next();
};

const normalizeKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\uFEFF/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const normalizeRow = (row) => {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    normalized[normalizeKey(key)] = value;
  }
  return normalized;
};

const pickValue = (row, aliases = []) => {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const aliasMap = {
  number: ['number', 'no', 'nomor'],
  question_text: ['question_text', 'question', 'soal', 'pertanyaan'],
  option_a: ['option_a', 'a', 'pilihan_a'],
  option_b: ['option_b', 'b', 'pilihan_b'],
  option_c: ['option_c', 'c', 'pilihan_c'],
  option_d: ['option_d', 'd', 'pilihan_d'],
  option_e: ['option_e', 'e', 'pilihan_e'],
  correct_answer: ['correct_answer', 'answer', 'jawaban_benar', 'kunci_jawaban'],
  explanation: ['explanation', 'pembahasan', 'penjelasan'],
  category: ['category', 'kategori'],
  point_a: ['point_a', 'poin_a', 'nilai_a'],
  point_b: ['point_b', 'poin_b', 'nilai_b'],
  point_c: ['point_c', 'poin_c', 'nilai_c'],
  point_d: ['point_d', 'poin_d', 'nilai_d'],
  point_e: ['point_e', 'poin_e', 'nilai_e'],
  image_url: ['image_url', 'gambar', 'url_gambar', 'image'],
};

const defaultColumnIndexMap = {
  number: 0,
  question_text: 1,
  option_a: 2,
  option_b: 3,
  option_c: 4,
  option_d: 5,
  option_e: 6,
  correct_answer: 7,
  explanation: 8,
  category: 9,
  point_a: 10,
  point_b: 11,
  point_c: 12,
  point_d: 13,
  point_e: 14,
  image_url: 15,
};

const detectHeaderIndexMap = (grid) => {
  for (let rowIdx = 0; rowIdx < Math.min(15, grid.length); rowIdx += 1) {
    const row = grid[rowIdx] || [];
    const normalizedCells = row.map((cell) => normalizeKey(cell));
    const map = {};

    Object.entries(aliasMap).forEach(([key, aliases]) => {
      const aliasSet = new Set(aliases.map((item) => normalizeKey(item)));
      const foundIndex = normalizedCells.findIndex((cell) => aliasSet.has(cell));
      if (foundIndex >= 0) map[key] = foundIndex;
    });

    if (typeof map.number === 'number' && typeof map.question_text === 'number') {
      return { headerRowIndex: rowIdx, indexMap: map };
    }
  }

  return { headerRowIndex: -1, indexMap: defaultColumnIndexMap };
};

const buildRowsFromWorksheetFallback = (worksheet) => {
  const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });
  if (!grid.length) return [];

  const { headerRowIndex, indexMap } = detectHeaderIndexMap(grid);
  const startDataIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

  const rows = [];
  for (let i = startDataIndex; i < grid.length; i += 1) {
    const row = grid[i] || [];
    const normalized = {};
    Object.entries(indexMap).forEach(([key, idx]) => {
      normalized[key] = row[idx] ?? null;
    });
    rows.push(normalized);
  }
  return rows;
};

router.get('/questions/package/:packageId', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(packageId)) return res.status(400).json({ error: 'Invalid package id' });

    const result = await db.query(
      'SELECT * FROM questions WHERE package_id = $1 ORDER BY number ASC, id ASC',
      [packageId]
    );

    return res.json(result.rows || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/questions/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) return res.status(400).json({ error: 'Invalid question id' });

    const result = await db.query('SELECT * FROM questions WHERE id = $1 LIMIT 1', [questionId]);
    const question = result.rows[0];
    if (!question) return res.status(404).json({ error: 'Question not found' });
    return res.json(question);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/questions/upload', requireAdmin, upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  const packageId = Number(req.body?.packageId);

  if (!Number.isInteger(packageId)) {
    return res.status(400).json({ error: 'Invalid package id' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    if (!rows.length) {
      return res.status(400).json({ error: 'No rows found in Excel' });
    }

    await db.query('BEGIN');

    let insertedCount = 0;
    for (const sourceRow of rows) {
      const row = normalizeRow(sourceRow);

      const number = toNumberOrNull(pickValue(row, ['number', 'no', 'nomor']));
      const questionTextRaw = pickValue(row, ['question_text', 'question', 'soal', 'pertanyaan']);
      const questionText = questionTextRaw ? String(questionTextRaw).trim() : '';

      if (!Number.isInteger(number) || !questionText) {
        continue;
      }

      const optionA = pickValue(row, ['option_a', 'a', 'pilihan_a']);
      const optionB = pickValue(row, ['option_b', 'b', 'pilihan_b']);
      const optionC = pickValue(row, ['option_c', 'c', 'pilihan_c']);
      const optionD = pickValue(row, ['option_d', 'd', 'pilihan_d']);
      const optionE = pickValue(row, ['option_e', 'e', 'pilihan_e']);
      const correctAnswer = pickValue(row, ['correct_answer', 'answer', 'jawaban_benar', 'kunci_jawaban']);
      const explanation = pickValue(row, ['explanation', 'pembahasan', 'penjelasan']);
      const category = pickValue(row, ['category', 'kategori']);
      const imageUrl = pickValue(row, ['image_url', 'gambar', 'url_gambar', 'image']);

      await db.query(
        `INSERT INTO questions (
          package_id, number, question_text,
          option_a, option_b, option_c, option_d, option_e,
          correct_answer, explanation, category,
          point_a, point_b, point_c, point_d, point_e,
          image_url, created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, NOW(), NOW()
        )`,
        [
          packageId,
          number,
          questionText,
          optionA ? String(optionA) : null,
          optionB ? String(optionB) : null,
          optionC ? String(optionC) : null,
          optionD ? String(optionD) : null,
          optionE ? String(optionE) : null,
          correctAnswer ? String(correctAnswer).trim().toUpperCase() : null,
          explanation ? String(explanation) : null,
          category ? String(category).trim().toUpperCase() : null,
          toNumberOrNull(pickValue(row, ['point_a', 'poin_a', 'nilai_a'])),
          toNumberOrNull(pickValue(row, ['point_b', 'poin_b', 'nilai_b'])),
          toNumberOrNull(pickValue(row, ['point_c', 'poin_c', 'nilai_c'])),
          toNumberOrNull(pickValue(row, ['point_d', 'poin_d', 'nilai_d'])),
          toNumberOrNull(pickValue(row, ['point_e', 'poin_e', 'nilai_e'])),
          imageUrl ? String(imageUrl) : null,
        ]
      );

      insertedCount += 1;
    }

    if (insertedCount === 0) {
      const fallbackRows = buildRowsFromWorksheetFallback(worksheet);

      for (const row of fallbackRows) {
        const number = toNumberOrNull(pickValue(row, aliasMap.number));
        const questionTextRaw = pickValue(row, aliasMap.question_text);
        const questionText = questionTextRaw ? String(questionTextRaw).trim() : '';

        if (!Number.isInteger(number) || !questionText) {
          continue;
        }

        const optionA = pickValue(row, aliasMap.option_a);
        const optionB = pickValue(row, aliasMap.option_b);
        const optionC = pickValue(row, aliasMap.option_c);
        const optionD = pickValue(row, aliasMap.option_d);
        const optionE = pickValue(row, aliasMap.option_e);
        const correctAnswer = pickValue(row, aliasMap.correct_answer);
        const explanation = pickValue(row, aliasMap.explanation);
        const category = pickValue(row, aliasMap.category);
        const imageUrl = pickValue(row, aliasMap.image_url);

        await db.query(
          `INSERT INTO questions (
            package_id, number, question_text,
            option_a, option_b, option_c, option_d, option_e,
            correct_answer, explanation, category,
            point_a, point_b, point_c, point_d, point_e,
            image_url, created_at, updated_at
          ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7, $8,
            $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, NOW(), NOW()
          )`,
          [
            packageId,
            number,
            questionText,
            optionA ? String(optionA) : null,
            optionB ? String(optionB) : null,
            optionC ? String(optionC) : null,
            optionD ? String(optionD) : null,
            optionE ? String(optionE) : null,
            correctAnswer ? String(correctAnswer).trim().toUpperCase() : null,
            explanation ? String(explanation) : null,
            category ? String(category).trim().toUpperCase() : null,
            toNumberOrNull(pickValue(row, aliasMap.point_a)),
            toNumberOrNull(pickValue(row, aliasMap.point_b)),
            toNumberOrNull(pickValue(row, aliasMap.point_c)),
            toNumberOrNull(pickValue(row, aliasMap.point_d)),
            toNumberOrNull(pickValue(row, aliasMap.point_e)),
            imageUrl ? String(imageUrl) : null,
          ]
        );

        insertedCount += 1;
      }
    }

    if (insertedCount === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'No valid rows to import. Pastikan kolom nomor dan teks soal terisi.' });
    }

    await db.query('COMMIT');

    await db.query(
      'UPDATE packages SET question_count = (SELECT COUNT(*) FROM questions WHERE package_id = $1), updated_at = NOW() WHERE id = $1',
      [packageId]
    ).catch(() => {});

    return res.json({
      message: `${insertedCount} questions imported successfully`,
      count: insertedCount,
    });
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    return res.status(500).json({ error: error.message });
  }
});

router.post('/questions/:id/image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) return res.status(400).json({ error: 'Invalid question id' });

    let finalImageUrl = req.body?.imageUrl || null;

    if (req.file) {
      const mimeType = req.file.mimetype || 'image/jpeg';
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
      if (!allowed.includes(mimeType)) {
        return res.status(400).json({ error: 'Invalid image type' });
      }
      finalImageUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;
    }

    if (!finalImageUrl) {
      return res.status(400).json({ error: 'Image URL or file is required' });
    }

    const result = await db.query(
      'UPDATE questions SET image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [finalImageUrl, questionId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Question not found' });

    return res.json({
      message: 'Image updated successfully',
      image_url: finalImageUrl,
      question: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
