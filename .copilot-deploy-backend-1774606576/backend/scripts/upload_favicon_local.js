const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const http = require('http');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_KEY missing in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    // 1x1 transparent PNG
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const buffer = Buffer.from(b64, 'base64');
    const filename = 'favicon/favicon.ico';

    const { data, error } = await supabase.storage.from('materials').upload(filename, buffer, { contentType: 'image/x-icon', upsert: true });
    if (error) {
      console.error('Upload error', error.message);
      process.exit(2);
    }
    console.log('Uploaded to storage path:', filename);

    const { data: publicUrlData } = supabase.storage.from('materials').getPublicUrl(filename);
    console.log('Public URL:', publicUrlData.publicUrl);

    // Check local server favicon route
    const url = 'http://127.0.0.1:5000/favicon.ico';
    http.get(url, (res) => {
      console.log('Local /favicon.ico status', res.statusCode);
      console.log('Headers:', res.headers);
      res.on('data', () => {});
      res.on('end', () => process.exit(0));
    }).on('error', (e) => {
      console.error('Request error', e.message);
      process.exit(3);
    });
  } catch (err) {
    console.error('Script error', err.message || err);
    process.exit(4);
  }
}

run();
