'use strict';
// Entry point for actions/github-script in .github/workflows/issue-approve.yml.
// Runs when the `approved` label is added. Only users with write access (or
// higher) may trigger it. Converts the issue into data/entries/<id>.json via
// the REST API and either opens a PR (default) or commits directly when the
// repository variable APPROVAL_MODE is "commit".
// No user text is placed in branch names, titles, commit messages, PR bodies,
// or comments; only the validated id and issue number are used.
const path = require('path');
const { checkIssue } = require(path.join(__dirname, '..', 'lib', 'issue-check'));
const { serializeEntry, loadOptions, core: entryCore } = require(path.join(__dirname, '..', 'lib', 'repo'));
const { formatProblems } = require('./issue-intake');

const WRITE_ROLES = new Set(['admin', 'maintain', 'write']);

async function removeLabel(github, owner, repo, issueNumber, name) {
  try {
    await github.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name });
  } catch (e) {
    if (e.status !== 404) throw e;
  }
}

module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const issue = context.payload.issue;
  const n = issue.number;
  const sender = context.payload.sender.login;
  const say = (body) => github.rest.issues.createComment({ owner, repo, issue_number: n, body });

  // 1. Authorization: the labeler must have write access or higher.
  const { data: perm } = await github.rest.repos.getCollaboratorPermissionLevel({ owner, repo, username: sender });
  const role = perm.role_name || perm.permission;
  if (!WRITE_ROLES.has(role) && !WRITE_ROLES.has(perm.permission)) {
    await removeLabel(github, owner, repo, n, 'approved');
    await say(`The \`approved\` label can only be applied by maintainers with write access. It has been removed.`);
    core.setFailed(`sender lacks write access (${role})`);
    return;
  }

  // 2. Parse and validate the issue as it is now.
  const options = loadOptions();
  const result = checkIssue(issue.body || '', { issueNumber: n });
  if (!result.ok) {
    await removeLabel(github, owner, repo, n, 'approved');
    await github.rest.issues.addLabels({ owner, repo, issue_number: n, labels: ['invalid'] });
    await say(`Could not approve: the submission has problems.\n\n${formatProblems(result.problems)}`);
    core.setFailed('invalid submission');
    return;
  }
  const entry = result.entry;
  if (!entryCore.ID_RE.test(entry.id)) throw new Error('generated id failed format check');
  const filePath = `data/entries/${entry.id}.json`;
  const content = Buffer.from(serializeEntry(entry, options), 'utf8').toString('base64');

  const base = context.payload.repository.default_branch;
  const mode = process.env.APPROVAL_MODE === 'commit' ? 'commit' : 'pr';
  const message = `Add entry ${entry.id} (from #${n})`;

  if (mode === 'commit') {
    const { data } = await github.rest.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message, content, branch: base });
    await say(`Approved and added to the log as \`${entry.id}\` in ${data.commit.sha}. Thank you!`);
  } else {
    const branch = `entry/issue-${n}`;
    const { data: existing } = await github.rest.pulls.list({ owner, repo, head: `${owner}:${branch}`, state: 'open' });
    if (existing.length) {
      await say(`A pull request for this issue is already open: #${existing[0].number}. Close it and delete the branch \`${branch}\` to regenerate.`);
      return;
    }
    const { data: ref } = await github.rest.git.getRef({ owner, repo, ref: `heads/${base}` });
    try {
      await github.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: ref.object.sha });
    } catch (e) {
      if (e.status !== 422) throw e; // branch exists from an earlier, closed attempt: reset it
      await github.rest.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: ref.object.sha, force: true });
    }
    await github.rest.repos.createOrUpdateFileContents({ owner, repo, path: filePath, message, content, branch });
    const { data: pr } = await github.rest.pulls.create({
      owner,
      repo,
      head: branch,
      base,
      title: message,
      body: [
        `Adds \`${filePath}\`, generated from #${n} after maintainer approval by @${sender}.`,
        '',
        '**Before merging:** review the JSON diff (the issue may have been edited after approval) and confirm it contains no personal or confidential data.',
        '',
        'Note: PRs opened by `GITHUB_TOKEN` do not trigger other workflows. The entry was validated before this PR was opened; to run the full CI check, close and reopen this PR.'
      ].join('\n'),
      maintainer_can_modify: true
    });
    await say(`Approved. Opened #${pr.number} to add this entry as \`${entry.id}\`. It will appear on the site after that PR is merged. Thank you!`);
  }

  await removeLabel(github, owner, repo, n, 'needs-review');
  await github.rest.issues.update({ owner, repo, issue_number: n, state: 'closed', state_reason: 'completed' });
  core.info(`approved ${entry.id} via ${mode}`);
};
