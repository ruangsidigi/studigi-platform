const axios = require('axios');
const API = 'http://localhost:5000/api';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  try {
    console.log('--- Simulasi Tryout: Mulai ---');

    // 1) Register user
    const timestamp = Date.now();
    const email = `testuser+${timestamp}@example.com`;
    const password = 'testpassword';
    const name = 'Test User';

    console.log('1) Register user:', email);
    await axios.post(`${API}/auth/register`, { email, password, name }).catch((e) => {
      if (e.response) console.log('Register warning:', e.response.data);
    });

    // 2) Login
    console.log('2) Login');
    const loginRes = await axios.post(`${API}/auth/login`, { email, password });
    const token = loginRes.data.token;
    const user = loginRes.data.user;
    console.log('  - Logged in as', user.email);

    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // 3) Get packages and pick first that has questions
    const pkgsRes = await axios.get(`${API}/packages`, auth);
    const packages = pkgsRes.data;
    if (!packages || packages.length === 0) throw new Error('No packages available');

    let pkg = null;
    for (const p of packages) {
      const qsRes = await axios.get(`${API}/questions/package/${p.id}`, auth);
      if (qsRes.data && qsRes.data.length > 0) {
        pkg = p;
        break;
      }
    }

    if (!pkg) {
      console.log('No packages with questions found. Aborting simulation.');
      return;
    }

    console.log(`3) Selected package: ${pkg.id} - ${pkg.name}`);

    // 4) Create purchase for that package
    console.log('4) Creating purchase for package');
    await axios.post(`${API}/purchases`, { packageIds: [pkg.id], totalPrice: pkg.price }, auth);
    console.log('  - Purchase created');

    // 5) Start tryout
    console.log('5) Starting tryout session');
    const startRes = await axios.post(`${API}/tryouts/start`, { packageId: pkg.id }, auth);
    const sessionId = startRes.data.session.id;
    console.log('  - Session ID:', sessionId);

    // 6) Get questions for package
    console.log('6) Fetching questions for package');
    const qsRes = await axios.get(`${API}/questions/package/${pkg.id}`, auth);
    const questions = qsRes.data;
    console.log(`  - Retrieved ${questions.length} questions`);

    // Count categories and prepare expected totals
    let expected = { twkCount: 0, tiuCount: 0, tkpCount: 0, twkPoints: 0, tiuPoints: 0, tkpPoints: 0 };

    // 7) Submit answers
    console.log('7) Submitting answers...');
    for (const q of questions) {
      const qId = q.id;
      const category = (q.category || '').toUpperCase();
      let selected;

      if (category === 'TWK') {
        expected.twkCount++;
        // Submit correct answer to gain full points
        selected = q.correct_answer || 'a';
        expected.twkPoints += 5; // each correct = 5
      } else if (category === 'TIU') {
        expected.tiuCount++;
        selected = q.correct_answer || 'a';
        expected.tiuPoints += 5;
      } else if (category === 'TKP') {
        expected.tkpCount++;
        // choose an option that may be different from correct to test TKP scoring regardless of correctness
        // pick 'a' unless correct is 'a'
        selected = (q.correct_answer && q.correct_answer.toLowerCase() === 'a') ? 'b' : 'a';
        // compute points for chosen option
        const key = `point_${selected}`;
        const pts = parseFloat(q[key]) || 0;
        expected.tkpPoints += pts;
      } else {
        // default: choose 'a'
        selected = q.correct_answer || 'a';
      }

      // submit
      await axios.post(`${API}/tryouts/submit-answer`, {
        sessionId,
        questionId: qId,
        selectedAnswer: selected,
      }, auth).catch((e) => {
        console.error('  - submit error for q', qId, e.response?.data || e.message);
      });

      // small delay to avoid overwhelming
      await sleep(20);
    }

    console.log('  - All answers submitted');

    // 8) Finish tryout
    console.log('8) Finishing session');
    const finishRes = await axios.post(`${API}/tryouts/finish`, { sessionId }, auth);
    console.log('  - Finish response:', finishRes.data.message);

    // 9) Get results
    const resultsRes = await axios.get(`${API}/tryouts/${sessionId}/results`, auth);
    const sessionData = resultsRes.data.sessionData;

    console.log('\n--- Hasil dari server ---');
    console.log('TWK (server):', sessionData.twkScore);
    console.log('TIU (server):', sessionData.tiuScore);
    console.log('TKP (server):', sessionData.tkpScore);
    console.log('Total (server):', sessionData.totalScore);
    console.log('Status:', sessionData.status);

    console.log('\n--- Ekspektasi berdasarkan simulasi ---');
    console.log('TWK expected points:', expected.twkPoints);
    console.log('TIU expected points:', expected.tiuPoints);
    console.log('TKP expected points:', expected.tkpPoints);
    console.log('Total expected (sum):', Math.round(expected.twkPoints + expected.tiuPoints + expected.tkpPoints));

    // Compare
    const matchTWK = Math.round(sessionData.twkScore) === Math.round(expected.twkPoints);
    const matchTIU = Math.round(sessionData.tiuScore) === Math.round(expected.tiuPoints);
    const matchTKP = Math.round(sessionData.tkpScore) === Math.round(expected.tkpPoints);

    console.log('\n--- Verifikasi ---');
    console.log('TWK match:', matchTWK);
    console.log('TIU match:', matchTIU);
    console.log('TKP match:', matchTKP);

    console.log('\n--- Simulasi selesai ---');
  } catch (error) {
    console.error('Simulasi error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
};

run();
