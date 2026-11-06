# Pocket Trash PR Review Tool

A fork-safe, reusable GitHub Actions reviewer. The project is under active construction; the current fixture path validates trusted configuration and fake model output, then renders the same review contract production runs will use.

```sh
pnpm test
pnpm fixture
```

## Dependency policy

Third-party GitHub Actions must be pinned to full commit SHAs, and downloaded command-line tools must use exact versions. Pull-request content is untrusted data: the reusable reviewer must never execute it, load configuration from it, or expose credentials to it.

See [SECURITY.md](SECURITY.md) for the trust boundary and vulnerability reporting process.

Use Node 22 and pnpm 11.27.1. Run `pnpm install --frozen-lockfile`,
`pnpm security:audit`, `pnpm test`, `pnpm typecheck`, and `pnpm fixture`.
External releases must be at least seven days old, including frozen lockfile
installs; only the three named Pocket Trash packages are exempt. The audit
blocks high/critical findings and malformed, unavailable, or timed-out reports.
Review artifacts and promotion stop when the audit fails.

OpenCode and the skills installer run from locked dependencies. OpenCode's
OpenAI-compatible SDK is bundled in its pinned distribution; it is not an
additional runtime npm install. Inference still runs in the isolated evidence
workspace. Skill source commits and existing failure diagnostics are preserved.

Every PR requires a nonempty Changeset for `@pocket-trash/pr-review-tool`.
Promotion additionally requires passing Test and Dependency security workflows
for the exact selected main-history commit. No promotion is performed by this
migration. Roll back implementation through a reviewed revert; keep security
checks and the lockfile policy in place. Older commits without passing security
checks cannot be promoted; qualify a revert commit instead.
