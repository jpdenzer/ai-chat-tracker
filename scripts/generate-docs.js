'use strict';
// Renders the generated tables inside README.md and CONTRIBUTING.md, between
// <!-- BEGIN GENERATED:name --> and <!-- END GENERATED:name --> markers.

function esc(s) {
  return String(s).replace(/\|/g, '\\|');
}

function fieldsTable(options) {
  const rows = options.fields.map((f) => {
    const type = f.type === 'dropdown' ? 'dropdown' : f.type === 'longtext' ? 'long text' : f.type === 'url' ? 'URL' : f.type === 'date' ? 'YYYY-MM-DD' : 'text';
    const req = f.required ? 'yes' : f.requiredIf ? `only if ${f.requiredIf.field} is ${f.requiredIf.equals}` : 'no';
    const values = f.type === 'dropdown' ? options.lists[f.list].map((o) => o.label).join(', ') : '';
    const limit = f.maxLength ? `max ${f.maxLength.toLocaleString('en-US')} chars` : '';
    const notes = [f.help, values && `Values: ${values}.`, limit].filter(Boolean).join(' ');
    return `| \`${f.key}\` | ${esc(f.label)} | ${type} | ${req} | ${esc(notes)} |`;
  });
  return ['| Key | Label | Type | Required | Notes |', '|---|---|---|---|---|', ...rows].join('\n');
}

function definitionsTable(options, listName, heading) {
  const rows = options.lists[listName].map((o) => `| ${esc(o.label)} | ${esc(o.definition || '')} |`);
  return [`| ${heading} | Definition |`, '|---|---|', ...rows].join('\n');
}

const SECTIONS = {
  fields: fieldsTable,
  'behavior-types': (o) => definitionsTable(o, 'behavior_type', 'Behavior type'),
  severity: (o) => definitionsTable(o, 'severity', 'Severity'),
  reproduced: (o) => definitionsTable(o, 'reproduced', 'Reproduced'),
  'list-values': (o) =>
    ['assistant', 'account_type', 'task_domain']
      .map((l) => `- \`${l}\`: ${o.lists[l].map((x) => x.label).join(', ')}`)
      .join('\n')
};

/** Replace every generated block in `text`. Unknown block names throw. */
function renderInto(text, options) {
  return text.replace(
    /(<!-- BEGIN GENERATED:([a-z-]+) -->\n)[\s\S]*?(<!-- END GENERATED:\2 -->)/g,
    (m, begin, name, end) => {
      if (!SECTIONS[name]) throw new Error('Unknown generated section: ' + name);
      return begin + SECTIONS[name](options) + '\n' + end;
    }
  );
}

module.exports = { renderInto, SECTIONS };
