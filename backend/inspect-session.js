require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const run = async () => {
  const sessionId = process.argv[2] || '10';
  console.log('Inspecting session', sessionId);

  const { data: session, error: sErr } = await supabase
    .from('tryout_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sErr) return console.error('Error fetching session:', sErr.message);
  console.log('Session row:', session);

  const { data: answers, error: aErr } = await supabase
    .from('tryout_answers')
    .select('*, questions(*)')
    .eq('session_id', sessionId)
    .order('id', { ascending: true });

  if (aErr) return console.error('Error fetching answers:', aErr.message);
  console.log('Answers count:', answers.length);
  console.log('First 5 answers (with question keys):');
  console.log(answers.slice(0,5).map(a => ({id: a.id, question_id: a.question_id, user_answer: a.user_answer, is_correct: a.is_correct, question_number: a.questions.number, category: a.questions.category, point_a: a.questions.point_a, point_b: a.questions.point_b, point_c: a.questions.point_c, point_d: a.questions.point_d, point_e: a.questions.point_e})))

  process.exit(0);
};

run();
