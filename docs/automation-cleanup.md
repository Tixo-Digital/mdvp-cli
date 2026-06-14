# Automation Cleanup

Use this checklist after a nightly run, release run, or merged automation PR leaves
old branches and worktrees behind. Cleanup is useful, but deleting the wrong
branch makes a handoff harder to recover, so treat every deletion as a verified
maintenance step.

## Safety Rules

- Never delete the active PR branch.
- Never delete the canonical checkout worktree.
- Never delete a user or reference worktree, even if its branch is behind.
- Delete a GitHub remote branch only when its PR is merged or closed, or when a
  release/nightly branch is covered by an immutable tag and GitHub Release.
- Delete a local worktree only after `git status --short` is empty in that
  worktree.
- Record cleanup status in the automation handoff and memory file.

## Inspect Remote Branches

List open PRs first. Any `headRefName` in this output is active and must stay:

```bash
gh pr list --repo Tixo-Digital/mdvp-cli --state open \
  --json number,title,headRefName,url
```

Then list automation remote branches:

```bash
git fetch origin --prune --tags
git ls-remote --heads origin 'agent/*' 'release/*'
```

For each remote branch that looks stale, confirm its PR state before deleting:

```bash
gh pr list --repo Tixo-Digital/mdvp-cli --state all \
  --search 'head:agent/codex-nightly/example-branch' \
  --json number,state,mergedAt,closedAt,headRefName,url
```

Delete only branches whose PR is merged/closed, or release/nightly branches whose
commit is already represented by a tag/release:

```bash
git push origin --delete agent/codex-nightly/example-branch
```

## Inspect Local Worktrees

Start with the full worktree list:

```bash
git worktree list --porcelain
```

Keep these worktrees unless a human explicitly says otherwise:

- The canonical checkout, usually `/Users/etn/tixo/products/mdvp/cli`.
- The current automation worktree.
- Any active PR worktree.
- Any reference worktree used for comparison, such as a fuller `main` checkout.
- Detached Codex scratch worktrees under `$CODEX_HOME` unless they are clearly
  owned by the current cleanup task.

For each candidate isolated worktree, check cleanliness and branch coverage:

```bash
git -C /path/to/worktree status --short
git merge-base --is-ancestor branch-name origin/main
git tag --points-at branch-name
```

The worktree is safe to remove when it is clean and one of these is true:

- The branch tip is an ancestor of `origin/main`.
- The branch tip is covered by an immutable nightly/release tag.
- The branch is explicitly abandoned in the GitLab handoff.

Remove the worktree before deleting the local branch:

```bash
git worktree remove /path/to/worktree
git branch -D branch-name
```

Use `git branch -D` only after the coverage checks above. It is common for
tagged nightly branches to be intentionally outside `origin/main`.

## Handoff Evidence

Include these facts in the GitLab handoff:

- Open PR branches that were preserved.
- Remote automation branches before and after cleanup.
- Local worktrees removed and why they were safe.
- Local worktrees intentionally preserved.
- Verification commands and pass/fail status.

If GitLab is unavailable, write the same block to `/Users/etn/tixo/CONTEXT.md`
and mirror it back to the issue later.
