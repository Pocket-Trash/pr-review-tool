# Kimi K2.5 and GLM-5.3: independent and peer-filtered evaluation

OpenRouter only. Additional budget approved: **$10**, separate from the original 54-attempt campaign. Same frozen PRs #403, #354, and #376; three repetitions each. The 36 planned sessions allow five labelled runner-repair replacements (41 total): three Kimi prose-envelope cases and two provider-confirmed GLM output-cap truncations. All charges count against the same $10. No production route is enabled by this experiment.

## Quality results

**Completed** means schema-valid output, not factual correctness. **Passed** requires source-grounded findings without material false claims or false blockers, accurate coverage/omission reporting, relevant and semantically correct diagrams, stable telemetry, and a completed tool loop within the runtime limit. Unassessed metrics are N/A, not zero defects. Expected-fact recall remains in the detailed assessment JSON; it is not an overall accuracy score. Peer acceptance is not ground truth. Assessments are agent source-checks, not a blinded human adjudication or a measurement of recall across every real defect.

Three initial Kimi infrastructure attempts were rejected by prose-envelope handling and remain unassessed; their replacements use repaired extraction. One schema review was recovered from the same local session without another paid inference. OpenRouter confirmed that two GLM schema attempts ended at the runner's original 16,384-native-token cap (finish_reason: length); their replacements use 32,768 tokens. The early completed outputs and later larger-cap outputs are exploratory observations under these recorded runner changes, not a controlled model-only reliability ranking. Attempt failures and their costs remain visible below.

| Candidate               | Completed / planned | Assessed | Passed / planned | Material false claims | False blockers |
| ----------------------- | ------------------: | -------: | ---------------: | --------------------: | -------------: |
| moonshotai/kimi-k2.5    |                 9/9 |      9/9 |              0/9 |                    27 |              6 |
| z-ai/glm-5.3            |                 9/9 |      9/9 |              0/9 |                    10 |              1 |
| Combined, peer-filtered |                 5/9 |      5/5 |              0/9 |                     7 |              0 |

### Why assessed reviews failed

Claim counts above are occurrences across assessed outputs, including repeated errors, not unique defect types. Counts below are reviews failing each gate, not counts of defects. One review can fail several gates. Unavailable output is reported in completion and operational failures, never adjudicated as zero defects.

| Candidate               | Material claim/blocker error | Diagram gate | Coverage/omission gate | Tool/telemetry/loop gate |
| ----------------------- | ---------------------------: | -----------: | ---------------------: | -----------------------: |
| moonshotai/kimi-k2.5    |                            9 |            9 |                      4 |                        0 |
| z-ai/glm-5.3            |                            5 |            6 |                      2 |                        0 |
| Combined, peer-filtered |                            3 |            5 |                      2 |                        0 |

Neither independent model nor the combined pipeline satisfies the every-repetition gate: each has at least one assessed failure. These results do not select a production route. Further paid attempts beyond this recorded campaign require a new approval.

## Cost and execution

Accounted additional spend: **$3.50213 / $10** across 375 underlying API requests and 41/41 started sessions.

Returned request billing totals $3.22816; requests without a known returned charge retain $0.27397 in reservations. Retained reservations are conservative budget charges, not proof those amounts were billed.

A session is an OpenCode tool loop, not one API call. Each underlying request is reserved before transmission at the full model context's uncached price plus capped output, with a 1% margin and upstream price ceilings. Actual returned billing cost replaces the reservation when known. Interrupted/unmetered requests retain their reservation; unmetered execution stops further requests. These controls are local to this campaign, not an account-wide provider spending cap.

| Stage       | Successful | Failed | In progress | Accounted cost |
| ----------- | ---------: | -----: | ----------: | -------------: |
| independent |      18/18 |      5 |           0 |       $2.26152 |
| critique    |      14/18 |      4 |           0 |       $1.24061 |

Combined results reuse both independent passes and both critiques. Their full pipeline cost includes all four sessions; there is no extra synthesis call.

## Latency and reported token usage

Review latency is the median of successful independent sessions only. Tokens are the runner's reported counters across all attempts, not a tokenizer-independent comparison: cached/reasoning counters can overlap or differ by provider and must not be summed as a bill. Request-level provider cost is the accounting source of truth. Three fixed PRs do not establish general code-review quality.

| Model                | Median successful review | Reported input / cached / reasoning / output tokens (all attempts) | Accounted cost, all stages and attempts |
| -------------------- | -----------------------: | -----------------------------------------------------------------: | --------------------------------------: |
| moonshotai/kimi-k2.5 |                    97.7s |                                  2223636 / 2901376 / 22737 / 58292 |                                $2.04618 |
| z-ai/glm-5.3         |                   278.5s |                                 1319349 / 7801600 / 321527 / 39739 |                                $1.45595 |

## Peer filtering

Each model first reviews the source in a separate workspace/process without seeing peer output. A fresh opposite-model session then checks every original finding and returns exactly one accept/reject/uncertain verdict with evidence and reasoning. The normal coordinator output contract is omitted for critique sessions to avoid conflicting result schemas.

Only accepted original findings enter the combined finding list; no finding text or severity is rewritten. Exact duplicate objects are removed, but semantic duplicates may remain. Original overviews, changed areas, reviewer-scoped coverage gaps, and up to four validated diagrams are retained rather than synthesized. Rejected and uncertain findings remain traceable in dispositions; their reasoning is not promoted into review claims. Consequently the combined output can still contain false claims outside findings and must be adjudicated independently.

