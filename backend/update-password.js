require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const updateAdminPassword = async () => {
  console.log('🔄 Updating admin password...');
  
  try {
    const correctHash = '$2a$10$90NDlDqc0g5bC/aqwWZXq.KowOdoSgkm/dc.ymLSeA1k73bwX1cKi';
    
    const { data, error } = await supabase
      .from('users')
      .update({ password: correctHash })
      .eq('email', 'admin@skdcpns.com')
      .select();

    if (error) {
      console.error('❌ Error updating password:', error.message);
      process.exit(1);
    }

    if (data && data.length > 0) {
      console.log('✅ Admin password updated successfully!');
      console.log('\n📝 Login credentials:');
      console.log('   Email: admin@skdcpns.com');
      console.log('   Password: admin123');
    } else {
      console.log('❌ Admin user not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

updateAdminPassword();
