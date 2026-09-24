---
name: atomic-commits
description: Commit work as small, atomic, self-contained commits while developing. Use after every logical unit of change (a function, a fix, a config tweak, a test, a rename) and before ending any turn that touched files. Never batch unrelated changes into one commit and never leave the working tree dirty.
---

# Atomic commits

Commit continuously as you work. One logical change = one commit. The working
tree must be clean (`git status --porcelain` empty) at the end of every turn.

## When to commit

Commit immediately after each of these, before moving on to the next thing:

- A new function/module/component that works on its own
- A bug fix
- A refactor or rename (separate from any behavior change)
- Adding or updating tests (with the code they test, or on their own if tests-only)
- Dependency, config, build, or tooling changes
- Formatting-only or doc-only changes (always their own commit)

If you're about to start a second, unrelated change and the first one isn't
committed yet — stop and commit the first one.

## What "atomic" means

- **One purpose.** The message can describe it without the word "and". If it
  needs "and", split it.
- **Small.** Aim for well under ~150 changed lines. Large generated files
  (lockfiles, snapshots) are fine if they belong to the change.
- **Builds/works on its own.** Don't commit a half-edited file that breaks the
  build if you can avoid it; order the commits so each one stands.
- **Refactor and behavior change never share a commit.**

## How to commit

1. Look at what changed: `git status --porcelain` and `git diff`.
2. If changes span more than one purpose, stage them separately:
   - Whole files: `git add <path>`
   - Parts of a file: write the hunk to a patch and `git apply --cached`, or
     temporarily split the edit. (`git add -p` is interactive and not available.)
3. Review what's staged: `git diff --cached --stat`.
4. Commit with a Conventional Commits message:

   ```
   <type>(<optional scope>): <imperative summary, ≤ 72 chars>

   <optional body: why, not what>
   ```

   Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`,
   `build`, `ci`, `perf`.

   Examples:
   - `feat(auth): add token refresh on 401`
   - `fix(api): handle empty response body`
   - `refactor: extract date parsing into utils`
   - `chore: add eslint config`

5. Repeat until `git status --porcelain` is empty.

## Rules

- Never leave uncommitted changes at the end of a turn. A Stop hook enforces this.
- Never use `git add -A` / `git add .` blindly across unrelated changes — group by purpose first.
- Never commit secrets (`.env`, keys, credentials). Add them to `.gitignore` instead and commit the `.gitignore` change.
- Never amend, rebase, or force-push existing commits unless the user asks.
- Never push unless the user asks. Committing is local and automatic; pushing is not.
- Never skip hooks (`--no-verify`). If a pre-commit hook fails, fix the cause and commit again.
- If the directory isn't a git repo, run `git init` first.
