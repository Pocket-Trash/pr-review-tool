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

## Visual-only analysis (Phase 1)

Set `"task": "visuals"` in trusted configuration to generate architecture diagrams, domain maps, and ERDs without code-review findings. Omitted `task` retains the legacy review path. Visual analysis uses a dedicated coordinator prompt, excludes the general reviewer skills, and renders a **PR Visuals** summary with overview, diagrams, changed areas, coverage gaps, and run details. Its strict JSON contract has only `overview`, `diagrams`, `changedAreas`, and `coverageGaps`.

```sh
node src/fixture.mjs test/fixtures/config.visuals.json \
  test/fixtures/visuals.valid.json test/fixtures/run.valid.json
```

Local visual execution requires a prepared `pull-request.json` containing the eligible `files` evidence. Automatic execution applies the existing generated-file exclusions and size limits first. Changes without eligible architecture or schema evidence skip inference and record zero usage. Invalid or unsafe Mermaid is omitted with a visible coverage gap. The production provider gate remains unchanged: this adds no model approval, paid evaluation, or live activation. Independent GitHub comment publication and reruns are tracked separately in ENG-542.

## Dependency policy

Third-party GitHub Actions must be pinned to full commit SHAs, and downloaded command-line tools must use exact versions. Pull-request content is untrusted data: the reusable reviewer must never execute it, load configuration from it, or expose credentials to it.

See [SECURITY.md](SECURITY.md) for the trust boundary and vulnerability reporting process.
