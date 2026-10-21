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

After event authorization and trusted configuration validation, preflight selects the provider credential: `CHEAPERINFERENCE_API_KEY` maps to `CHEAPER_INFERENCE_API_KEY`, or `OPENROUTER_API_KEY` retains its exact name. Only the selected key is fetched and passed into analysis. The current production-route gate still permits only CheaperInference; adding lookup support does not approve OpenRouter, a model, or failover. Publication independently requests only `PR_REVIEW_APP_PRIVATE_KEY`. Each exact-name read follows the folder's configured secret imports; neither job lists the folder or expands secret references. The identity also needs read access to the imported service paths. Tokens and values are masked; the PEM is exported with its line breaks preserved. Authentication failures stop analysis rather than silently using another route or credential.

Existing callers that explicitly pass `CHEAPER_INFERENCE_API_KEY` and `APP_PRIVATE_KEY` remain supported when no Infisical identity is supplied. In OIDC mode, credential-fetch failure never falls back to those direct secrets. The Pocket Trash consumer workflow and live OIDC verification remain adoption work gated on the owner's route decision.

## Visual-only analysis (Phase 1)

Set `"task": "visuals"` in trusted configuration to generate architecture diagrams, domain maps, and ERDs without code-review findings. Omitted `task` retains the legacy review path. Visual analysis uses a dedicated coordinator prompt, excludes the general reviewer skills, and renders a **PR Visuals** summary with overview, diagrams, changed areas, coverage gaps, and run details. Its strict JSON contract has only `overview`, `diagrams`, `changedAreas`, and `coverageGaps`.

```sh
node src/fixture.mjs test/fixtures/config.visuals.json \
  test/fixtures/visuals.valid.json test/fixtures/run.valid.json
```

Local visual execution requires a prepared `pull-request.json` containing the eligible `files` evidence. Automatic execution applies the existing generated-file exclusions and size limits first. Changes without eligible architecture or schema evidence skip inference and record zero usage. Invalid or unsafe optional Mermaid is omitted with a visible coverage gap; missing required diagrams fail the visual lane rather than succeeding with a warning.

Phase 1 uses a transient `visual-relationships-v1` catalogue parsed from supported frozen source declarations without executing repository code. Models select existing node/relationship and declaration-fact IDs; the host renders Mermaid, PK markers, FK cardinalities, titles, overview, change summaries and final coverage. The private `phase1-facts-v3` protocol accepts only `factIds` and `diagrams`, never free-form source claims or citations. Declaration text is compared with supplied source at GitHub's frozen comparison merge-base, not the current base-branch tip. Missing or ambiguous before-source means uncertain change status; renamed table bindings do not become new tables. Citations use parsed source coordinates and exact SHAs, not patch offsets. Phase 1 requires a valid frozen source identity before inference. Unsupported/dynamic declarations, omitted records and missing targets stay explicit; CHECK/trigger meaning, conditional lifecycle and runtime behavior remain unassessed. The public four-key visual output, Phase 2 and review contracts remain unchanged.

Each private diagram selects only `kind` and `relationshipIds`; `schema-er` can also select `entityIds` for isolated entity context. The runner derives endpoints and titles, rejects unknown/duplicate/wrong-kind IDs, and enforces 32 nodes / 64 relationships per diagram. Flowcharts require at least one supported relationship. The change-focused candidate set keeps at most 64 entity and 64 code nodes, with up to 96 FK and 64 source-call records; exclusions and the 255 KiB catalogue ceiling are explicit, while supplied source files remain readable. Added/modified declaration facts rank before unchanged context. Fewer candidates do not authorize guessed edges or relax the original repair/request/budget limits.

`runRestrictedReview({repairVisuals:true})` permits one logical repair pass for missing required visual kinds, using the same model, frozen workspace, permissions and remaining original deadline. Successful diagrams and source omissions are retained; replacements are revalidated. Phase 1 regenerates prose and coverage from the final retained diagrams and verified fact selections after repair, so discarded candidates cannot leave stale narrative. Phase 2 retains its existing bounded narrative-repair behavior. Host evidence and omissions are never replaced. All requests use the same evaluation session capability and budget. Repair stays off by default in live entrypoints pending explicit activation. `visual-validation-v1` sidecars preserve structured diagnostics; incomplete automatic runs and publisher revalidation produce failure and replace stale visual lane content without touching the review lane.

