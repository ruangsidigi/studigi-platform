require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

(async () => {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await db.query('BEGIN');

    const result = await db.query(
      `WITH latest_answers AS (
         SELECT DISTINCT ON (a.session_id, a.question_id)
           a.session_id,
           a.question_id,
           UPPER(COALESCE(a.user_answer, '')) AS user_answer
         FROM tryout_answers a
         ORDER BY a.session_id, a.question_id, a.submitted_at DESC NULLS LAST, a.id DESC
       ),
       scored AS (
         SELECT
           la.session_id,
           SUM(
             CASE
               WHEN UPPER(COALESCE(q.category, '')) = 'TWK' THEN
                 CASE
                   WHEN q.point_a IS NOT NULL OR q.point_b IS NOT NULL OR q.point_c IS NOT NULL OR q.point_d IS NOT NULL OR q.point_e IS NOT NULL THEN
                     CASE la.user_answer
                       WHEN 'A' THEN COALESCE(q.point_a, 0)
                       WHEN 'B' THEN COALESCE(q.point_b, 0)
                       WHEN 'C' THEN COALESCE(q.point_c, 0)
                       WHEN 'D' THEN COALESCE(q.point_d, 0)
                       WHEN 'E' THEN COALESCE(q.point_e, 0)
                       ELSE 0
                     END
                   WHEN la.user_answer <> '' AND la.user_answer = UPPER(COALESCE(q.correct_answer, '')) THEN 5
                   ELSE 0
                 END
               ELSE 0
             END
           )::int AS twk_score,
           SUM(
             CASE
               WHEN UPPER(COALESCE(q.category, '')) = 'TIU' THEN
                 CASE
                   WHEN q.point_a IS NOT NULL OR q.point_b IS NOT NULL OR q.point_c IS NOT NULL OR q.point_d IS NOT NULL OR q.point_e IS NOT NULL THEN
                     CASE la.user_answer
                       WHEN 'A' THEN COALESCE(q.point_a, 0)
                       WHEN 'B' THEN COALESCE(q.point_b, 0)
                       WHEN 'C' THEN COALESCE(q.point_c, 0)
                       WHEN 'D' THEN COALESCE(q.point_d, 0)
                       WHEN 'E' THEN COALESCE(q.point_e, 0)
                       ELSE 0
                     END
                   WHEN la.user_answer <> '' AND la.user_answer = UPPER(COALESCE(q.correct_answer, '')) THEN 5
                   ELSE 0
                 END
               ELSE 0
             END
           )::int AS tiu_score,
           SUM(
             CASE
               WHEN UPPER(COALESCE(q.category, '')) = 'TKP' THEN
                 CASE la.user_answer
                   WHEN 'A' THEN COALESCE(q.point_a, 0)
                   WHEN 'B' THEN COALESCE(q.point_b, 0)
                   WHEN 'C' THEN COALESCE(q.point_c, 0)
                   WHEN 'D' THEN COALESCE(q.point_d, 0)
                   WHEN 'E' THEN COALESCE(q.point_e, 0)
                   ELSE 0
                 END
               ELSE 0
             END
           )::int AS tkp_score,
           SUM(
             CASE
               WHEN UPPER(COALESCE(q.category, '')) <> 'TWK'
                    AND UPPER(COALESCE(q.category, '')) <> 'TIU'
                    AND UPPER(COALESCE(q.category, '')) <> 'TKP' THEN
                 CASE
                   WHEN q.point_a IS NOT NULL OR q.point_b IS NOT NULL OR q.point_c IS NOT NULL OR q.point_d IS NOT NULL OR q.point_e IS NOT NULL THEN
                     CASE la.user_answer
                       WHEN 'A' THEN COALESCE(q.point_a, 0)
                       WHEN 'B' THEN COALESCE(q.point_b, 0)
                       WHEN 'C' THEN COALESCE(q.point_c, 0)
                       WHEN 'D' THEN COALESCE(q.point_d, 0)
                       WHEN 'E' THEN COALESCE(q.point_e, 0)
                       ELSE 0
                     END
                   WHEN la.user_answer <> '' AND la.user_answer = UPPER(COALESCE(q.correct_answer, '')) THEN 5
                   ELSE 0
                 END
               ELSE 0
             END
           )::int AS other_score
         FROM latest_answers la
         JOIN questions q ON q.id = la.question_id
         GROUP BY la.session_id
       ),
       recomputed AS (
         SELECT
           ts.id AS session_id,
           ts.user_id,
           ts.package_id,
           COALESCE(s.twk_score, 0)::int AS twk_score,
           COALESCE(s.tiu_score, 0)::int AS tiu_score,
           COALESCE(s.tkp_score, 0)::int AS tkp_score,
           COALESCE(s.other_score, 0)::int AS other_score,
           (COALESCE(s.twk_score, 0) + COALESCE(s.tiu_score, 0) + COALESCE(s.tkp_score, 0) + COALESCE(s.other_score, 0))::int AS total_score,
           CASE
             WHEN p.pass_score IS NOT NULL THEN
               (COALESCE(s.twk_score, 0) + COALESCE(s.tiu_score, 0) + COALESCE(s.tkp_score, 0) + COALESCE(s.other_score, 0)) >= p.pass_score
             ELSE
               COALESCE(s.twk_score, 0) > 65 AND COALESCE(s.tiu_score, 0) > 85 AND COALESCE(s.tkp_score, 0) > 166
           END AS is_passed,
           COALESCE(ts.twk_score, 0)::int AS old_twk_score,
           COALESCE(ts.tiu_score, 0)::int AS old_tiu_score,
           COALESCE(ts.tkp_score, 0)::int AS old_tkp_score,
           COALESCE(ts.total_score, 0)::int AS old_total_score,
           COALESCE(ts.is_passed, false) AS old_is_passed
         FROM tryout_sessions ts
         LEFT JOIN scored s ON s.session_id = ts.id
         LEFT JOIN packages p ON p.id = ts.package_id
         WHERE ts.status = 'completed'
       ),
       updated AS (
         UPDATE tryout_sessions ts
         SET
           twk_score = r.twk_score,
           tiu_score = r.tiu_score,
           tkp_score = r.tkp_score,
           total_score = r.total_score,
           is_passed = r.is_passed
         FROM recomputed r
         WHERE ts.id = r.session_id
           AND (
             COALESCE(ts.twk_score, 0)::int <> r.twk_score OR
             COALESCE(ts.tiu_score, 0)::int <> r.tiu_score OR
             COALESCE(ts.tkp_score, 0)::int <> r.tkp_score OR
             COALESCE(ts.total_score, 0)::int <> r.total_score OR
             COALESCE(ts.is_passed, false) <> r.is_passed
           )
         RETURNING
           ts.id,
           ts.user_id,
           ts.package_id,
           r.old_total_score,
           ts.total_score AS new_total_score
       )
       SELECT * FROM updated
       ORDER BY id DESC`
    );

    await db.query('COMMIT');

    console.log('Updated sessions:', result.rowCount || 0);
    if ((result.rows || []).length > 0) {
      console.table(result.rows.slice(0, 20));
      if (result.rows.length > 20) {
        console.log('...and', result.rows.length - 20, 'more rows');
      }
    }
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
