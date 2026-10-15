#!/usr/bin/env node
'use strict';
// Parse and validate an issue body from a file (or stdin) the same way the
// intake workflow does, and print the resulting entry JSON.
// Usage: node scripts/check-issue.js path/to/body.md
//        gh issue view 12 --json body -q .body | node scripts/check-issue.js -
const fs = require('fs');
const { checkIssue } = require('./lib/issue-check');
const { loadOptions, serializeEntry } = require('./lib/repo');

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/check-issue.js <file|->');
  process.exit(2);
}
const body = fs.readFileSync(src === '-' ? 0 : src, 'utf8');
const r = checkIssue(body);
if (r.ok) {
  process.stdout.write(serializeEntry(r.entry, loadOptions()));
  console.error('✓ valid');
} else {
  for (const p of r.problems) console.error(`✗ ${p.label}: ${p.message}`);
  process.exit(1);
}
