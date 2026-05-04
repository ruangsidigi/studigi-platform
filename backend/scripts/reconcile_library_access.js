require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { reconcileLibraryAccess } = require('../shared/libraryReconciliation');

(async () => {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  const limitArg = Number(process.argv[2] || 300);
  const txLimit = Number.isInteger(limitArg) && limitArg > 0 ? limitArg : 300;
  try {
    const summary = await reconcileLibraryAccess({ db, txLimit });

    console.log(
      JSON.stringify(
        {
          ok: true,
          ...summary,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('reconcile_library_access failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
