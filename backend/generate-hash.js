require('dotenv').config();
const bcrypt = require('bcryptjs');

// Generate proper hash for admin123
const generateHash = async () => {
  try {
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);
    console.log('Password: admin123');
    console.log('Hash:', hash);
    console.log('\nUse this SQL to insert admin user:\n');
    console.log(`INSERT INTO users (email, password, name, role) VALUES ('admin@skdcpns.com', '${hash}', 'Admin CPNS', 'admin');`);
  } catch (error) {
    console.error('Error:', error);
  }
};

generateHash();
