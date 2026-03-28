#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const output = [];

try {
  output.push('='.repeat(70));
  output.push('TEST 1: SMTP Connectivity Verification');
  output.push('='.repeat(70));
  
  try {
    const result = execSync('node scripts/test_smtp.js', { 
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    output.push(result);
  } catch (err) {
    output.push('STDOUT:', err.stdout || '(no stdout)');
    output.push('STDERR:', err.stderr || '(no stderr)');
    output.push('Status:', err.status);
  }

  output.push('');
  output.push('='.repeat(70));
  output.push('TEST 2: SMTP Send Test');
  output.push('='.repeat(70));
  
  try {
    const result = execSync('node scripts/test_smtp_send.js', {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    output.push(result);
  } catch (err) {
    output.push('STDOUT:', err.stdout || '(no stdout)');
    output.push('STDERR:', err.stderr || '(no stderr)');
    output.push('Status:', err.status);
  }

} catch (err) {
  output.push('ERROR:', err.message);
}

const combined = output.join('\n');
console.log(combined);

fs.writeFileSync(path.join(__dirname, 'test_results.txt'), combined, 'utf8');
console.log('\n[Output saved to test_results.txt]');
