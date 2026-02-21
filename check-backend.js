/**
 * Simple HTTP Test
 * Check if backend is running
 */

const http = require('http');

function testConnection() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/reviews/attempt/4',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data.substring(0, 300),
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        error: error.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        error: 'Timeout - backend not responding',
      });
    });

    req.end();
  });
}

async function test() {
  console.log('\n🔌 Checking if backend is running at localhost:5000...\n');

  const result = await testConnection();

  if (result.error) {
    console.log('❌ Backend is NOT running');
    console.log('   Error:', result.error);
    console.log('\n💡 Please start the backend with:');
    console.log('   cd backend');
    console.log('   node src/server.js');
  } else {
    console.log('✅ Backend is running!');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response: ${result.data}`);
  }
}

test();
