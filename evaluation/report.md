# Provider and model evaluation

Generated from frozen SHA fixtures at 2026-10-18T06:00:03.701Z.

| Provider         | Model                        | Runs | Failures | Reconcile | Assessed | Accuracy | False claims/blockers | Gate failures (boundary/artifact/coverage/diagram/telemetry/loop) | Median latency | Tokens (in/cached/reasoning/out) | Calls/tools | Accounted cost | Status          |
| ---------------- | ---------------------------- | ---: | -------: | --------: | -------: | -------: | --------------------: | ----------------------------------------------------------------: | -------------: | -------------------------------: | ----------: | -------------: | --------------- |
| cheaperinference | deepseek-v4.1-flash          |  9/9 |        3 |         2 |      4/9 |    1.000 |                   0/0 |                                                       0/0/4/4/4/4 |         121.8s |         160418/97024/32830/13065 |        7/12 |       $0.08692 | incomplete/fail |
| cheaperinference | gemini-3.8-flash             |  9/9 |        0 |         0 |      9/9 |    1.000 |                   2/0 |                                                       0/3/3/7/0/0 |         385.3s |         3724427/49936878/0/49152 |     547/573 |       $1.94490 | incomplete/fail |
| cheaperinference | claude-sonnet-5.5            |  9/9 |        9 |         0 |      0/9 |        — |                   0/0 |                                                       0/0/0/0/0/0 |              — |           2065069/343941/0/57010 |      72/105 |       $3.05515 | incomplete/fail |
| openrouter       | deepseek/deepseek-v4.1-flash |  0/9 |        0 |         0 |      0/0 |        — |                   0/0 |                                                       0/0/0/0/0/0 |              — |                          0/—/—/0 |         —/— |       $0.00000 | blocked         |
| openrouter       | google/gemini-3.8-flash      |  0/9 |        0 |         0 |      0/0 |        — |                   0/0 |                                                       0/0/0/0/0/0 |              — |                          0/—/—/0 |         —/— |       $0.00000 | blocked         |
| openrouter       | anthropic/claude-sonnet-5.5  |  0/9 |        0 |         0 |      0/0 |        — |                   0/0 |                                                       0/0/0/0/0/0 |              — |                          0/—/—/0 |         —/— |       $0.00000 | blocked         |

## Catalog verification

- cheaperinference: deepseek-v4.1-flash=available, gemini-3.8-flash=available, claude-sonnet-5.5=available (authenticated)
- openrouter: deepseek/deepseek-v4.1-flash=available, $0.0648/$0.144 per 1M input/output, google/gemini-3.8-flash=available, $0.8250000000000001/$4.125 per 1M input/output, anthropic/claude-sonnet-5.5=available, $2/$10 per 1M input/output (public catalog)

## Adjudication

Each successful repetition must be recorded in `adjudication.json` with expected-fact accuracy, false claims, false blocking findings, tool-boundary behavior, generated-artifact omission, coverage accuracy, diagram quality, stable telemetry, full-tool-loop completion, and a pass decision. Automated keyword matches are retained only as recall signals and never determine the winner.

No candidate can be selected yet: the fixed matrix and human adjudication are incomplete or contain failures.

Production routing and cross-provider failover remain disabled pending the project owner's decision.
