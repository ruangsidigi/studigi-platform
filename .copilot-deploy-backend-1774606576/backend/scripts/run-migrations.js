const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Support automatic execution if a Postgres connection string is provided.
const PG_CONN = process.env.PG_CONNECTION_STRING || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;

async function runSqlUsingPg(sql, client) {
  try {
    await client.query(sql);
    console.log('Executed successfully');
  } catch (err) {
    console.error('Error executing SQL:', err.message);
    throw err;
  }
}

async function run() {
  const migrationsDir = path.resolve(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  console.log('Found migrations:', files);

  if (!PG_CONN) {
    console.log('\nNo Postgres connection string found in backend/.env. Will print SQL for manual execution.');
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      console.log('\n--- ' + f + ' ---\n');
      console.log(sql);
    }
    console.log('\nAdd PG_CONNECTION_STRING to backend/.env to run these automatically.');
    return;
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: PG_CONN });

  try {
    await client.connect();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      console.log('\n--- Executing:', f, '---\n');
      await runSqlUsingPg(sql, client);
    }
    console.log('\nMigrations complete');
  } finally {
    await client.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
