# Model evaluation

## Phase 1 visual-only evaluation

Start with [visual-report.md](visual-report.md) for the separate architecture/domain/ERD evidence gate. `npm run evaluate:visuals:report` is offline: it inventories historical outputs, reruns current diagram syntax/scope validation and retains prior diagram-specific source assessments without importing full-review verdicts. Historical successes are not dedicated visual-task completions. Failed, runner-invalid and unassessed outputs cannot become perfect-accuracy or zero-defect claims.

`visual-fixtures.json` retains the three frozen PRs and source-check criteria. Generated snapshots are excluded before eligibility, so #376 needs a focused ERD rather than a large domain map. `visual-assessments.json` requires separate source/diagram/coverage/boundary/telemetry/loop evidence. Any future session must use the strict visual task, exact frozen SHAs, completed billing and the runtime limit before it can pass. The source assessor must check prose and topology, not just valid Mermaid or keyword recall.

The current public model catalog is recorded separately in `visual-catalog.json`; no inference or secret read was needed. Fresh inference requires a new dollar/session/request approval and a separate request-reserving ledger. The earlier $10 peer campaign is closed. No production model or failover route has been selected, and the report cannot run paid sessions.

For the separately approved OpenRouter Kimi K2.5 / GLM-5.3 independent and peer-filtered campaign, start with [peer-report.md](peer-report.md). Its raw results, peer verdicts, request billing, and source-grounded assessments are separate from this original 54-attempt matrix. See [Peer campaign](#peer-campaign) below.

The fixed matrix in `matrix.json` evaluates the three approved models three times against Pocket Trash PRs #403, #354, and #376 through each provider where the exact catalog entry exists. The script atomically persists a reservation before every paid invocation. An interrupted `in-progress` row is never replayed automatically and must be reconciled as a failed attempt, which keeps the 54-run ceiling intact.

```sh
EVALUATION_BUDGET_USD=10 \
CHEAPER_INFERENCE_API_KEY=... \
OPENROUTER_API_KEY=... \
GITHUB_TOKEN=... \
node scripts/evaluate-models.mjs all
```

The runner refuses a matrix above 54 calls, disables retry inference inside a benchmark run, stops CheaperInference at the $10 cumulative or reserved-cost boundary, and uses the same restricted OpenCode tool policy as production. The dedicated CheaperInference key must also have a provider-side hard limit of $10; the local reservation is a conservative preflight guard, while the provider limit prevents an in-flight call from crossing the cap. It records expected-fact recall signals, blocking claims for adjudication, diagram requirements, latency, input/cached-input/reasoning/output tokens when reported, model calls, tool iterations, and estimated cost. Factual accuracy, false claims, false blocking findings, tool-boundary behavior, generated-artifact omission, coverage accuracy, stable telemetry, and full-loop completion require final adjudication against the frozen SHA fixtures and runner security tests before a production route is selected.

Production routing and cross-provider failover remain disabled until the project owner records that decision.

On 2026-10-18, a read-only request to the documented CheaperInference `/v1/keys` endpoint returned HTTP 403 for the dedicated preview key. Its provider-side $10 cap therefore has not been independently verified. Do not treat the local spend estimate as proof of that cap or as an authoritative bill. Interrupted calls need provider-ledger reconciliation before any replacement matrix is approved. No account permissions or spending limits were changed. The OpenRouter key authenticated successfully; its key-information endpoint reported no configured spending limit.

## Recorded outcome

All 54 slots are consumed: 35 successful structured results, 14 errors, and five interrupted reservations retained as `in-progress` for reconciliation. No inference process remains active. Every successful result has a factual adjudication in `adjudication.json`. No candidate passes the plan's every-repetition gate.

Only OpenRouter Claude completed all nine attempts with every corrected-runner marker. Seven passed factual adjudication; two material-Trends reviews made substantive false claims about storage duplication or existing privacy-test coverage. Its nine attempts had no structured-output failure or false blocking finding, a 191.5-second median latency, and $5.26566 accounted cost. This is not authorization to adopt it despite the failed factual gate.

The historical CheaperInference half is not a valid comparison because it predates all three runner fixes. Its accounted cost is $5.08697. OpenRouter's accounted cost is $13.74491, including interrupted reservations. A read-only OpenRouter key snapshot at 2026-10-18T09:47:03Z reported $13.869464876 cumulative key usage and no spending limit. That is a key-wide provider snapshot, not a per-attempt reconciliation or proof that all usage belongs to this matrix.

Further paid attempts require an explicit replacement-matrix approval beyond the plan's 54-run ceiling and reconciliation of interrupted spend. Production provider/model and failover policy still require the project owner's decision; neither adoption nor cross-provider failover has been enabled.

The runner materializes each patch and source file as plain text under numeric `review-evidence/` paths and keeps references in `pull-request.json`. This avoids OpenCode's 2,000-character per-line truncation of JSON-escaped multiline strings. Runs without `contextFormat: plain-text-v1` predate this fix: retain their costs and failures, but do not use them to rank models. Interrupted attempts consume their original slot and are not replayed. Completing a fresh comparison for affected candidates requires an explicitly approved replacement matrix beyond those consumed slots.

Mermaid also needs a DOM for labeled flowchart parsing in Node. Runs without `validatorFormat: node-dom-v1` predate that initialization and cannot support production selection because valid labeled diagrams could be misclassified as syntax failures. The validator continues to reject raw HTML and unsafe directives before parsing.

Runs without `outputFormat: final-message-v1` also predate selection of the final assistant message. The earlier parser concatenated all assistant narration into the final JSON; its parse failures cannot establish that the model's final response was invalid. New runs group final text parts by message ID and exclude reasoning and earlier narration.

Catalog availability can be verified without starting paid inference or requiring an OpenRouter key:

```sh
EVALUATION_CATALOG_ONLY=1 CHEAPER_INFERENCE_API_KEY=... \
node scripts/evaluate-models.mjs all evaluation/catalogs.json
```

The catalog checkpoint records OpenRouter's current per-model input and output prices before any OpenRouter evaluation. Unavailable exact model IDs are reported and skipped; they do not prevent other available candidates from running.

## Peer campaign

ENG-537 extends the evaluation with `moonshotai/kimi-k2.5` and `z-ai/glm-5.3`, OpenRouter only. The owner approved **$10 additional spend** on 2026-10-18. The original matrix and ledger are not reset or replayed.

```sh
EVALUATION_BUDGET_USD=10 OPENROUTER_API_KEY=... GITHUB_TOKEN=... npm run evaluate:peers
npm run evaluate:peers:report
```

The same frozen fixtures run three times: 18 independent sessions and 18 opposite-model peer critiques. Three initial Kimi #403 attempts were rejected by prose-envelope handling and remain recorded. OpenRouter generation metadata confirmed that GLM #354 repetitions 2 and 3 hit the runner's original 16,384-native-token cap. Up to five labelled replacements recover these runner-limited slots within the same $10 (41 total sessions maximum), without replaying normal model/provider failures. The output cap is now 32,768 tokens. A Kimi #354 final JSON was recovered from the same local session without another model call. The runner accepts a single unambiguous JSON fence with introductory prose, but rejects competing objects/fences. Initial reviews cannot see peer output. Critiques assess every peer finding against source with a strict accept/reject/uncertain verdict; the normal coordinator's review-only output contract is not loaded for critiques. A deterministic merger retains peer-accepted original findings, removes exact duplicates, and records each disposition. It retains original summaries/visuals rather than paying for synthesis, labels original coverage by reviewer, and does not promote critique reasoning into review claims. Semantic duplication, overview errors, over-filtering, and unsupported peer agreement remain possible and must be assessed separately. Runner changes mean these exploratory results are not a controlled ranking of model-only first-try reliability.

`peer-results.json` persists sessions and **every underlying API request**. A loopback proxy holds the actual provider key; OpenCode receives a proxy token and uses its built-in OpenRouter provider with an overridden base URL. Requests have model/price ceilings, a 32,768-token output cap (16,384 before the recorded correction), and a preflight reservation for the full context at uncached input price plus capped output with a 1% margin. GLM's output price ceiling was raised from the catalog's initial $1/M to the owner's quoted $2.20/M after no endpoint fit the old ceiling. Known billing replaces reservations; unmetered/interrupted requests retain their reservation and stop further requests until reconciliation. This is not a provider account-wide hard cap. An exclusive lock prevents duplicate campaign runners. Paid failures are not replayed except for the five labelled runner-repair replacements; pre-generation HTTP 404 setup rejection can resume once after its recorded price-ceiling correction.

Evaluate each independent review and combined result against the frozen source using the same adjudication fields as the original campaign. Record assessments under exact session/combined IDs in `peer-adjudication.json`. For combined results, also inspect which valid findings peer filtering lost and which false claims it removed or retained. Do not treat agreement or expected-fact recall as overall accuracy. No model selection, production activation, or cross-provider failover is authorized by this experiment.
