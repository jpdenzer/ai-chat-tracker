'use strict';
// Validates one entry object: JSON Schema (generated from options.json) plus
// the cross-field rules shared with the web form (entry-core.js).
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { core, loadOptions } = require('./repo');
const { renderSchema } = require('../generate-schema');

function createValidator(options = loadOptions()) {
  // strictRequired off: if/then/else `required` legitimately names properties
  // that are defined at the top level, not inside the subschema.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  // Compile from options.json directly so a stale schema file can't hide errors;
  // `generate --check` separately enforces that the committed file is in sync.
  const schemaFn = ajv.compile(renderSchema(options));

  return function validateEntry(entry) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return [{ field: '(file)', message: 'Entry must be a JSON object.' }];
    }
    // Readable cross-field/field messages first; schema messages only for
    // fields those rules didn't already flag (types, unknown keys, etc.).
    const errors = [...core.validateFields(entry, options), ...core.validateId(entry)];
    const flagged = new Set(errors.map((e) => e.field));
    if (!schemaFn(entry)) {
      for (const e of schemaFn.errors) {
        const field = e.instancePath.replace(/^\//, '') || (e.params && (e.params.missingProperty || e.params.additionalProperty)) || '(entry)';
        let message = e.message;
        if (e.keyword === 'enum') message = 'must be one of: ' + e.params.allowedValues.join(', ');
        if (e.keyword === 'additionalProperties') message = 'unknown field "' + e.params.additionalProperty + '"';
        if (e.keyword === 'if' || e.keyword === 'not') continue; // covered by requiredIf rules
        if (flagged.has(field)) continue;
        flagged.add(field);
        errors.push({ field, message: 'schema: ' + message });
      }
    }
    return errors;
  };
}

module.exports = { createValidator };
