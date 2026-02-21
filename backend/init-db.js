require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const initializeDatabase = async () => {
  console.log('🔄 Initializing database...');
  
  try {
    // Hash password for admin123
    const hashedPassword = '$2a$10$90NDlDqc0g5bC/aqwWZXq.KowOdoSgkm/dc.ymLSeA1k73bwX1cKi';
    
    // 1. Check and insert admin user if not exists
    console.log('👤 Setting up admin user...');
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'admin@skdcpns.com')
      .single();

    if (!existingAdmin) {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          email: 'admin@skdcpns.com',
          password: hashedPassword,
          name: 'Admin CPNS',
          role: 'admin'
        }])
        .select();

      if (userError) {
        console.error('❌ Error creating admin user:', userError.message);
        throw userError;
      }
      console.log('✓ Admin user created');
    } else {
      console.log('✓ Admin user already exists');
    }

    // 2. Insert sample packages
    console.log('📦 Setting up sample packages...');
    const packages = [
      {
        name: 'Paket Tryout Full 1',
        description: 'Paket tryout lengkap dengan 100 soal',
        type: 'tryout',
        price: 50000,
        question_count: 100
      },
      {
        name: 'Paket Tryout Full 2',
        description: 'Paket tryout lengkap dengan 100 soal edisi revisi',
        type: 'tryout',
        price: 50000,
        question_count: 100
      },
      {
        name: 'Latihan TWK',
        description: 'Paket latihan soal TWK 50 soal',
        type: 'latihan',
        price: 20000,
        question_count: 50
      },
      {
        name: 'Latihan TIU',
        description: 'Paket latihan soal TIU 50 soal',
        type: 'latihan',
        price: 20000,
        question_count: 50
      },
      {
        name: 'Latihan TKP',
        description: 'Paket latihan soal TKP 50 soal',
        type: 'latihan',
        price: 20000,
        question_count: 50
      }
    ];

    for (const pkg of packages) {
      const { data: existing } = await supabase
        .from('packages')
        .select('id')
        .eq('name', pkg.name)
        .single();

      if (!existing) {
        const { error: pkgError } = await supabase
          .from('packages')
          .insert([pkg]);
        
        if (pkgError) {
          console.error(`❌ Error creating package ${pkg.name}:`, pkgError.message);
        }
      }
    }
    console.log('✓ Sample packages added');

    console.log('\n✅ Database initialization complete!');
    console.log('\n📝 Login credentials:');
    console.log('   Email: admin@skdcpns.com');
    console.log('   Password: admin123');
    console.log('\n🚀 Aplikasi siap digunakan!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  }
};

initializeDatabase();
