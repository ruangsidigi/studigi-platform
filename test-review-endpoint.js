/**
 * Test Review Endpoint
 * This script tests the /reviews/attempt/:attemptId endpoint
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

async function testReviewEndpoint() {
  console.log('\n📋 Review Endpoint Testing Script\n');

  try {
    // Step 1: Check if tryout_sessions table exists and has data
    console.log('Step 1: Checking tryout_sessions table...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('tryout_sessions')
      .select('id, user_id, package_id, total_score');

    if (sessionsError) {
      console.error('❌ Error querying tryout_sessions:', sessionsError.message);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('⚠️  No tryout sessions found in database');
      return;
    }

    console.log(`✅ Found ${sessions.length} tryout sessions`);
    console.log('Sample sessions:', sessions.slice(0, 3));

    // Step 2: Get first session
    const testSession = sessions[0];
    console.log(`\nStep 2: Using session ID: ${testSession.id} (User: ${testSession.user_id})`);

    // Step 3: Check if tryout_answers exists for this session
    console.log('\nStep 3: Checking tryout_answers for this session...');
    const { data: answers, error: answersError } = await supabase
      .from('tryout_answers')
      .select('id, session_id, question_id, user_answer, is_correct')
      .eq('session_id', testSession.id);

    if (answersError) {
      console.error('❌ Error querying tryout_answers:', answersError.message);
      return;
    }

    if (!answers || answers.length === 0) {
      console.log('⚠️  No answers found for this session');
      return;
    }

    console.log(`✅ Found ${answers.length} answers`);

    // Step 4: Check if questions table exists
    console.log('\nStep 4: Checking questions table...');
    const questionIds = answers.map((a) => a.question_id).filter(Boolean);
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, number, category, correct_answer')
      .in('id', questionIds)
      .limit(3);

    if (questionsError) {
      console.error('❌ Error querying questions:', questionsError.message);
      return;
    }

    console.log(`✅ Found ${questions?.length || 0} questions`);

    // Step 5: Check question_bookmarks table
    console.log('\nStep 5: Checking question_bookmarks table...');
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from('question_bookmarks')
      .select('id, question_id, session_id, user_id')
      .eq('session_id', testSession.id)
      .limit(1);

    if (bookmarksError) {
      console.warn('⚠️  question_bookmarks table might not exist or error:', bookmarksError.message);
    } else if (bookmarks && bookmarks.length > 0) {
      console.log('✅ Found bookmarks:', bookmarks.slice(0, 2));
    } else {
      console.log('✅ question_bookmarks table exists (no bookmarks for this session)');
    }

    // Step 6: Test the full review service logic
    console.log('\nStep 6: Simulating review service logic...');
    
    // Verification
    const { data: attempt, error: attemptError } = await supabase
      .from('tryout_sessions')
      .select('id, user_id, package_id, total_score, is_passed')
      .eq('id', testSession.id)
      .eq('user_id', testSession.user_id)
      .single();

    if (attemptError) {
      console.error('❌ Attempt verification failed:', attemptError.message);
      return;
    }

    if (!attempt) {
      console.error('❌ Attempt not found');
      return;
    }

    console.log('✅ Attempt verified');
    console.log(`  - ID: ${attempt.id}`);
    console.log(`  - User ID: ${attempt.user_id}`);
    console.log(`  - Score: ${attempt.total_score}`);
    console.log(`  - Passed: ${attempt.is_passed}`);

    // Build expected review structure
    const expectedReview = answers
      .map((answer) => {
        const question = questions.find((q) => q.id === answer.question_id);
        if (!question) return null;

        return {
          questionId: question.id,
          questionNumber: question.number,
          category: (question.category || '').toUpperCase(),
          status: answer.is_correct ? 'correct' : (answer.user_answer ? 'incorrect' : 'unanswered'),
          userAnswer: answer.user_answer || null,
          correctAnswer: question.correct_answer || null,
        };
      })
      .filter(Boolean);

    console.log(`\n✅ Expected review structure (${expectedReview.length} items):`);
    console.log(JSON.stringify(expectedReview.slice(0, 2), null, 2));

    console.log('\n✅ All database queries passed!');
    console.log(`\n📌 To test the endpoint, use attemptId: ${testSession.id}`);
    console.log(`   Try: http://localhost:3000/review/${testSession.id}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testReviewEndpoint();
