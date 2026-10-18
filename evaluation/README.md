# Model evaluation

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

The runner materializes each patch and source file as plain text under numeric `review-evidence/` paths and keeps references in `pull-request.json`. This avoids OpenCode's 2,000-character per-line truncation of JSON-escaped multiline strings. Runs without `contextFormat: plain-text-v1` predate this fix: retain their costs and failures, but do not use them to rank models. Interrupted attempts consume their original slot and are not replayed. Completing a fresh comparison for affected candidates requires an explicitly approved replacement matrix beyond those consumed slots.

Mermaid also needs a DOM for labeled flowchart parsing in Node. Runs without `validatorFormat: node-dom-v1` predate that initialization and cannot support production selection because valid labeled diagrams could be misclassified as syntax failures. The validator continues to reject raw HTML and unsafe directives before parsing.

Runs without `outputFormat: final-message-v1` also predate selection of the final assistant message. The earlier parser concatenated all assistant narration into the final JSON; its parse failures cannot establish that the model's final response was invalid. New runs group final text parts by message ID and exclude reasoning and earlier narration.

Catalog availability can be verified without starting paid inference or requiring an OpenRouter key:

```sh
EVALUATION_CATALOG_ONLY=1 CHEAPER_INFERENCE_API_KEY=... \
node scripts/evaluate-models.mjs all evaluation/catalogs.json
```

The catalog checkpoint records OpenRouter's current per-model input and output prices before any OpenRouter evaluation. Unavailable exact model IDs are reported and skipped; they do not prevent other available candidates from running.
