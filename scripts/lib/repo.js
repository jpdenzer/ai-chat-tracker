'use strict';
// Paths and loaders shared by all scripts.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const P = {
  root: ROOT,
  options: path.join(ROOT, 'schema', 'options.json'),
  schema: path.join(ROOT, 'schema', 'entry.schema.json'),
  entries: path.join(ROOT, 'data', 'entries'),
  examples: path.join(ROOT, 'data', 'examples'),
  index: path.join(ROOT, 'data', 'index.json'),
  csv: path.join(ROOT, 'data', 'entries.csv'),
  issueTemplate: path.join(ROOT, '.github', 'ISSUE_TEMPLATE', 'chat-incident.yml'),
  docs: path.join(ROOT, 'docs'),
  site: path.join(ROOT, '_site'),
  readme: path.join(ROOT, 'README.md'),
  contributing: path.join(ROOT, 'CONTRIBUTING.md')
};

const core = require(path.join(ROOT, 'docs', 'assets', 'entry-core.js'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadOptions() {
  return readJson(P.options);
}

/** Returns [{ file, name, entry | null, parseError | null }] for *.json in dir. */
function loadEntryFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      try {
        return { file, name, entry: JSON.parse(fs.readFileSync(file, 'utf8')), parseError: null };
      } catch (e) {
        return { file, name, entry: null, parseError: e.message };
      }
    });
}

/** Canonical on-disk form: fixed key order, 2-space JSON, trailing newline. */
function serializeEntry(entry, options) {
  const ordered = {};
  ['id', ...options.fields.map((f) => f.key), 'example', 'source_issue'].forEach((k) => {
    if (entry[k] !== undefined) ordered[k] = entry[k];
  });
  return JSON.stringify(ordered, null, 2) + '\n';
}

module.exports = { P, core, readJson, loadOptions, loadEntryFiles, serializeEntry };
