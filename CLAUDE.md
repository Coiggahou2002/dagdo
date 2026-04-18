# Project Rules

## CLI command changes

When adding, removing, or modifying any CLI command or flag, update **all** of the following in the same commit:

- `src/commands/help.ts` — help text
- `README.md` — Commands table and relevant usage examples
- `skills/dagdo/SKILL.md` — skill command reference and examples

Do not consider a CLI change complete until all three are in sync.

## Releases

Before creating a version tag or triggering a release:

1. **Bump `package.json` version** to match the tag (e.g. `"version": "0.6.0"` for tag `v0.6.0`). This is the source of truth for `dagdo --version` and compiled binaries.
2. **Write the CHANGELOG entry** (`## X.Y.Z`). The CI pipeline and pre-push hook will reject releases without one.

Both must be done in the release commit, before tagging. CI has a fallback that patches the version from the tag, but the repo should always reflect the correct version.

## Post-push CI verification

After pushing a version tag, wait ~5 minutes then check the release workflow status:

```bash
gh run list --repo Coiggahou2002/dagdo --workflow release.yml --limit 1
```

If the run failed, investigate immediately — read the logs, fix the issue, and re-release. Do not consider a release done until the workflow succeeds.
