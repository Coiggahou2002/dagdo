# Project Rules

## CLI command changes

When adding, removing, or modifying any CLI command or flag, update **all** of the following in the same commit:

- `src/commands/help.ts` — help text
- `README.md` — Commands table and relevant usage examples
- `skills/dagdo/SKILL.md` — skill command reference and examples

Do not consider a CLI change complete until all three are in sync.

## Branch strategy

- **Never push directly to main.** All changes go through feature branches + MR.
- Feature branches: `feat/xxx`, `fix/xxx`, etc. Push freely.
- main branch is protected: requires PR, review, and passing CI.

## Release workflow

Releases are fully automated via MR labels. The process:

1. Create a feature branch, make changes.
2. Record changes under `## [Unreleased]` in CHANGELOG.md.
3. Push the feature branch (triggers alpha package publish to npm).
4. Open a MR to main. Add a version label: `patch`, `minor`, or `major`.
5. CI runs tests + checks the label exists.
6. After review + merge, Release CI automatically:
   - Bumps package.json based on the label
   - Updates CHANGELOG (moves Unreleased to versioned section)
   - Commits, tags, builds binaries, publishes to npm + GitHub Releases

Do NOT:
- Push directly to main
- Manually create version tags
- Manually bump package.json version (CI handles it)

## Post-merge CI verification

After a MR is merged, check the release workflow status:

```bash
gh run list --repo Coiggahou2002/dagdo --workflow release.yml --limit 1
```

If the run failed, investigate immediately.
