#!/usr/bin/env node
'use strict';
// Regenerates everything derived from schema/options.json:
//   schema/entry.schema.json, .github/ISSUE_TEMPLATE/chat-incident.yml,
//   and the generated tables in README.md and CONTRIBUTING.md.
// Usage: node scripts/generate.js          (write files)
//        node scripts/generate.js --check  (exit 1 if any file is out of date)
const fs = require('fs');
const path = require('path');
const { P, loadOptions } = require('./lib/repo');
const schema = require('./generate-schema');
const issueTemplate = require('./generate-issue-template');
const docs = require('./generate-docs');

function targets(options) {
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  return [
    { file: P.schema, content: schema.render(options) },
    { file: P.issueTemplate, content: issueTemplate.render(options) },
    { file: P.readme, content: docs.renderInto(read(P.readme), options) },
    { file: P.contributing, content: docs.renderInto(read(P.contributing), options) }
  ];
}

/** Returns the list of out-of-date files (relative paths). */
function check(options = loadOptions()) {
  return targets(options)
    .filter((t) => !fs.existsSync(t.file) || fs.readFileSync(t.file, 'utf8') !== t.content)
    .map((t) => path.relative(P.root, t.file));
}

function main() {
  const options = loadOptions();
  if (process.argv.includes('--check')) {
    const stale = check(options);
    if (stale.length) {
      console.error('Generated files are out of date. Run `npm run generate` and commit:\n  ' + stale.join('\n  '));
      process.exit(1);
    }
    console.log('Generated files are up to date.');
    return;
  }
  for (const t of targets(options)) {
    fs.mkdirSync(path.dirname(t.file), { recursive: true });
    fs.writeFileSync(t.file, t.content);
    console.log('wrote ' + path.relative(P.root, t.file));
  }
}

if (require.main === module) main();
module.exports = { check };
