const axios = require('axios');
const API = 'http://localhost:5000/api';

(async () => {
  const email = `debuguser+${Date.now()}@example.com`;
  const password = 'debugpass';
  try {
    console.log('Registering', email);
    const r = await axios.post(`${API}/auth/register`, { email, password, name: 'Debug' });
    console.log('Register response:', r.data.message);
  } catch (e) {
    console.error('Register error:', e.response?.status, e.response?.data || e.message);
  }

  try {
    console.log('Logging in', email);
    const l = await axios.post(`${API}/auth/login`, { email, password });
    console.log('Login success, token length:', (l.data.token || '').length);
    console.log('User:', l.data.user.email);
  } catch (e) {
    console.error('Login error:', e.response?.status, e.response?.data || e.message);
  }
})();
