/**
 * Test Review API
 * Test the /api/reviews/attempt/:attemptId endpoint
 */

const path = require('path');
const fs = require('fs');
const http = require('http');

// Load env from backend/.env
const envPath = path.resolve(__dirname, 'backend', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const { createClient } = (() => {
  try {
    return require('./backend/node_modules/@supabase/supabase-js');
  } catch (e) {
    console.error('❌ Cannot load Supabase client');
    process.exit(1);
  }
})();

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
const JWT_SECRET = env.JWT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function makeRequest(method, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testReviewAPI() {
  console.log('\n🧪 Testing Review API\n');

  try {
    // Step 1: Create a test JWT token
    console.log('Step 1: Creating test JWT token...');
    const jwt = require('jsonwebtoken');
    
    const token = jwt.sign(
      { id: 1, email: 'test@example.com' },
      JWT_SECRET || 'dev-secret-key',
      { expiresIn: '1h' }
    );
    console.log('✅ Token created\n');

    // Step 2: Check if backend is running
    console.log('Step 2: Checking if backend is running...');
    const healthCheck = await makeRequest('GET', '/api/reviews/attempt/4/question/1', token)
      .catch((e) => {
        console.error('❌ Cannot connect to backend at localhost:5000');
        console.error('   Error:', e.message);
        process.exit(1);
      });

    console.log('✅ Backend is responding\n');

    // Step 3: Test the review endpoint
    console.log('Step 3: Testing GET /api/reviews/attempt/4...');
    const reviewResponse = await makeRequest('GET', '/api/reviews/attempt/4', token);
    
    console.log(`Status: ${reviewResponse.status}`);
    console.log('Response:');
    
    try {
      const jsonData = JSON.parse(reviewResponse.data);
      console.log(JSON.stringify(jsonData, null, 2).substring(0, 500) + '...');
      
      if (reviewResponse.status === 200) {
        console.log('\n✅ Review endpoint working!');
        console.log(`   - Got ${jsonData.review?.length || 0} questions`);
        console.log(`   - Stats: ${jsonData.stats?.total} total, ${jsonData.stats?.correct} correct`);
      } else if (reviewResponse.status === 400) {
        console.log('\n❌ API Error:');
        console.log('   Error:', jsonData.error);
      } else {
        console.log('\n❌ Unexpected status code');
      }
    } catch (e) {
      console.log('Response (raw):', reviewResponse.data);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testReviewAPI();
