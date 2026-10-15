'use strict';
// entry-core.js: CSV export and prefilled-issue URLs (shared with the browser).
const test = require('node:test');
const assert = require('node:assert/strict');
const { options, core, validEntry } = require('./helpers');
const { parseIssueBody } = require('../scripts/lib/issue-parser');

test('CSV: header order, quoting, formula neutralization, examples excluded', () => {
  const rows = [
    validEntry({ excerpt: 'He said "hi", then\nleft' }),
    validEntry({ id: '2026-09-01-zzz999', trigger_prompt: '=HYPERLINK("http://x")', notes: '@SUM(1)' }),
    validEntry({ id: '2026-09-01-eee111', example: true })
  ];
  const csv = core.toCsv(rows, options);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], ['id', ...options.fields.map((f) => f.key)].join(','));
  assert.ok(csv.includes('"He said ""hi"", then\nleft"'));
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`));
  assert.ok(csv.includes("'@SUM(1)"));
  assert.ok(!csv.includes('2026-09-01-eee111'));
  assert.ok(csv.endsWith('\r\n'));
});

test('issue URL: uses template + field ids, exact dropdown labels, encodes everything', () => {
  const e = validEntry({ assistant: 'Claude Code', behavior_type: 'Caving / reversal under pushback', excerpt: 'a&b=c #x\nnew' });
  const { url, omitted } = core.buildIssueUrl(e, options, 'me/repo');
  assert.deepEqual(omitted, []);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://github.com/me/repo/issues/new');
  assert.equal(u.searchParams.get('template'), 'chat-incident.yml');
  assert.equal(u.searchParams.get('assistant'), 'Claude Code');
  assert.equal(u.searchParams.get('behavior_type'), 'Caving / reversal under pushback');
  assert.equal(u.searchParams.get('excerpt'), 'a&b=c #x\nnew');
  assert.equal(u.searchParams.get('title'), '[Incident] Claude Code / Caving / reversal under pushback / 2026-09-01');
  assert.equal(u.searchParams.get('labels'), null, 'no labels param (would 404 without triage rights)');
  assert.equal(u.searchParams.get('id'), null);
  assert.ok(!url.includes('+'), 'spaces are %20, not +');
});

test('issue URL: too long -> longest text fields omitted (never truncated), dropdowns kept', () => {
  const e = validEntry({
    trigger_prompt: 'p'.repeat(4000),
    custom_instructions: 'c'.repeat(2000),
    excerpt: 'é'.repeat(1500), // 6 bytes each once percent-encoded
    notes: 'short note'
  });
  const { url, omitted, tooLong } = core.buildIssueUrl(e, options, 'me/repo');
  assert.ok(url.length <= core.MAX_ISSUE_URL_LENGTH, `url length ${url.length}`);
  assert.equal(tooLong, false);
  assert.ok(omitted.length >= 1);
  assert.equal(omitted[0], 'excerpt'); // longest when encoded
  const u = new URL(url);
  for (const k of omitted) assert.equal(u.searchParams.get(k), null);
  for (const k of ['date', 'assistant', 'account_type', 'behavior_type', 'severity', 'reproduced']) assert.ok(u.searchParams.get(k), k);
  for (const [k, v] of u.searchParams) if (e[k]) assert.equal(v, e[k], 'kept fields are complete');
});

test('issue URL prefill round-trips through the issue parser', () => {
  // Simulate GitHub: prefilled values land verbatim in the matching fields.
  const e = validEntry({ notes: 'multi\nline <b>notes</b>' });
  const u = new URL(core.buildIssueUrl(e, options, 'me/repo').url);
  const values = {};
  for (const f of options.fields) values[f.key] = u.searchParams.get(f.key) || '';
  const { issueBody } = require('./helpers');
  const parsed = parseIssueBody(issueBody(values), options).entry;
  const expected = { ...e };
  delete expected.id;
  assert.deepEqual(parsed, expected);
});

test('client-side and server-side validation agree on core rules', () => {
  const { createValidator } = require('../scripts/lib/validate-entry');
  const server = createValidator(options);
  const cases = [
    validEntry(),
    validEntry({ excerpt: 'x'.repeat(1501) }),
    validEntry({ assistant: 'Other' }),
    validEntry({ behavior_type_secondary: 'Instruction drift' }),
    validEntry({ date: '2026-13-01', id: '2026-13-01-abc123' }),
    validEntry({ chat_link: 'ftp://x' })
  ];
  for (const c of cases) {
    assert.equal(core.validateFields(c, options).length === 0, server(c).length === 0, JSON.stringify(c).slice(0, 80));
  }
});
