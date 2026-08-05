<!--
Thanks for contributing a plugin. CI runs lint, manifest validation, the
permission check and your tests — `npm run verify` runs all of it locally.
-->

## What does this plugin do?

<!-- One or two sentences a DJ would understand. -->

## Permissions

<!--
List every permission in your config.json and why the action needs it.
Reviewers pay closest attention to: network, files, and any delete permission.
-->

| Permission | Why it's needed |
| ---------- | --------------- |
|            |                 |

## Checklist

- [ ] `npm run verify` passes locally
- [ ] Every action has tests covering the happy path and at least one edge case
- [ ] The action `description` in config.json says what it changes, in plain language
- [ ] Permissions are the narrowest that work (no unused grants, no wildcard domains)
- [ ] Any destructive action has a `confirmationMessage`
- [ ] I ran this against a real Lexicon library (say which version below)

**Tested against Lexicon version:**

## Notes for reviewers

<!-- Anything surprising, or a decision you'd like a second opinion on. -->
