require('dotenv').config({ path: '.env' });

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { Client } = require('pg');

const SOURCE_FILES = [
  'C:/Users/ACER/Downloads/TO 2 SKD CPNS.xlsx',
  'C:/Users/ACER/Downloads/SKD CPNS TO 3.xlsx',
  'C:/Users/ACER/Downloads/SKD CPNS TO 4.xlsx',
  'C:/Users/ACER/Downloads/SKD CPNS TO 5.xlsx',
  'C:/Users/ACER/Downloads/TRYOUT 5 STUDIGI.xlsx',
  'C:/Users/ACER/Downloads/soal.xlsx',
];

function toIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeLetter(value) {
  const s = toText(value).toUpperCase();
  if (!s) return null;
  const first = s[0];
  return ['A', 'B', 'C', 'D', 'E'].includes(first) ? first : null;
}

function cleanRow(row) {
  return {
    number: row.number ?? row.no ?? row.nomor,
    question_text: row.question_text ?? row.pertanyaan,
    option_a: row.option_a ?? row['opsi A'] ?? row.opsi_a,
    option_b: row.option_b ?? row['opsi B'] ?? row.opsi_b,
    option_c: row.option_c ?? row['opsi C'] ?? row.opsi_c,
    option_d: row.option_d ?? row['opsi D'] ?? row.opsi_d,
    option_e: row.option_e ?? row['opsi E'] ?? row.opsi_e,
    correct_answer: row.correct_answer ?? row.jawaban,
    explanation: row.explanation ?? row.pembahasan,
    category: row.category ?? row.kategori,
    point_a: row.point_a ?? row.poin_a,
    point_b: row.point_b ?? row.poin_b,
    point_c: row.point_c ?? row.poin_c,
    point_d: row.point_d ?? row.poin_d,
    point_e: row.point_e ?? row.poin_e,
    poin_benar: row.poin_benar,
    image_url: row.image_url,
  };
}

function mapQuestionRow(row, packageId, fallbackNumber) {
  const cleaned = cleanRow(row);

  const questionText = toText(cleaned.question_text);
  if (!questionText) return null;

  const correctAnswer = normalizeLetter(cleaned.correct_answer);

  let pointA = toIntOrNull(cleaned.point_a);
  let pointB = toIntOrNull(cleaned.point_b);
  let pointC = toIntOrNull(cleaned.point_c);
  let pointD = toIntOrNull(cleaned.point_d);
  let pointE = toIntOrNull(cleaned.point_e);

  const allPointsMissing = [pointA, pointB, pointC, pointD, pointE].every((x) => x === null);
  const poinBenar = toIntOrNull(cleaned.poin_benar);

  if (allPointsMissing && poinBenar !== null && correctAnswer) {
    if (correctAnswer === 'A') pointA = poinBenar;
    if (correctAnswer === 'B') pointB = poinBenar;
    if (correctAnswer === 'C') pointC = poinBenar;
    if (correctAnswer === 'D') pointD = poinBenar;
    if (correctAnswer === 'E') pointE = poinBenar;
  }

  return {
    package_id: packageId,
    number: toIntOrNull(cleaned.number) ?? fallbackNumber,
    question_text: questionText,
    option_a: toText(cleaned.option_a) || null,
    option_b: toText(cleaned.option_b) || null,
    option_c: toText(cleaned.option_c) || null,
    option_d: toText(cleaned.option_d) || null,
    option_e: toText(cleaned.option_e) || null,
    correct_answer: correctAnswer,
    explanation: toText(cleaned.explanation) || null,
    category: toText(cleaned.category).toUpperCase() || null,
    point_a: pointA,
    point_b: pointB,
    point_c: pointC,
    point_d: pointD,
    point_e: pointE,
    image_url: toText(cleaned.image_url) || null,
    created_at: new Date(),
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function run() {
  const client = new Client({
    connectionString: process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const cpnsCategory = await client.query(
    "select id from categories where upper(name) = 'CPNS' order by id asc limit 1"
  );
  const cpnsCategoryId = cpnsCategory.rows[0] ? cpnsCategory.rows[0].id : null;

  console.log('CPNS category id:', cpnsCategoryId);

  for (const sourceFile of SOURCE_FILES) {
    if (!fs.existsSync(sourceFile)) {
      console.log('[SKIP] file not found:', sourceFile);
      continue;
    }

    const packageName = path.basename(sourceFile, path.extname(sourceFile));

    const existing = await client.query('select id from packages where name = $1 limit 1', [packageName]);
    if (existing.rows[0]) {
      console.log('[SKIP] package already exists:', packageName, 'id=', existing.rows[0].id);
      continue;
    }

    const workbook = XLSX.readFile(sourceFile);
    const firstSheet = workbook.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: null });

    const packageInsert = await client.query(
      `
      insert into packages
      (name, description, type, price, question_count, category_id, content_type, visibility, duration, pass_score, created_at)
      values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      returning id
      `,
      [
        packageName,
        'Restored from local Excel backup on 2026-04-18',
        'tryout',
        0,
        0,
        cpnsCategoryId,
        'question',
        'visible',
        100,
        null,
      ]
    );

    const packageId = packageInsert.rows[0].id;

    const mapped = [];
    for (let i = 0; i < rawRows.length; i += 1) {
      const q = mapQuestionRow(rawRows[i], packageId, i + 1);
      if (q) mapped.push(q);
    }

    const batches = chunk(mapped, 100);
    for (const batch of batches) {
      const values = [];
      const params = [];
      let p = 1;

      for (const q of batch) {
        values.push(
          `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`
        );
        params.push(
          q.package_id,
          q.number,
          q.question_text,
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
          q.option_e,
          q.correct_answer,
          q.explanation,
          q.category,
          q.point_a,
          q.point_b,
          q.point_c,
          q.point_d,
          q.point_e,
          q.image_url
        );
      }

      await client.query(
        `
        insert into questions
        (package_id, number, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation, category, point_a, point_b, point_c, point_d, point_e, image_url)
        values ${values.join(',')}
        `,
        params
      );
    }

    await client.query('update packages set question_count = $1 where id = $2', [mapped.length, packageId]);

    console.log('[OK] restored package:', packageName, '| id=', packageId, '| questions=', mapped.length);
  }

  const summary = await client.query(
    `
    select p.id, p.name, p.question_count, count(q.id)::int as actual_questions
    from packages p
    left join questions q on q.package_id = p.id
    group by p.id, p.name, p.question_count
    order by p.id asc
    `
  );

  console.log('\n=== SUMMARY ===');
  for (const row of summary.rows) {
    console.log(`${row.id} | ${row.name} | package.question_count=${row.question_count} | actual=${row.actual_questions}`);
  }

  await client.end();
}

run().catch((err) => {
  console.error('RESTORE ERROR:', err.message);
  process.exit(1);
});
