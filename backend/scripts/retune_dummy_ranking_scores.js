require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const targetRows = [
  { name: 'Budi Santoso', packageId: 16, twk: 76, tiu: 102, tkp: 182 },
  { name: 'Fajar Ramadhan', packageId: 16, twk: 78, tiu: 101, tkp: 181 },
  { name: 'Rina Wulandari', packageId: 16, twk: 74, tiu: 96, tkp: 178 },
  { name: 'Siti Aisyah', packageId: 16, twk: 70, tiu: 95, tkp: 171 },
  { name: 'Rizky Maulana', packageId: 16, twk: 66, tiu: 90, tkp: 166 },
  { name: 'Intan Permata', packageId: 30, twk: 72, tiu: 97, tkp: 171 },
  { name: 'Dedi Kurniawan', packageId: 30, twk: 71, tiu: 98, tkp: 171 },
  { name: 'Andi Pratama', packageId: 30, twk: 64, tiu: 92, tkp: 164 },
  { name: 'Dewi Lestari', packageId: 30, twk: 69, tiu: 82, tkp: 164 },
  { name: 'Nabila Putri', packageId: 30, twk: 61, tiu: 88, tkp: 170 },
];

(async () => {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await db.query('BEGIN');

    for (const row of targetRows) {
      const total = row.twk + row.tiu + row.tkp;
      const isPassed = row.twk > 65 && row.tiu > 85 && row.tkp > 166;

      await db.query(
        `UPDATE tryout_sessions
         SET twk_score = $1,
             tiu_score = $2,
             tkp_score = $3,
             total_score = $4,
             is_passed = $5
         WHERE participant_name = $6
           AND package_id = $7
           AND status = 'completed'`,
        [row.twk, row.tiu, row.tkp, total, isPassed, row.name, row.packageId]
      );
    }

    await db.query('COMMIT');
    console.log('Retune completed for rows:', targetRows.length);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Retune failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