| Fixture | Repetition | Original findings | Peer accepted | Rejected | Uncertain | Combined findings | Accounted pipeline cost |
| ------- | ---------: | ----------------: | ------------: | -------: | --------: | ----------------: | ----------------------: |
| #403    |          1 |                12 |             9 |        2 |         1 |                 9 |                $0.28499 |
| #403    |          3 |                14 |             8 |        5 |         1 |                 8 |                $0.36167 |
| #354    |          1 |                12 |             7 |        5 |         0 |                 7 |                $0.50593 |
| #354    |          2 |                13 |             6 |        6 |         1 |                 6 |                $0.54342 |
| #376    |          2 |                10 |             7 |        2 |         1 |                 7 |                $0.28857 |

Per-pair pipeline cost includes both reviewers, both critics, and any recorded failed/replacement attempts for that fixture and repetition. Costs of unavailable pairs remain in the campaign and stage totals.

Combined output unavailable for: #403 repetition 2; #354 repetition 3; #376 repetition 1; #376 repetition 3. Every pair requires both independent reviews and both critiques; no partial pair is substituted or scored as zero defects. See the operational records below.

Source-grounded adjudication must separately identify false claims removed, false claims retained, and valid findings lost; rejection alone does not prove an improvement. See `peer-adjudication.json` for individual assessments and `peer-results.json` for reviews, critiques, provenance, model price snapshots, and request costs.

### Source-checked filtering outcomes

| Combined result  | False findings removed | Unsupported findings withheld | Mixed findings rejected | Valid findings lost | False findings retained |
| ---------------- | ---------------------: | ----------------------------: | ----------------------: | ------------------: | ----------------------: |
| combined:pr403:1 |                      1 |                             1 |                       1 |                   0 |                       0 |
| combined:pr403:3 |                      2 |                             2 |                       1 |                   1 |                       3 |
| combined:pr354:1 |                      4 |                             1 |                       0 |                   0 |                       1 |
| combined:pr354:2 |                      4 |                             2 |                       1 |                   1 |                       0 |
| combined:pr376:2 |                      1 |                             2 |                       0 |                   0 |                       0 |

Counts are finding-level judgments, not percentages of all real defects. A rejected mixed finding may contain a real risk already retained from the other reviewer. Consult the detailed notes before interpreting a rejection as either a success or a missed defect.

### Concrete examples

- Schema #354, repetition 1: GLM rejected Kimi's proposed missing installed-part index because the migration already creates it, and rejected the claimed cross-product choice hole because a composite foreign key already prevents it.
- Schema #354, repetition 2: GLM removed the false RLS precedent and already-configured ORM-relation findings. It also rejected an overstated recursive-validation performance finding, losing its real but unmeasured write-cost concern.
- Queue #403, repetition 3: Kimi accepted GLM's claim that Redis commands buffer forever after reconnection stops. The pinned ioredis implementation instead closes and flushes the queued commands. Agreement retained a material error.
- Filtering applies to findings, not inherited summaries or diagrams. Schema cardinality errors and unsupported topology can therefore survive even when the accepted findings are accurate. The combined review is assessed as a whole, not declared correct because the critics agreed.

## Operational failures

- independent:moonshotai/kimi-k2.5:pr403:1: error — OpenCode did not return a valid structured review
- independent:moonshotai/kimi-k2.5:pr403:2: error — OpenCode did not return a valid structured review
- independent:moonshotai/kimi-k2.5:pr403:3: error — OpenCode did not return a valid structured review
- critique:moonshotai/kimi-k2.5:pr403:2: error — OpenCode review timed out after 900000ms
- independent:z-ai/glm-5.3:pr354:2: error — OpenCode did not return a valid structured review (Unexpected token 'N', "No index d"... is not valid JSON)
- independent:z-ai/glm-5.3:pr354:3: error — OpenCode did not return a valid structured review (Unterminated string in JSON at position 5610 (line 45 column 139))
- critique:z-ai/glm-5.3:pr354:3: error — OpenCode did not return a valid structured review (Expected double-quoted property name in JSON at position 64 (line 5 column 6))
- critique:z-ai/glm-5.3:pr376:1: error — OpenCode did not return a valid structured review (Expected double-quoted property name in JSON at position 64 (line 5 column 6))
- critique:moonshotai/kimi-k2.5:pr376:3: error — OpenCode did not return a valid structured review (Unexpected token 'N', "Now I have"... is not valid JSON)

Failed critique finals are unavailable. Their parsing/timeout records establish unavailable structured output, not a factual-quality assessment or a proven model-only cause. No paid replay or silent JSON repair was used for these failures.

## Verified model price ceilings

Prices per million tokens. Initial ceilings came from the catalog; GLM's output ceiling was subsequently raised to the owner's quoted $2.20/M when the initial $1/M route became unavailable. The $10 campaign cap did not change. Historical reservations and routing rejections remain recorded. Cached input may cost less.

| Exact model          |  Input | Output |
| -------------------- | -----: | -----: |
| moonshotai/kimi-k2.5 |   $0.5 |   $2.5 |
| z-ai/glm-5.3         | $0.079 |   $2.2 |

Provider key-wide usage difference: $3.22399. This is a cross-check, not proof that concurrent key usage belongs to this campaign.