The reusable workflow defaults to Phase 1 visual analysis, from trusted `.github/pr-visuals.json` with `"task": "visuals"`. It handles non-draft opened/synchronize/ready-for-review events and the exact whitespace-normalized `!pockettrash visuals` command from write/maintain/admin collaborators. `!pockettrash review` cannot enter visual concurrency. The general review modules remain for historical evidence and the separately gated Phase 3 lane.

Publication updates one App-owned `<!-- pockettrash:pr-visuals -->` comment and **Pocket Trash PR Visuals** check. Visual artifacts, concurrency, and run-order stamps are separate from the historical review lane. Same-SHA reruns update the visual comment; stale heads or older run/attempt stamps are refused. Neutral, failed, timed-out, and cancelled analyses replace prior diagrams with an explicit current-SHA operational result. Cross-lane, malformed, or oversized artifacts produce a fixed visual failure instead of publishing their content.

The existing 1 MiB source-free artifact cap and 90-day retention are unchanged. No second per-lane budget is introduced; any future review lane must share the repository's approved monthly limit. The production provider gate also remains unchanged: this adds no model approval, paid evaluation, or live activation. Visual model approval and budget enforcement must be verified during adoption before enabling a consumer workflow.

The separately approved [visual-only campaign](evaluation/visual-report.md) is closed: $2.808252368 billed under its $7.89 cap, with no paid replacements. Its ledger is separate from historical campaigns. `npm run evaluate:visuals` refuses an existing ledger; explicit `--resume` can continue unstarted sessions after an interruption only after receipt-based billing reconciliation, never reopen a completed campaign or replay a session. The remaining credit balance is not automatic authorization for a new campaign.

The separately approved [$5.08 source-grounding retest](evaluation/visual-retest-report.md) stopped at the conservative guard: $0.800699695 billed, four attempted sessions, 30 requests, no outstanding reservations or paid replacements. All three architecture trials completed; Sonnet's large-schema trial stopped without output, and the other five slots were not started. Another Sonnet reservation ($4.3709568) could not fit the remaining cap. Credits reconciled to $4.281938286. The exploratory results do not satisfy the three-repetition model-adoption gate.

`EVALUATION_BUDGET_USD=5.08 npm run evaluate:visuals -- --retest` selected the distinct retest ledger with a one-run matrix (nine sessions / 144 requests maximum), counting all failures/reservations. It now refuses that existing closed ledger; `--resume` cannot reopen it. Generate its offline report with `node scripts/render-visual-report.mjs --retest`. Remaining credits do not authorize a restart or further campaign.

The coordinator now requests source anchors, explicit infrastructure bindings and constraint-derived ER cardinalities, and distinguishes unread from unavailable evidence. This corrects generic instructions after that campaign; its results remain evidence for the earlier prompt. Offline tests verify the instructions and contracts, not improved model accuracy. Fresh paid validation and owner route approval remain required before adoption.

Evaluation requests enforce the smaller request/campaign output ceiling and a UTF-8 byte limit on the complete forwarded request, including tools and proxy routing fields. Unsupported modalities and malformed limits fail before upstream calls. Input reservations still use the full model context at the highest configured input/cache-write rate: neither the SDK context setting nor a byte limit proves a tighter provider token bound. Request records identify that conservative fallback; no smaller input reservation is claimed or enabled.

Each evaluation credential is bound to one approved session/model and is revoked at session end. A slot becomes started only when its first request reservation is recorded before forwarding. An unaffordable first request is deferred without starting; an active slot that cannot continue ends budget-limited. Other approved, unstarted affordable slots may continue, but deferred/started slots are not automatically replayed. Unknown billing, overbounds and global request limits stop the whole campaign. These scheduler changes do not reopen a closed campaign or authorize new spending.

