const axios = require('axios');

const testLoginAPI = async () => {
  console.log('🧪 Testing login API endpoint...\n');
  
  try {
    console.log('POST http://localhost:5000/api/auth/login');
    console.log('Body: { email: "admin@skdcpns.com", password: "admin123" }\n');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@skdcpns.com',
      password: 'admin123'
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Login SUCCESSFUL!\n');
    console.log('Response:');
    console.log('  Message:', response.data.message);
    console.log('  User:');
    console.log('    - ID:', response.data.user.id);
    console.log('    - Email:', response.data.user.email);
    console.log('    - Name:', response.data.user.name);
    console.log('    - Role:', response.data.user.role);
    console.log('  Token:', response.data.token.substring(0, 30) + '...');
    console.log('\n🎉 Login API working correctly!');
    
  } catch (error) {
    console.log('❌ Login FAILED!\n');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Message:', error.response.data?.error);
      console.log('\nResponse:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Cannot connect to backend at http://localhost:5000');
      console.log('   Make sure backend server is running!');
    } else {
      console.log('Error:', error.message);
    }
  }
  
  process.exit(0);
};

testLoginAPI();
