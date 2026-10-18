# Provider and model evaluation

Generated from frozen SHA fixtures at 2026-10-18T09:46:52.897Z.

Runs without `contextFormat: plain-text-v1` used JSON-escaped multiline evidence, which OpenCode's read tool truncates at 2,000 characters per line. Their output remains in the ledger for cost and failure accounting, but is not a valid model comparison. Interrupted reservations are preserved and are never replayed automatically. A production decision requires every repetition to use readable evidence.

Runs without `validatorFormat: node-dom-v1` also predate the Node DOM initialization required by Mermaid's labeled flowchart parser. Some reported syntax failures were validator errors, so those runs cannot support a production selection. Raw-HTML and other explicit safety rejections remain enforced.

Accounted costs combine reported usage and local reservations. Interrupted calls can cost more than their reservation and have no final token telemetry; these amounts are estimates, not an authoritative provider bill. Reconcile the interrupted rows with the dedicated provider key's usage ledger before approving replacement runs.

Runs without `outputFormat: final-message-v1` used a parser that concatenated narration from earlier assistant messages with the final answer. Their structured-output errors may be runner errors rather than invalid final model responses. Successful JSON results remain available for factual adjudication, but earlier parse failures cannot establish model reliability.

| Provider         | Model                        | Runs | Corrected runner | Failures | Reconcile | Assessed | Accuracy | False claims/blockers | Gate failures (boundary/artifact/coverage/diagram/telemetry/loop) | Median latency | Tokens (in/cached/reasoning/out) | Calls/tools | Accounted cost | Status          |
| ---------------- | ---------------------------- | ---: | ---------------: | -------: | --------: | -------: | -------: | --------------------: | ----------------------------------------------------------------: | -------------: | -------------------------------: | ----------: | -------------: | --------------- |
| cheaperinference | deepseek-v4.1-flash          |  9/9 |              0/9 |        3 |         2 |      4/9 |    1.000 |                   0/0 |                                                       0/0/4/4/4/4 |         121.8s |         160418/97024/32830/13065 |        7/12 |       $0.08692 | incomplete/fail |
| cheaperinference | gemini-3.8-flash             |  9/9 |              0/9 |        0 |         0 |      9/9 |    1.000 |                   4/0 |                                                       0/3/3/9/0/0 |         385.3s |         3724427/49936878/0/49152 |     547/573 |       $1.94490 | incomplete/fail |
| cheaperinference | claude-sonnet-5.5            |  9/9 |              0/9 |        9 |         0 |      0/9 |        — |                   0/0 |                                                       0/0/0/0/0/0 |              — |           2065069/343941/0/57010 |      72/105 |       $3.05515 | incomplete/fail |
| openrouter       | deepseek/deepseek-v4.1-flash |  9/9 |              0/9 |        1 |         2 |      6/9 |    1.000 |                   3/1 |                                                       0/0/3/3/0/2 |         143.9s |      549750/2916096/150135/30552 |      73/190 |       $0.17353 | incomplete/fail |
| openrouter       | google/gemini-3.8-flash      |  9/9 |              6/9 |        1 |         1 |      7/9 |    0.952 |                   8/1 |                                                       0/0/3/3/0/0 |         600.7s |    4004147/29459218/545446/53048 |     366/485 |       $8.30572 | incomplete/fail |
| openrouter       | anthropic/claude-sonnet-5.5  |  9/9 |              9/9 |        0 |         0 |      9/9 |    1.000 |                   2/0 |                                                       0/0/1/0/0/0 |         191.5s |         222/6674295/116395/82270 |     102/291 |       $5.26566 | incomplete/fail |

## Catalog verification

- cheaperinference: deepseek-v4.1-flash=available, gemini-3.8-flash=available, claude-sonnet-5.5=available (authenticated)
- openrouter: deepseek/deepseek-v4.1-flash=available, $0.0648/$0.144 per 1M input/output, google/gemini-3.8-flash=available, $0.825/$4.125 per 1M input/output, anthropic/claude-sonnet-5.5=available, $2/$10 per 1M input/output (authenticated)

## Adjudication

Each successful repetition must be recorded in `adjudication.json` with expected-fact accuracy, false claims, false blocking findings, tool-boundary behavior, generated-artifact omission, coverage accuracy, diagram quality, stable telemetry, full-tool-loop completion, and a pass decision. Automated keyword matches are retained only as recall signals and never determine the winner.

No candidate can be selected yet: the fixed matrix and human adjudication are incomplete or contain failures.

Production routing and cross-provider failover remain disabled pending the project owner's decision.
