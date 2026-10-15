# AI Chat Anomaly Log

A public, community-contributed log of odd or inconsistent AI assistant behavior: instruction drift, fabrication, odd refusals, self-contradiction, caving under pushback, and identity or tone oddities. One row per incident, reviewed by maintainers before publication.

**Live site:** https://jpdenzer.github.io/ai-chat-tracker/ *(available once Pages is enabled)*

> [!WARNING]
> **Privacy.** Do not submit personal data, confidential or proprietary material, credentials, or other people's private information. Redact before submitting. Everything you submit is public.

Entries are **reports of observed behavior** by individual contributors. They are not verified claims about any vendor's product, and the number of reports says nothing about how often a behavior occurs.

## Contents

- [How to contribute](#how-to-contribute)
- [Field definitions](#field-definitions)
- [How the data is structured](#how-the-data-is-structured)
- [Run locally](#run-locally)
- [Maintainers: setup](#maintainers-setup)
- [Request removal](#request-removal)
- [Licenses](#licenses)

## How to contribute

Pick whichever path suits you. All three end in maintainer review.

1. **Web form** (easiest). Use the site's **Contribute** page. It checks your entry, then opens a prefilled GitHub issue; you review it and click *Create*. If your report is too long for a prefilled link, the page tells you which fields to paste in by hand, with copy buttons.
2. **Issue form.** Open a new issue with the **Report an incident** template. Automatic checks comment on the issue and label it `needs-review` or `invalid`.
3. **Pull request.** Add one file, `data/entries/<id>.json`. Use the web form's *Download as JSON* button or `npm run new-entry` to create it. See [CONTRIBUTING.md](CONTRIBUTING.md).

You need a GitHub account for all three.

## Field definitions

<!-- BEGIN GENERATED:fields -->
| Key | Label | Type | Required | Notes |
|---|---|---|---|---|
| `date` | Date | YYYY-MM-DD | yes | Date the behavior occurred (YYYY-MM-DD). |
| `assistant` | Assistant | dropdown | yes | Which assistant produced the behavior. Values: ChatGPT, Claude, Claude Code, Codex, Copilot, Gemini, WoS RA, Other. |
| `assistant_other` | Assistant name (if Other) | text | only if assistant is Other | Required only when Assistant is Other. max 100 chars |
| `model_version` | Model / version | text | no | As shown in the UI, if visible. max 100 chars |
| `account_type` | Account type | dropdown | yes | Type of account used. Values: Paid, Free, Academic / Institutional. |
| `task_domain` | Task domain | dropdown | no | What kind of work you were doing. Values: Research, Reference / fact-check, Coding, Writing / editing, Data analysis, General chat, Other. |
| `features_on` | Features on | text | no | Web search, memory, tools, file uploads, etc. max 300 chars |
| `custom_instructions` | Custom instructions | long text | no | Custom instructions or system prompt used, if any. Redact anything personal. max 2,000 chars |
| `trigger_prompt` | Trigger prompt | long text | yes | The prompt that triggered the behavior. Redact personal or confidential details. max 4,000 chars |
| `behavior_type` | Behavior type (primary) | dropdown | yes | The main kind of odd behavior. Values: Instruction drift, Fabrication, Odd refusal / over-caution, Self-contradiction, Caving / reversal under pushback, Identity / persona / tone. |
| `behavior_type_secondary` | Behavior type (secondary) | dropdown | no | Optional second type. Must differ from the primary type. Values: Instruction drift, Fabrication, Odd refusal / over-caution, Self-contradiction, Caving / reversal under pushback, Identity / persona / tone. |
| `severity` | Severity | dropdown | yes | How much it mattered. Values: Minor, Moderate, Major. |
| `excerpt` | Excerpt | long text | yes | The odd part of the response, max 1,500 characters. Quote only what is needed. max 1,500 chars |
| `chat_link` | Chat link | URL | no | Shared-chat link, if public. Links to private chats won't work for others, and a shared link can expose the whole conversation. max 500 chars |
| `reproduced` | Reproduced | dropdown | yes | Did you retry, and did it happen again? Values: Reproduced, Not reproduced, Untested. |
| `notes` | Notes | long text | no | Anything else that helps a reader understand the incident. max 2,000 chars |
<!-- END GENERATED:fields -->

### Behavior types

<!-- BEGIN GENERATED:behavior-types -->
| Behavior type | Definition |
|---|---|
| Instruction drift | Ignores, forgets, or gradually drifts from explicit instructions (format, constraints, persona, scope). |
| Fabrication | Invents facts, sources, quotes, citations, actions, or capabilities it doesn't have. |
| Odd refusal / over-caution | Refuses, hedges, or adds warnings in a case that seems clearly benign. |
| Self-contradiction | Contradicts something it said earlier in the same chat, without being prompted. |
| Caving / reversal under pushback | Abandons a correct or previously stated position when the user merely pushes back. |
| Identity / persona / tone | Odd claims about itself, unexpected persona shifts, or tone that doesn't fit the context. |
<!-- END GENERATED:behavior-types -->

### Severity

<!-- BEGIN GENERATED:severity -->
| Severity | Definition |
|---|---|
| Minor | Noticeable but harmless, no effect on outcome. |
| Moderate | Would mislead or waste effort if not caught. |
| Major | Seriously wrong or risky; could cause harm or a wrong decision if trusted. |
<!-- END GENERATED:severity -->

### Reproduced

<!-- BEGIN GENERATED:reproduced -->
| Reproduced | Definition |
|---|---|
| Reproduced | Happened again when the same or a similar prompt was retried. |
| Not reproduced | Retried, but the behavior did not happen again. |
| Untested | Not retried. |
<!-- END GENERATED:reproduced -->

The tables above are generated from [`schema/options.json`](schema/options.json); don't edit them by hand.

## How the data is structured

```
schema/options.json         single source of truth: every dropdown list, its definitions, and the field list
schema/entry.schema.json    JSON Schema for one entry (generated from options.json)
data/entries/<id>.json      one published entry per file
data/examples/<id>.json     local test entries; validated, never published
data/index.json             built: all published entries (git-ignored; built at deploy)
data/entries.csv            built: same, minus format examples (git-ignored; built at deploy)
docs/                       the static site (HTML/CSS/JS, vendored Chart.js)
scripts/                    Node tools (validate, build, generate, new-entry, issue parsing)
.github/                    issue form (generated), PR template, workflows
```

- **id** = incident date + `-` + 6 random lowercase letters/digits, e.g. `2026-03-14-k3f9qa`. The file name must be `<id>.json`. One file per entry means contributions never conflict.
- Optional fields are **omitted** when empty (not `""`).
- `"example": true` marks a format example. It shows on Browse with an *Example* badge, but the dashboard and CSV leave it out.
- `source_issue` (optional integer) links an entry to the issue it came from.
- **Adding a dropdown value** (for example, a new assistant): edit `schema/options.json`, run `npm run generate`, commit. The form, issue template, schema, validator, dashboard, and these docs all follow.

## Run locally

Requires Node 20 or newer.

```sh
npm ci
npm test            # unit tests + validate all entries + check generated files
npm run serve       # builds data (including data/examples/) into _site/ and serves http://127.0.0.1:8080/
npm run new-entry   # interactive CLI that writes data/entries/<id>.json
npm run generate    # regenerate schema, issue template, and docs tables after editing options.json
```

`npm run build` produces the production site in `_site/` (no local examples). Issue links on a local build point at the placeholder repository in `options.json` unless you set `GITHUB_REPOSITORY=owner/repo`.

## Maintainers: setup

### GitHub Pages

The site deploys with the official Pages actions ([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)) on every push to `main`. The workflow builds `data/index.json` and `entries.csv` at deploy time, so no generated data is committed and entry PRs never conflict.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main` (or run *Deploy site* manually from the Actions tab).

The site source lives in `docs/`, but don't pick "Deploy from a branch → /docs": that would serve the site without its built data.

### Labels

| Label | Meaning |
|---|---|
| `submission` | Applied automatically by the issue form; intake runs only on these |
| `needs-review` | Passed automatic checks; waiting for a maintainer |
| `invalid` | Failed automatic checks; the bot comment lists the problems |
| `approved` | Maintainer-only: converts the issue into an entry PR |
| `removal-request` | Applied by the removal-request form |

```sh
gh label create submission      --color 0e8a16 --description "Incident submitted via the issue form"
gh label create needs-review    --color fbca04 --description "Passed automatic checks; awaiting maintainer review"
gh label create invalid         --color e11d21 --description "Failed automatic checks"
gh label create approved        --color 1d76db --description "Maintainer approved: convert to entry"
gh label create removal-request --color 5319e7 --description "Request to remove a published entry"
```

(`invalid` may already exist; use `gh label edit` for that one.)

### Review and approval flow

1. A submission issue arrives. *Issue intake* validates it, comments, and labels it `needs-review` or `invalid`. It re-runs whenever the issue is edited.
2. A maintainer reviews it for privacy, tone, and plausibility, edits the issue if needed (or asks the submitter to), then adds **`approved`**.
3. *Approve submission* checks that the labeler has write access, re-validates the issue, writes `data/entries/<id>.json` on branch `entry/issue-<n>`, opens a PR, comments on the issue, and closes it.
4. Review the PR diff, since the issue could have been edited after approval, and merge. The site redeploys.

Notes:

- PRs opened by the workflow use `GITHUB_TOKEN`, so GitHub won't trigger the *Validate* workflow on them. The approval script validates before opening the PR. If branch protection requires the *Validate* check, close and reopen the PR to run it.
- **Direct-commit mode:** set the repository variable `APPROVAL_MODE` to `commit` (Settings → Secrets and variables → Actions → Variables) to commit approved entries straight to `main` instead of opening a PR. This skips the PR diff review and doesn't work if branch protection blocks the Actions bot.

### Repository settings

- **Actions → General → Workflow permissions:** "Read repository contents and packages permissions" (workflows request more per job), and enable **"Allow GitHub Actions to create and approve pull requests"**, which PR approval mode needs.
- **Actions → General → Fork pull request workflows:** require approval for first-time contributors.
- **Branch protection / ruleset on `main`:** require a pull request and the *Validate / validate* status check; block force pushes.
- **Security → Private vulnerability reporting:** enable it (used for sensitive removal requests; see [SECURITY.md](SECURITY.md)).

### Security design

- Issue content is untrusted. It is never interpolated into `run:` steps or expressions; `actions/github-script` reads it from the event payload and parses it in Node ([`scripts/lib/issue-parser.js`](scripts/lib/issue-parser.js)).
- Bot comments, branch names, commit messages, and PR titles never include submitted text, only field labels, the generated id, and the issue number.
- Each job declares least-privilege `permissions:`. All actions are pinned to commit SHAs.
- `pull_request_target` is **not used**. Fork PRs run *Validate* with a read-only token and no secrets.
- The site renders entry text with `textContent` only and ships a strict Content-Security-Policy. CSV cells that start with `= + - @` are prefixed with `'` to block spreadsheet formula injection.
- A test ([`test/workflows.test.js`](test/workflows.test.js)) fails if a workflow references issue/comment/PR text in an expression or uses an unpinned action.

## Request removal

If an entry contains your personal information or otherwise shouldn't be public, open an issue with the **Request removal** template and give the entry id. Don't repeat the sensitive information in the request. If even the request would expose something sensitive, use the private route in [SECURITY.md](SECURITY.md). Maintainers remove the entry, and if needed purge it from history, promptly.

## Licenses

- **Code** (scripts, site, workflows, templates, schema): [MIT](LICENSE).
- **Data** (everything under `data/`, plus the published JSON and CSV): [CC BY 4.0](LICENSE-DATA). By submitting, contributors agree to release their submission under CC BY 4.0.
- Vendored Chart.js: MIT, see [`docs/vendor/`](docs/vendor/).

See also: [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SECURITY.md](SECURITY.md)
