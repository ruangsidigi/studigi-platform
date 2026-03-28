require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(120)');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT');
    console.log('user profile columns ensured');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
