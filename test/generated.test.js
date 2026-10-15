'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const yaml = require('js-yaml');
const { options } = require('./helpers');
const { P } = require('../scripts/lib/repo');
const generate = require('../scripts/generate');

test('generated files are in sync with options.json', () => {
  assert.deepEqual(generate.check(options), []);
});

test('issue form: ids, labels, and dropdown options mirror options.json', () => {
  const form = yaml.load(fs.readFileSync(P.issueTemplate, 'utf8'));
  assert.deepEqual(form.labels, ['submission']);
  const inputs = form.body.filter((b) => b.type !== 'markdown');
  assert.deepEqual(inputs.map((b) => b.id), [...options.fields.map((f) => f.key), 'consent']);
  for (const f of options.fields) {
    const b = inputs.find((x) => x.id === f.key);
    assert.equal(b.attributes.label, f.label);
    assert.equal(b.validations.required, Boolean(f.required), f.key);
    if (f.type === 'dropdown') assert.deepEqual(b.attributes.options, options.lists[f.list].map((o) => o.label));
    assert.match(b.id, /^[A-Za-z0-9_-]+$/); // GitHub id rule
  }
  const consent = inputs.find((b) => b.id === 'consent');
  assert.equal(consent.type, 'checkboxes');
  assert.deepEqual(consent.attributes.options, [{ label: options.consent.text, required: true }]);
  assert.match(form.body[0].attributes.value, /Do not submit personal data/);
});

test('JSON Schema is generated from options', () => {
  const schema = JSON.parse(fs.readFileSync(P.schema, 'utf8'));
  assert.deepEqual(schema.properties.assistant.enum, options.lists.assistant.map((o) => o.label));
  assert.equal(schema.properties.excerpt.maxLength, 1500);
  assert.equal(schema.additionalProperties, false);
});
