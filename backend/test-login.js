require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const testLogin = async () => {
  console.log('🧪 Testing login flow...\n');
  
  try {
    // Test 1: Check if user exists
    console.log('1️⃣  Checking admin user...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@skdcpns.com')
      .single();

    if (userError) {
      console.error('❌ Error fetching user:', userError.message);
      process.exit(1);
    }

    if (!user) {
      console.log('❌ Admin user not found in database!');
      process.exit(1);
    }

    console.log('✓ Admin user found');
    console.log('  - Email:', user.email);
    console.log('  - Name:', user.name);
    console.log('  - Role:', user.role);
    console.log('  - Password hash:', user.password.substring(0, 20) + '...');

    // Test 2: Verify password hash
    console.log('\n2️⃣  Testing password verification...');
    const testPassword = 'admin123';
    const isPasswordValid = await bcrypt.compare(testPassword, user.password);
    
    if (isPasswordValid) {
      console.log('✓ Password verification SUCCESSFUL!');
      console.log('  The password "admin123" matches the hash');
    } else {
      console.log('❌ Password verification FAILED!');
      console.log('  The password "admin123" does not match the hash');
      console.log('\n  Current hash:', user.password);
      
      // Generate new hash
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('  New hash:', newHash);
      console.log('\n  Updating user with new hash...');
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newHash })
        .eq('email', 'admin@skdcpns.com');
      
      if (updateError) {
        console.error('❌ Error updating:', updateError.message);
      } else {
        console.log('✓ Password updated successfully!');
      }
    }

    // Test 3: Check packages
    console.log('\n3️⃣  Checking sample packages...');
    const { data: packages, error: pkgError } = await supabase
      .from('packages')
      .select('*');

    if (pkgError) {
      console.error('❌ Error fetching packages:', pkgError.message);
    } else {
      console.log(`✓ Found ${packages?.length || 0} packages`);
      packages?.forEach((pkg, i) => {
        console.log(`  ${i + 1}. ${pkg.name} (${pkg.type}) - Rp${pkg.price}`);
      });
    }

    console.log('\n✅ Database check complete!');
    console.log('\n🚀 Ready to login at http://localhost:3000');
    console.log('   Email: admin@skdcpns.com');
    console.log('   Password: admin123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
};

testLogin();
