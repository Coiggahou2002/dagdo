# Project Rules

## CLI command changes

When adding, removing, or modifying any CLI command or flag, update **all** of the following in the same commit:

- `src/commands/help.ts` — help text
- `README.md` — Commands table and relevant usage examples
- `skills/dagdo/SKILL.md` — skill command reference and examples

Do not consider a CLI change complete until all three are in sync.

## Releases

Before creating a version tag or triggering a release, CHANGELOG.md **must** contain an entry for that version (`## X.Y.Z`). Write the changelog entry before committing the release, not after. The CI pipeline and pre-push hook will reject releases without a changelog entry.

## Post-push CI verification

After pushing a version tag, wait ~5 minutes then check the release workflow status:

```bash
gh run list --repo Coiggahou2002/dagdo --workflow release.yml --limit 1
```

If the run failed, investigate immediately — read the logs, fix the issue, and re-release. Do not consider a release done until the workflow succeeds.
