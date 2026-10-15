'use strict';
// Renders .github/ISSUE_TEMPLATE/chat-incident.yml (a GitHub issue form) from
// schema/options.json. Field ids equal entry keys so URL prefills and the
// issue parser line up with the JSON format.
const yaml = require('js-yaml');

function definitionsMarkdown(options, listName) {
  return options.lists[listName]
    .map((o) => `- **${o.label}**${o.definition ? ': ' + o.definition : ''}`)
    .join('\n');
}

function renderIssueForm(options) {
  const body = [
    {
      type: 'markdown',
      attributes: {
        value: [
          '## Report an AI assistant incident',
          '',
          `> [!WARNING]\n> **Privacy:** ${options.privacy_warning}`,
          '',
          'One issue per incident. Maintainers review every submission before it appears in the log. ' +
            'Entries are reports of observed behavior, not verified claims about any vendor\'s product.',
          '',
          '**Behavior types**',
          '',
          definitionsMarkdown(options, 'behavior_type'),
          '',
          '**Severity**',
          '',
          definitionsMarkdown(options, 'severity')
        ].join('\n')
      }
    }
  ];

  for (const f of options.fields) {
    const attributes = { label: f.label, description: f.help };
    const type = f.type === 'dropdown' ? 'dropdown' : f.type === 'longtext' ? 'textarea' : 'input';
    if (type === 'dropdown') attributes.options = options.lists[f.list].map((o) => o.label);
    if (f.placeholder) attributes.placeholder = f.placeholder;
    body.push({ type, id: f.key, attributes, validations: { required: Boolean(f.required) } });
  }

  body.push({
    type: 'checkboxes',
    id: options.consent.key,
    attributes: {
      label: options.consent.label,
      options: [{ label: options.consent.text, required: true }]
    }
  });

  return {
    name: 'Report an incident',
    description: 'Log one instance of odd or inconsistent AI assistant behavior.',
    title: options.project.issue_title_prefix + ' ',
    labels: [options.project.submission_label],
    body
  };
}

function render(options) {
  const header =
    '# GENERATED from schema/options.json by `npm run generate`. Do not edit by hand.\n' +
    '# CI fails if this file is out of sync with options.json.\n';
  return header + yaml.dump(renderIssueForm(options), { lineWidth: -1, noRefs: true, quotingType: '"' });
}

module.exports = { renderIssueForm, render };