The separately approved [reliability campaign](evaluation/visual-reliability-spec.json) has a new **$15 all-in cap** for Sonnet 5.5, Kimi K2.5 and GLM-5.3 on the same three frozen PRs, three repetitions (27 slots, at most 432 requests including one opt-in repair pass within each slot). Its $12.83 planning estimate is not a completion guarantee: full-context reservations may defer expensive slots before the nominal cap. No paid replacements or model substitution. `EVALUATION_BUDGET_USD=15 npm run evaluate:visuals -- --reliability` selects only the fresh ledger; it checks funded credits first and cannot reopen a closed campaign. The implementation must be committed and offline-validated before this paid command is used. Generate its offline outcome report with `node scripts/render-visual-reliability-report.mjs`; source/diagram/coverage assessments remain separate from structural completion, repair, budget-limited and unstarted outcomes. No live model adoption or repair activation follows from a test pass.

That frozen v1 campaign is now [closed](evaluation/visual-reliability-report.md): 27 slots, 341 paid requests, **$6.592913749 billed**, no outstanding reservations or paid replacements. Sonnet/Kimi/GLM produced 8/3/8 structured outputs; all 19 were source-assessed and received 4/0/0 strict visual passes. Five sessions reached the 16-request ceiling; three more failed required visual validation. No candidate clears all nine trials. Source/cardinality rendering improves, but narrative/coverage errors remain. Later offline fixes must not be presented as paid evidence from this frozen runner.

The corrected v2 runner rejects the frozen v1 campaign specification. Historical reports use that specification's pinned formats; any corrected paid matrix requires a separate versioned specification and ledger. The owner approved **$18 combined** across frozen v1 and corrected v2, leaving at most **$11.407086251** for corrected calls, failures, repairs and retained reservations.

The [corrected matrix](evaluation/visual-corrected-spec.json) uses `EVALUATION_BUDGET_USD=18 npm run evaluate:visuals -- --corrected`. It verifies the frozen settled parent ledger's hash and debit before enforcing only the remaining allowance, checks funded credits, and runs Sonnet first for reservation headroom. Its $9.3600832932 estimate is $15.9529970422 combined, not a completion guarantee. Generate its separate offline report with `node scripts/render-visual-reliability-report.mjs --corrected`. Closed campaigns cannot be reopened, and results do not authorize adoption or activation.

The corrected matrix is [closed](evaluation/visual-corrected-report.md): all 27 slots attempted, 311 paid requests, **$6.490913719 billed**, **$13.083827468 combined** with v1, no outstanding reservations or paid replacements. Sonnet/Kimi/GLM produced 9/3/6 structured outputs and 2/0/2 strict visual passes. All 18 usable outputs were assessed; retained diagrams had supported relationship semantics, but free-form prose still confused new versus existing declarations, made unsupported constraint/lifecycle claims, mislocated citations or contradicted filtered diagrams and their coverage. Three sessions hit the request ceiling and six other sessions failed. Seven sessions reached the existing bounded repair path, but none yielded a successful repaired output: the narrative-refresh fix has offline regression coverage, not positive paid repair evidence. No model clears all nine trials; the route/adoption quality gate remains blocked. These are separate stochastic campaigns, not a controlled accuracy estimate or proof of overall improvement.

The owner separately approved **$10** for the [evidence-backed prose campaign](evaluation/visual-facts-spec.json). After committing and offline-validating the exact runner, `EVALUATION_BUDGET_USD=10 npm run evaluate:visuals -- --facts` runs the same 27-slot matrix within 432 requests / 16 per slot including repair. All failures and retained reservations count; no replacements or automatic model adoption. The $9.3600832932 estimate is not a completion guarantee. Generate its separate offline report with `node scripts/render-visual-reliability-report.mjs --facts`. Earlier approvals and ledgers stay closed; this is not leftover authority from the shared $18 campaign.

### Phase 2 development (not activated)

Trusted local visual configuration can opt into `"visualPhase": 2` for conditional sequence diagrams. Source interaction changes may request one `sequenceDiagram`, with source-symbol participants and file/line message anchors. The coordinator must distinguish awaited order from concurrent work and omit unverified runtime steps. Syntax safety is not semantic proof: invented participants or ordering fail the source-assessment gate even when Mermaid parses.

