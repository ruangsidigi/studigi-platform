const axios = require('axios');
const API = 'http://localhost:5000/api';

(async () => {
  try {
    const login = await axios.post(`${API}/auth/login`, { email: 'admin@skdcpns.com', password: 'admin123' });
    const token = login.data.token;
    console.log('Admin token OK, length', token.length);

    const res = await axios.get(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Stats response:');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    if (e.response) {
      console.error('Error status:', e.response.status);
      console.error('Error data:', JSON.stringify(e.response.data, null, 2));
    } else {
      console.error('Error message:', e.message);
      console.error(e.stack);
    }
  }
})();
