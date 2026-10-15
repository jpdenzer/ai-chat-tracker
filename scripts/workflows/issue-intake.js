'use strict';
// Entry point for actions/github-script in .github/workflows/issue-intake.yml.
// Reads the issue from the event payload (never from shell interpolation),
// validates it, labels it, and posts/updates a single bot comment.
// Comments never echo submitted text back, only field labels and our messages.
const path = require('path');
const { checkIssue } = require(path.join(__dirname, '..', 'lib', 'issue-check'));

const MARKER = '<!-- anomaly-log:intake -->';
const LABELS = { ok: 'needs-review', bad: 'invalid', approved: 'approved' };

async function upsertComment(github, owner, repo, issueNumber, body) {
  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: issueNumber, per_page: 100 });
  const mine = comments.find((c) => c.user && c.user.type === 'Bot' && typeof c.body === 'string' && c.body.startsWith(MARKER));
  if (mine) await github.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
  else await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
}

async function removeLabel(github, owner, repo, issueNumber, name) {
  try {
    await github.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name });
  } catch (e) {
    if (e.status !== 404) throw e;
  }
}

function formatProblems(problems) {
  return problems.map((p) => `- **${p.label}**: ${p.message}`).join('\n');
}

module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const issue = context.payload.issue;
  const labels = (issue.labels || []).map((l) => l.name);
  if (labels.includes(LABELS.approved)) {
    core.info('Already approved; intake does not re-label approved issues.');
    return;
  }

  const result = checkIssue(issue.body || '', { issueNumber: issue.number });

  let body;
  if (result.ok) {
    body = [
      MARKER,
      '✅ **Automatic checks passed.** Thanks for the report. A maintainer will review it before it appears in the log.',
      '',
      'Before review, please re-read your text once more and remove anything personal or confidential. You can edit the issue; checks re-run on every edit.'
    ].join('\n');
  } else {
    body = [
      MARKER,
      `⚠️ **Automatic checks found ${result.problems.length} problem(s).** Please edit the issue to fix them; checks re-run on every edit.`,
      '',
      formatProblems(result.problems)
    ].join('\n');
  }

  await upsertComment(github, owner, repo, issue.number, body);
  await github.rest.issues.addLabels({ owner, repo, issue_number: issue.number, labels: [result.ok ? LABELS.ok : LABELS.bad] });
  await removeLabel(github, owner, repo, issue.number, result.ok ? LABELS.bad : LABELS.ok);
  core.info(result.ok ? 'valid' : `invalid: ${result.problems.length} problem(s)`);
};

module.exports.formatProblems = formatProblems;
module.exports.MARKER = MARKER;
