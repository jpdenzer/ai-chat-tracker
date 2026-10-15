'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { options, core, validEntry } = require('./helpers');
const { createValidator } = require('../scripts/lib/validate-entry');
const { loadEntryFiles, P } = require('../scripts/lib/repo');

const validate = createValidator(options);
const fields = (errs) => errs.map((e) => e.field);

test('seed entries are valid, and exactly one published entry is an example', () => {
  const published = loadEntryFiles(P.entries);
  const local = loadEntryFiles(P.examples);
  assert.ok(published.length >= 1 && local.length >= 2);
  for (const f of [...published, ...local]) assert.deepEqual(validate(f.entry), [], f.name);
  assert.equal(published.filter((f) => f.entry.example === true).length, 1);
});

test('a minimal entry is valid', () => {
  assert.deepEqual(validate(validEntry()), []);
});

test('missing required fields are reported', () => {
  const e = validEntry();
  delete e.severity;
  delete e.excerpt;
  assert.deepEqual(fields(validate(e)).sort(), ['excerpt', 'severity']);
});

test('excerpt limit is 1,500 code points (emoji count once)', () => {
  assert.deepEqual(validate(validEntry({ excerpt: '😀'.repeat(1500) })), []);
  const errs = validate(validEntry({ excerpt: 'x'.repeat(1501) }));
  assert.deepEqual(fields(errs), ['excerpt']);
  assert.match(errs[0].message, /1,501 characters; the limit is 1,500/);
});

test('dropdown values must match options exactly', () => {
  assert.deepEqual(fields(validate(validEntry({ assistant: 'claude' }))), ['assistant']);
  assert.deepEqual(fields(validate(validEntry({ severity: 'Critical' }))), ['severity']);
});

test('assistant_other is required iff assistant is Other', () => {
  assert.deepEqual(fields(validate(validEntry({ assistant: 'Other' }))), ['assistant_other']);
  assert.deepEqual(validate(validEntry({ assistant: 'Other', assistant_other: 'Foo' })), []);
  assert.deepEqual(fields(validate(validEntry({ assistant_other: 'Foo' }))), ['assistant_other']);
});

test('secondary behavior type must differ from primary', () => {
  assert.deepEqual(fields(validate(validEntry({ behavior_type_secondary: 'Instruction drift' }))), ['behavior_type_secondary']);
  assert.deepEqual(validate(validEntry({ behavior_type_secondary: 'Fabrication' })), []);
});

test('dates: format, real calendar date, not in the future, matches id', () => {
  assert.ok(fields(validate(validEntry({ date: '2026-02-30', id: '2026-02-30-abc123' }))).includes('date'));
  assert.ok(fields(validate(validEntry({ date: '09/01/2026' }))).includes('date'));
  assert.ok(fields(validate(validEntry({ date: '2999-01-01', id: '2999-01-01-abc123' }))).includes('date'));
  assert.deepEqual(fields(validate(validEntry({ id: '2026-09-02-abc123' }))), ['id']);
  assert.deepEqual(fields(validate(validEntry({ id: '2026-09-01-ABC123' }))), ['id']);
});

test('chat_link must be a single https URL', () => {
  assert.deepEqual(fields(validate(validEntry({ chat_link: 'http://x.example/a' }))), ['chat_link']);
  assert.deepEqual(fields(validate(validEntry({ chat_link: 'javascript:alert(1)' }))), ['chat_link']);
  assert.deepEqual(fields(validate(validEntry({ chat_link: 'https://a.example/x https://b.example' }))), ['chat_link']);
  assert.deepEqual(validate(validEntry({ chat_link: 'https://a.example/share/1' })), []);
});

test('unknown fields, empty strings, and wrong types are rejected', () => {
  assert.deepEqual(fields(validate(validEntry({ extra: 'x' }))), ['extra']);
  assert.deepEqual(fields(validate(validEntry({ notes: '' }))), ['notes']);
  assert.deepEqual(fields(validate(validEntry({ example: 'yes' }))), ['example']);
  assert.deepEqual(fields(validate([])), ['(file)']);
});

test('makeId produces the documented format', () => {
  const id = core.makeId('2026-01-02', (n) => require('crypto').randomBytes(n));
  assert.match(id, /^2026-01-02-[a-z0-9]{6}$/);
});
