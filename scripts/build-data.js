#!/usr/bin/env node
'use strict';
// Builds data/index.json (all published entries, newest first) and
// data/entries.csv (same, minus `example: true` entries).
// --with-examples also includes data/examples/ (local testing only; never
// used by the deploy workflow).
// Both outputs are git-ignored: the deploy workflow builds them, so
// contributions never conflict on generated files.
const fs = require('fs');
const path = require('path');
const { P, core, loadOptions, loadEntryFiles } = require('./lib/repo');
const { createValidator } = require('./lib/validate-entry');

function build({ withExamples = false } = {}) {
  const options = loadOptions();
  const validate = createValidator(options);
  const files = [...loadEntryFiles(P.entries), ...(withExamples ? loadEntryFiles(P.examples) : [])];
  const entries = [];
  const ids = new Set();
  for (const f of files) {
    const errors = f.parseError ? [{ field: '(file)', message: f.parseError }] : validate(f.entry);
    if (errors.length) throw new Error(`${path.relative(P.root, f.file)} is invalid; run npm run validate`);
    if (ids.has(f.entry.id)) throw new Error(`duplicate id ${f.entry.id}`);
    ids.add(f.entry.id);
    entries.push(f.entry);
  }
  entries.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));

  const index = {
    generated: new Date().toISOString(),
    count: entries.filter((e) => !e.example).length,
    license: options.project.data_license,
    entries
  };
  fs.mkdirSync(path.dirname(P.index), { recursive: true });
  fs.writeFileSync(P.index, JSON.stringify(index, null, 1) + '\n');
  fs.writeFileSync(P.csv, core.toCsv(entries, options));
  return index;
}

if (require.main === module) {
  const idx = build({ withExamples: process.argv.includes('--with-examples') });
  console.log(`wrote data/index.json (${idx.entries.length} entries, ${idx.count} non-example) and data/entries.csv`);
}
module.exports = { build };
