# Contributing

Thanks for helping document how AI assistants behave in practice. Please keep reports **factual, neutral, and descriptive**: say what happened, not what you think of the vendor.

> [!WARNING]
> **Privacy.** Do not submit personal data, confidential or proprietary material, credentials, or other people's private information. Redact names, emails, account or order numbers, file paths, internal URLs, and anything you wouldn't post publicly. Submissions are public as soon as you create the issue or PR.

By submitting, you confirm: **"I removed personal and confidential information and agree to release this submission under CC BY 4.0."**

## Ways to submit

1. **Web form:** the site's Contribute page opens a prefilled issue for you.
2. **Issue form:** open a new issue with the **Report an incident** template.
3. **Pull request:** add one JSON file (below).

## What makes a good report

- **One incident per report.** If one chat had two separate problems, file two reports.
- **Quote, don't paraphrase,** the odd part of the response in `excerpt` (max 1,500 characters). Trim to what is needed.
- Include the **exact prompt** that triggered it, redacted as needed.
- Pick the **primary behavior type** that fits best. Add a secondary type only if a second one clearly applies too.
- Rate **severity** by the effect it had or could have had (definitions below).
- Say whether you **retried** it.
- **Chat links are optional.** Links to private chats won't work for others, and a public share link exposes the *entire* conversation. Check the whole chat before sharing a link.

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

<!-- BEGIN GENERATED:severity -->
| Severity | Definition |
|---|---|
| Minor | Noticeable but harmless, no effect on outcome. |
| Moderate | Would mislead or waste effort if not caught. |
| Major | Seriously wrong or risky; could cause harm or a wrong decision if trusted. |
<!-- END GENERATED:severity -->

## Submitting by pull request

1. Fork the repository and create a branch.
2. Create `data/entries/<id>.json`, where `<id>` is the incident date plus `-` and 6 random lowercase letters or digits (for example `2026-03-14-k3f9qa`). Easiest options:
   - the web form's **Download as JSON** button, or
   - `npm ci && npm run new-entry` (interactive).
3. Run `npm test`. It validates every entry against [`schema/entry.schema.json`](schema/entry.schema.json) and [`schema/options.json`](schema/options.json).
4. Commit **only** your entry file and open a PR. Fill in the PR template checklist.

Don't commit `data/index.json` or `data/entries.csv`; those are built when the site deploys.

### Format

```json
{
  "id": "2026-03-14-k3f9qa",
  "date": "2026-03-14",
  "assistant": "Other",
  "assistant_other": "Name of the assistant",
  "account_type": "Free",
  "trigger_prompt": "The prompt that triggered the behavior.",
  "behavior_type": "Fabrication",
  "severity": "Moderate",
  "excerpt": "The odd part of the response.",
  "reproduced": "Untested"
}
```

- Keys and dropdown values must match exactly (case and punctuation included).
- Leave out optional fields you don't have. Don't use `""`.
- `assistant_other` is required when `assistant` is `Other`, and must be absent otherwise.
- `behavior_type_secondary`, if present, must differ from `behavior_type`.
- `chat_link` must be a single `https://` link.

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

## Moderation policy

Maintainers review every submission before it is published. We may **edit, ask for changes, or decline** a submission that:

- contains personal data, confidential or proprietary material, or credentials, even partly redacted;
- describes someone else's chat without their permission;
- is not about assistant behavior (for example, product support requests or outages);
- is abusive, promotional, or written to attack a person or company rather than describe behavior;
- appears fabricated, or can't be understood from the information given;
- duplicates an existing entry.

Maintainers may lightly edit for privacy, format, and neutral tone. Substantive changes are discussed with the submitter on the issue or PR. Decisions are made in good faith; if you disagree, reply on the issue.

## Removal requests

Anyone can ask for an entry to be removed, especially if it contains their personal information. Open an issue with the **Request removal** template and give the entry id, **without repeating the sensitive content**. For something that shouldn't be discussed publicly, use the private route in [SECURITY.md](SECURITY.md). Maintainers remove the entry promptly and, where personal data is involved, rewrite history or ask GitHub Support to purge cached views.

## Changing dropdown options or fields

All lists live in [`schema/options.json`](schema/options.json). To add an assistant, for example:

1. Add `{ "label": "New Assistant" }` to `lists.assistant`, before `Other`.
2. Run `npm run generate`. This updates the JSON Schema, the issue form, and the tables in README/CONTRIBUTING.
3. Run `npm test` and open a PR.

CI fails if the generated files are out of sync with `options.json`. Renaming or removing a value invalidates existing entries that use it, so update those entries in the same PR.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful to other contributors, maintainers, and the people who build these products.