Sequence diagrams share the same PR Visuals comment and four-diagram cap; required architecture/domain/ER slices take priority, with omitted scope disclosed. Phase 1 remains the default, rejects sequence output, and skips inference for unrelated changes. Reusable workflows are explicitly pinned to Phase 1; preflight and publication reject Phase 2 configuration/artifacts until a separately reviewed activation after Phase 1 adoption and task-specific quality/cost approval.

Phase 2 also supports one conditional `state` / `stateDiagram-v2` for changed source-defined states, transitions and guards. It must not invent initial/terminal states, retries or concurrency guarantees. Unverified paths are coverage gaps, not established transitions. State diagrams use the same cap and source-assessment gate; tests distinguish valid Mermaid from semantically unsupported state paths. No pull-request code is executed.

Dependency maps use `dependency` / `flowchart`, scoped to changed imports and declared runtime/development/peer/optional dependencies. Automatic Phase 2 analysis reads affected manifests at the exact frozen base and head (including renamed paths) to distinguish dependency changes from metadata-only edits. Missing/oversized base manifests are disclosed rather than guessed. Base evidence is materialized as plain text; no resolver, package install, or PR code runs. Transitive edges, unresolved aliases, and live runtime relationships remain unverified unless supplied source establishes them.

Before/after views use `before-after` / `flowchart` with separate, exact-SHA base/head panels for affected architecture/schema declarations. Both sides must be available (or explicitly absent for added/removed files); renamed files read their previous path at the frozen base. Retained, added, removed, active-declared and staged paths must remain distinct, with no invented runtime handoff between revisions or live-deployment claim. Missing sides are omissions, not empty topology proof. They share the same four-diagram cap and source-quality gate and remain behind Phase 2 activation.

## Review-only analysis (Phase 3, not activated)

Explicit trusted configuration with `"task": "review"` selects `overview`, `findings`, `changedAreas`, and `coverageGaps`, with no diagram field or visual eligibility requirement. Findings retain severity, file/line evidence, impact and smallest fix. The existing coordinator and technical specialists follow the caller's exact contract; omitted `task` retains the historical combined format for legacy fixtures/evaluations.

`npm run evaluate:review:report` renders the offline [review-only evaluation](evaluation/review-report.md). Its source-regression matrix and empty dedicated assessment set are separate from the visual gate. Historical combined-task outputs remain evidence only; failed/unassessed runs cannot pass or count as zero defects. The command performs no inference and grants no model or spending approval.

The reusable dispatcher accepts `task: review` with separate `.github/pr-review.json` configuration, but both workflow entry points keep `REVIEW_CODE_ENABLED: "false"`. Disabled review requests skip before event API checks, model/App credential fetches, inference, publication or visual cancellation; the dispatcher still checks out the trusted reviewer. Enabling Phase 3 requires a reviewed activation after Phase 2 delivery, a separate review-only quality gate and the owner's route decision.

When enabled, `!pockettrash review` is authorized independently and updates only the App-owned **PR Review** comment/check. Comment markers, artifact namespaces and repository/PR/lane concurrency remain distinct. Both modern lanes bind artifacts to the expected SHA and workflow run, reject older run/attempt writes, and clear their own stale output on operational failure. No inline review comments or required-check policy changes are introduced.

Each lane gets at most 512 KiB of source-free run artifacts, keeping the two-lane combined ceiling at 1 MiB with 90-day retention. Usage is tagged by lane; missing or partial cost metadata is reported as **unknown**, not zero. The $25/month planning budget and $1/run soft target remain repository-wide: splitting the lanes does not grant two allowances or change provider spending settings. Actual combined cost, budget enforcement and live App/OIDC behavior must be verified before consumer activation.

## Dependency policy

Third-party GitHub Actions must be pinned to full commit SHAs, and downloaded command-line tools must use exact versions. Pull-request content is untrusted data: the reusable reviewer must never execute it, load configuration from it, or expose credentials to it.

See [SECURITY.md](SECURITY.md) for the trust boundary and vulnerability reporting process.
