const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const FormData = require('form-data');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('JWT_SECRET missing'); process.exit(1); }

// create admin token valid for 1 hour
const token = jwt.sign({ id: 1, email: 'admin@example.com', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

// tiny 1x1 PNG base64
const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const buffer = Buffer.from(b64, 'base64');

async function run() {
  const form = new FormData();
  form.append('file', buffer, { filename: 'test-favicon.png', contentType: 'image/png' });

  try {
    const headers = Object.assign({ Authorization: 'Bearer ' + token }, form.getHeaders());
    const res = await fetch((process.env.API_URL || 'http://127.0.0.1:5000') + '/api/admin/upload-favicon', {
      method: 'POST', headers, body: form
    });
    const json = await res.json().catch(()=>null);
    console.log('STATUS', res.status);
    console.log('BODY', json);
  } catch (e) {
    console.error('ERROR', e.message || e);
  }
}

run();
