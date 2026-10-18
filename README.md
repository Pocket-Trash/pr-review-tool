# Pocket Trash PR Review Tool

A fork-safe, reusable GitHub Actions reviewer. The project is under active construction; the current fixture path validates trusted configuration and fake model output, then renders the same review contract production runs will use.

```sh
npm test
npm run fixture
```

Run the prepared fixture through CheaperInference with an isolated, default-deny OpenCode configuration:

```sh
CHEAPER_INFERENCE_API_KEY=... npm run review:local -- \
  test/fixtures/config.live.json \
  test/fixtures/workspace \
  test/fixtures/run.valid.json
```

OpenCode is pinned to `opencode-ai@1.19.3`. The model can only read, glob, grep, and load the exact skills selected from the pinned `skills/manifest.json`; the coordinator and writing skills are always selected, while specialists are selected from changed paths, package ownership, and installed dependencies. Shell, edits, network tools, LSP, tasks, subagents, and paths outside the prepared workspace are denied.

## GitHub App publication

The reusable workflow expects the `Pocket Trash PR Review` App with selected-repository installation access and only these repository permissions: metadata read, contents read, pull requests read, checks write, and issues write. Callers pass the App ID through `app-id` and its verified slug through `app-slug`. Pocket Trash's registered App is `5371542`, slug `pocket-trash-pr-review`.

Analysis and publication run in separate jobs. The model key exists only in analysis; publication receives only a repository-scoped, short-lived App token. The publisher updates one App-owned marker comment and one check run for the exact reviewed SHA, refuses stale-head writes, and publishes operational conclusions independently of review prose.

### Infisical OIDC

Pocket Trash reads credentials directly from Infisical at runtime, using its existing GitHub OIDC bootstrap identity. Do not copy the App or model key into GitHub Actions secrets. Pass `INFISICAL_GITHUB_IDENTITY_ID` (and optional `INFISICAL_DOMAIN` and `INFISICAL_OIDC_AUDIENCE`) as explicit reusable-workflow secrets, plus `infisical-project-id` as an input. The calling job must allow `id-token: write`, `actions: read`, `contents: read`, and `pull-requests: read`.

`infisical-environment` defaults to `preview`; `infisical-path` defaults to `/tools/github/pr-review-tool`. The identity must have read access to that exact path and environment. Bind its OIDC trust to the approved caller repository/base-branch contexts and reviewed reusable workflow, not contributor refs or arbitrary workflows. GitHub's reusable-workflow OIDC claim is `job_workflow_ref`; verify its pinned value during rollout.

After event authorization and trusted configuration validation, analysis requests only `CHEAPERINFERENCE_API_KEY`, mapping it to `CHEAPER_INFERENCE_API_KEY`. The current production-route gate still permits only CheaperInference; this wiring does not select a model or enable OpenRouter/failover. Publication independently requests only `PR_REVIEW_APP_PRIVATE_KEY`. Each exact-name read follows the folder's configured secret imports; neither job lists the folder or expands secret references. The identity also needs read access to the imported service paths. Tokens and values are masked; the PEM is exported with its line breaks preserved. Authentication failures stop analysis rather than silently using another route or credential.

Existing callers that explicitly pass `CHEAPER_INFERENCE_API_KEY` and `APP_PRIVATE_KEY` remain supported when no Infisical identity is supplied. In OIDC mode, credential-fetch failure never falls back to those direct secrets. The Pocket Trash consumer workflow and live OIDC verification remain adoption work gated on the owner's route decision.

## Dependency policy

Third-party GitHub Actions must be pinned to full commit SHAs, and downloaded command-line tools must use exact versions. Pull-request content is untrusted data: the reusable reviewer must never execute it, load configuration from it, or expose credentials to it.

See [SECURITY.md](SECURITY.md) for the trust boundary and vulnerability reporting process.
