const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_KEY missing in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  try {
    const categories = [
      { name: 'CPNS', description: 'Soal CPNS (SKD/Teknis)' },
      { name: 'BUMN', description: 'Soal seleksi BUMN' },
      { name: 'UTBK', description: 'Soal UTBK/SDM' },
      { name: 'TOEFL', description: 'Latihan TOEFL' },
    ];

    // Insert categories if not exists
    for (const c of categories) {
      let exists = null;
      try {
        const resp = await supabase.from('categories').select('*').eq('name', c.name).limit(1);
        exists = resp.data && resp.data.length ? resp.data[0] : null;
      } catch (e) {
        exists = null;
      }
      if (exists && exists.id) {
        console.log('Category exists:', exists.name, 'id=', exists.id);
        continue;
      }
      const { data: inserted, error: insErr } = await supabase.from('categories').insert([c]).select().single();
      if (insErr) console.error('Category insert error', c.name, insErr.message);
      else console.log('Inserted category', inserted.name, 'id=', inserted.id);
    }

    // Fetch categories
    const { data: cats } = await supabase.from('categories').select('*');
    const catMap = {};
    for (const c of cats) catMap[c.name] = c.id;

    // Fetch existing packages
    const { data: packages } = await supabase.from('packages').select('*');
    if (!packages) {
      console.log('No packages found to map.');
      return;
    }

    // Update packages category for tryout-like names using update by id
    const tryoutMatches = packages.filter(p => p && p.name && /tryout|skd|twk|tiu|tkp/i.test(p.name));
    const tryoutIds = tryoutMatches.map(p => p.id).filter(Boolean);
    if (tryoutIds.length) {
      const { data: upRes, error: upErr } = await supabase.from('packages').update({ category_id: catMap['CPNS'] || null }).in('id', tryoutIds).select();
      if (upErr) console.error('Error updating packages categories', upErr.message);
      else console.log('Updated packages with CPNS category:', upRes.map(r=>r.id));
    }

    // Create a bundle package that includes two existing tryout packages (if present)
    const tryoutPkgs = packages.filter(p => p && p.name && /Tryout|Tryout SKD/i.test(p.name));
    const includedIds = tryoutPkgs.slice(0,2).map(p => p.id).filter(Boolean);
    if (includedIds.length > 0) {
      // avoid duplicate bundle
      let existingBundle = null;
      try {
        const resp = await supabase.from('packages').select('*').eq('name', 'Bundle CPNS Basic').limit(1);
        existingBundle = resp.data && resp.data.length ? resp.data[0] : null;
      } catch (e) {
        existingBundle = null;
      }
      if (existingBundle && existingBundle.id) {
        console.log('Bundle already exists id=', existingBundle.id);
      } else {
        const payload = {
          name: 'Bundle CPNS Basic',
          description: 'Bundle: includes multiple CPNS tryouts',
          type: 'bundle',
          price: Math.round((tryoutPkgs[0]?.price || 50000) * 1.5),
          question_count: (tryoutPkgs.reduce((s,p)=>s+(p.question_count||0),0)),
          category_id: catMap['CPNS'] || null,
          included_package_ids: includedIds,
          created_at: new Date(),
        };

        const { data: bundle, error: bundleErr } = await supabase.from('packages').insert([payload]).select().single();
        if (bundleErr) console.error('Error creating bundle', bundleErr.message);
        else console.log('Created bundle package id=', bundle.id, 'includes', includedIds);
      }
    } else {
      console.log('No tryout packages found to create bundle.');
    }

    // Ensure example BUMN packages exist
    if (catMap['BUMN']) {
      const sampleBumn = [
        { name: 'Tryout BUMN Basic', description: 'Latihan dasar untuk seleksi BUMN', type: 'tryout', price: 30000, question_count: 50, category_id: catMap['BUMN'] },
        { name: 'Tryout BUMN Advanced', description: 'Tryout tingkat lanjut BUMN', type: 'tryout', price: 60000, question_count: 100, category_id: catMap['BUMN'] },
      ];
      for (const p of sampleBumn) {
        try {
          const resp = await supabase.from('packages').select('*').eq('name', p.name).limit(1);
          const exists = resp.data && resp.data.length ? resp.data[0] : null;
          if (exists && exists.id) {
            console.log('Sample package exists:', p.name);
            continue;
          }
        } catch (e) {
          // ignore
        }
        const { data: created, error: createErr } = await supabase.from('packages').insert([p]).select().single();
        if (createErr) console.error('Error creating sample package', p.name, createErr.message);
        else console.log('Created sample package', created.name, 'id=', created.id);
      }
    }

    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seed failed:', err.message);
  }
}

run();
