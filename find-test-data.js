/**
 * Find Test Data
 * This script finds valid test data for review system
 */

const path = require('path');
const fs = require('fs');

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
    console.error('❌ Cannot load Supabase client. Make sure backend/node_modules exists');
    process.exit(1);
  }
})();

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_KEY missing in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findTestData() {
  console.log('\n🔍 Finding Valid Test Data for Review System\n');

  try {
    // Find sessions with answers
    console.log('Searching for sessions with answers...\n');

    const { data: sessions, error: sessionsError } = await supabase
      .from('tryout_sessions')
      .select('id, user_id, package_id, total_score, is_passed')
      .limit(100);

    if (sessionsError) {
      console.error('❌ Error:', sessionsError.message);
      return;
    }

    let validSession = null;

    // Find a session with answers
    for (const session of sessions) {
      const { data: answers } = await supabase
        .from('tryout_answers')
        .select('id')
        .eq('session_id', session.id)
        .limit(1);

      if (answers && answers.length > 0) {
        validSession = session;
        break;
      }
    }

    if (!validSession) {
      console.log('⚠️  No sessions with answers found!');
      console.log('\nℹ️  Total sessions in database:', sessions.length);
      
      // Show first few sessions
      if (sessions.length > 0) {
        console.log('\nFirst few sessions:');
        sessions.slice(0, 5).forEach((s) => {
          console.log(`  - ID: ${s.id}, User: ${s.user_id}, Package: ${s.package_id}`);
        });
      }
      return;
    }

    console.log('✅ Found valid session!\n');
    console.log('Session Details:');
    console.log(`  ID: ${validSession.id}`);
    console.log(`  User ID: ${validSession.user_id}`);
    console.log(`  Package ID: ${validSession.package_id}`);
    console.log(`  Total Score: ${validSession.total_score}`);
    console.log(`  Is Passed: ${validSession.is_passed}`);

    // Get answer count
    const { data: answers, error: answersError } = await supabase
      .from('tryout_answers')
      .select('id')
      .eq('session_id', validSession.id);

    const answerCount = answers ? answers.length : 0;
    console.log(`  Answer Count: ${answerCount}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n🎯 You can test the review endpoint with this URL:');
    console.log(`\n   http://localhost:3000/review/${validSession.id}`);
    console.log('\n📝 Or use this attemptId in API calls:');
    console.log(`   ${validSession.id}`);

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findTestData();
