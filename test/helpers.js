'use strict';
const fs = require('fs');
const path = require('path');
const { loadOptions, core } = require('../scripts/lib/repo');

const options = loadOptions();
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

/** Render an entry the way GitHub renders the issue form body. */
function issueBody(values, { consent = true } = {}) {
  const parts = options.fields.map((f) => `### ${f.label}\n\n${values[f.key] ? values[f.key] : '_No response_'}`);
  parts.push(`### ${options.consent.label}\n\n- [${consent ? 'X' : ' '}] ${options.consent.text}`);
  return parts.join('\n\n') + '\n';
}

function validEntry(overrides = {}) {
  return {
    id: '2026-09-01-abc123',
    date: '2026-09-01',
    assistant: 'Claude',
    account_type: 'Paid',
    trigger_prompt: 'Summarize this.',
    behavior_type: 'Instruction drift',
    severity: 'Minor',
    excerpt: 'Here is a long summary…',
    reproduced: 'Untested',
    ...overrides
  };
}

module.exports = { options, core, fixture, issueBody, validEntry };
