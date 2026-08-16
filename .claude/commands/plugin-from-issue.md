---
description: Build a plugin from a plugin-request issue and open a PR that closes it
argument-hint: <issue-number>
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

Build the plugin requested in issue #$1, and open a pull request for it.

Read `AGENTS.md` first and follow it. It is the procedure; this file only adds
what is specific to working from someone else's request.

## 1. Read the request

```bash
gh issue view $1 --json number,title,body,author,labels,comments
```

The issue came from a form with fixed fields: what it should do, a concrete
before/after example, what it runs on, which fields it changes, whether it
needs network access, and optional settings. The before/after example is the
specification — where the prose and the example disagree, the example wins.

Check the comments too; requesters often clarify there.

## 2. Decide whether it is buildable, before writing anything

Against `docs/SANDBOX.md` and the permission model, decide if this is possible
at all. Things that are not: talking to hardware or other applications,
anything Lexicon itself cannot do, and anything needing a capability outside
the manifest's permission set.

If it cannot be built, stop and say so with the specific reason — do not build
an approximation and hope. If the request is merely ambiguous, pick the reading
the example supports, build it, and note the assumption in the PR.

## 3. Build it

```bash
npm run new:plugin <folder-name>
```

Then follow the loop in `AGENTS.md`. Constraints specific to this flow:

- **Author is the maintainer, not the requester.** Use
  `"author": { "name": "alt9", "email": "10055660+11ib@users.noreply.github.com" }`
  — the requester did not write or review the code, and Lexicon needs a contact
  route that works. Credit them in the PR instead.
- Name the folder and action ids after what it does, not after the issue.
- Narrow `modifyFields` to exactly the fields named in the request.
- If the request implies configurable numbers or strings, make them `settings`
  rather than constants.

Work on a branch: `plugin/<folder-name>`.

## 4. Verify

`npm run verify` must be green — all five gates, no warnings. Do not open the
PR otherwise.

## 5. Open the PR

```bash
gh pr create --fill
```

Follow `.github/PULL_REQUEST_TEMPLATE.md`, and in the body:

- `Requested by @<issue-author> — closes #$1`
- Fill the permissions table with a real reason per permission
- Tick only the checklist boxes that are actually true. **Leave the "ran this
  against a real Lexicon library" box unticked** — you did not, and a human
  has to before it merges. Say so explicitly rather than leaving it implied.

## 6. Report back

Reply on the issue with a link to the PR and one sentence on what it does, in
the requester's terms. If you made an assumption where the request was
ambiguous, ask them to confirm it there.
