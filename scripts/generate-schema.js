'use strict';
// Renders schema/entry.schema.json from schema/options.json.
const { core } = require('./lib/repo');

function renderSchema(options) {
  const properties = {
    id: {
      type: 'string',
      pattern: core.ID_RE.source,
      description: 'Entry id: the incident date plus a 6-character random suffix. Must match the file name.'
    }
  };
  const required = ['id'];

  for (const f of options.fields) {
    const p = { type: 'string', description: f.help };
    if (f.type === 'dropdown') p.enum = core.listLabels(options, f.list);
    else p.minLength = 1;
    if (f.type === 'date') { p.pattern = '^\\d{4}-\\d{2}-\\d{2}$'; p.format = 'date'; }
    if (f.type === 'url') { p.pattern = '^https://\\S+$'; p.format = 'uri'; }
    if (f.maxLength) p.maxLength = f.maxLength;
    properties[f.key] = p;
    if (f.required) required.push(f.key);
  }
  properties.example = {
    type: 'boolean',
    description: 'true = format example only; shown on Browse but excluded from the dashboard and CSV.'
  };
  properties.source_issue = {
    type: 'integer',
    minimum: 1,
    description: 'Issue number this entry was created from, if any.'
  };

  const allOf = options.fields
    .filter((f) => f.requiredIf)
    .map((f) => ({
      if: { properties: { [f.requiredIf.field]: { const: f.requiredIf.equals } }, required: [f.requiredIf.field] },
      then: { required: [f.key] },
      else: { not: { required: [f.key] } }
    }));

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://github.com/' + options.project.repository + '/schema/entry.schema.json',
    title: options.project.name + ' entry',
    description: 'GENERATED from schema/options.json by `npm run generate`. Do not edit by hand. One incident per file at data/entries/<id>.json.',
    type: 'object',
    additionalProperties: false,
    required,
    properties,
    allOf
  };
}

module.exports = { renderSchema, render: (options) => JSON.stringify(renderSchema(options), null, 2) + '\n' };
