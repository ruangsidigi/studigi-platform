const express = require('express');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const loadUserProfileColumns = async (db) => {
  const result = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'users'
       AND column_name IN ('location', 'bio')`
  );

  const columns = new Set((result.rows || []).map((row) => String(row.column_name || '')));
  return {
    hasLocation: columns.has('location'),
    hasBio: columns.has('bio'),
  };
};

router.get('/users/profile', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const profileColumns = await loadUserProfileColumns(db);

    const selectFields = [
      'id',
      'email',
      'name',
      profileColumns.hasLocation ? 'location' : "''::text AS location",
      profileColumns.hasBio ? 'bio' : "''::text AS bio",
    ];

    const result = await db.query(
      `SELECT ${selectFields.join(', ')}
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      id: user.id,
      email: user.email || '',
      name: user.name || '',
      location: user.location || '',
      bio: user.bio || '',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/users/profile', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const profileColumns = await loadUserProfileColumns(db);
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const location = String(req.body?.location || '').trim();
    const bio = String(req.body?.bio || '').trim();

    if (name.length < 2) {
      return res.status(400).json({ error: 'Nama minimal 2 karakter' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email wajib diisi' });
    }

    const setParts = ['name = $1', 'email = $2'];
    const values = [name, email];
    let paramIndex = values.length;

    if (profileColumns.hasLocation) {
      paramIndex += 1;
      setParts.push(`location = $${paramIndex}`);
      values.push(location);
    }

    if (profileColumns.hasBio) {
      paramIndex += 1;
      setParts.push(`bio = $${paramIndex}`);
      values.push(bio);
    }

    paramIndex += 1;
    setParts.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const result = await db.query(
      `UPDATE users
       SET ${setParts.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, name${profileColumns.hasLocation ? ', location' : ", ''::text AS location"}${profileColumns.hasBio ? ', bio' : ", ''::text AS bio"}`,
      values
    );

    const updated = result.rows[0];
    if (!updated) return res.status(404).json({ error: 'User not found' });

    return res.json({
      message: 'Profile updated',
      profile: {
        id: updated.id,
        email: updated.email || '',
        name: updated.name || '',
        location: updated.location || '',
        bio: updated.bio || '',
      },
    });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('duplicate key') || message.includes('users_email_key')) {
      return res.status(409).json({ error: 'Email sudah digunakan akun lain' });
    }
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
