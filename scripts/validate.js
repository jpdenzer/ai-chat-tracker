#!/usr/bin/env node
'use strict';
// Validates every entry in data/entries/ and data/examples/:
//   - JSON parses; file name is <id>.json; schema + option values + lengths
//   - no duplicate ids across both folders
//   - options.json is internally consistent
//   - generated files (schema, issue template, docs tables) are up to date
// Usage: node scripts/validate.js [file.json ...]   (default: all entries)
const path = require('path');
const { P, loadOptions, loadEntryFiles, readJson } = require('./lib/repo');
const { createValidator } = require('./lib/validate-entry');
const generate = require('./generate');

function checkOptions(options) {
  const problems = [];
  for (const [name, list] of Object.entries(options.lists)) {
    if (!Array.isArray(list) || !list.length) problems.push(`list "${name}" is empty`);
    const labels = list.map((o) => o.label);
    if (new Set(labels).size !== labels.length) problems.push(`list "${name}" has duplicate labels`);
    for (const l of labels) {
      if (typeof l !== 'string' || !l.trim() || /^(none|n\/a)$/i.test(l)) problems.push(`list "${name}" has an invalid label "${l}"`);
    }
  }
  const keys = options.fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) problems.push('duplicate field keys');
  const labels = options.fields.map((f) => f.label).concat(options.consent.label);
  if (new Set(labels).size !== labels.length) problems.push('duplicate field labels (the issue parser needs unique labels)');
  for (const f of options.fields) {
    if (!/^[a-z0-9_]+$/.test(f.key)) problems.push(`field key "${f.key}" must be lowercase alphanumeric/underscore`);
    if (f.type === 'dropdown' && !options.lists[f.list]) problems.push(`field "${f.key}" references missing list "${f.list}"`);
    if (!['date', 'dropdown', 'text', 'longtext', 'url'].includes(f.type)) problems.push(`field "${f.key}" has unknown type "${f.type}"`);
  }
  return problems;
}

function main() {
  const options = loadOptions();
  const validate = createValidator(options);
  let failures = 0;
  const fail = (where, msg) => { failures++; console.error(`✗ ${where}: ${msg}`); };

  for (const p of checkOptions(options)) fail('schema/options.json', p);

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const files = args.length
    ? args.map((f) => {
        const file = path.resolve(f);
        try { return { file, name: path.basename(file), entry: readJson(file), parseError: null }; }
        catch (e) { return { file, name: path.basename(file), entry: null, parseError: e.message }; }
      })
    : [...loadEntryFiles(P.entries), ...loadEntryFiles(P.examples)];

  const ids = new Map();
  for (const f of files) {
    const where = path.relative(P.root, f.file);
    if (f.parseError) { fail(where, 'invalid JSON: ' + f.parseError); continue; }
    for (const e of validate(f.entry)) fail(where, `${e.field}: ${e.message}`);
    if (f.entry && f.entry.id) {
      if (f.name !== f.entry.id + '.json') fail(where, `file name must be ${f.entry.id}.json`);
      if (ids.has(f.entry.id)) fail(where, `duplicate id (also in ${ids.get(f.entry.id)})`);
      else ids.set(f.entry.id, where);
    }
  }

  if (!args.length) {
    for (const stale of generate.check(options)) fail(stale, 'out of date; run `npm run generate` and commit');
  }

  if (failures) {
    console.error(`\n${failures} problem(s) found in ${files.length} entr${files.length === 1 ? 'y' : 'ies'}.`);
    process.exit(1);
  }
  console.log(`✓ ${files.length} entr${files.length === 1 ? 'y' : 'ies'} valid; generated files up to date.`);
}

if (require.main === module) main();
module.exports = { checkOptions };
