<!--
Adding an incident? Add exactly ONE file: data/entries/<id>.json
(see CONTRIBUTING.md). Don't commit data/index.json or data/entries.csv.
-->

## What this PR does

- [ ] Adds one incident entry: `data/entries/____.json`
- [ ] Other change (describe):

## Checklist for new entries

- [ ] **I removed personal and confidential information and agree to release this submission under CC BY 4.0.**
- [ ] The file name equals the `id` inside it, and the `id` starts with the `date`.
- [ ] `npm test` passes locally (or I'll rely on CI).
- [ ] The excerpt is quoted, not paraphrased, and is at most 1,500 characters.
- [ ] If I included a `chat_link`, I checked the *whole* shared conversation for private information.
- [ ] The description is neutral and factual.

## Checklist for options or code changes

- [ ] I ran `npm run generate` after editing `schema/options.json`.
- [ ] Existing entries still validate (`npm test`).
