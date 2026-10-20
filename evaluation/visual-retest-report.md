# Phase 1 source-grounding retest

New visual-only campaign: stopped-at-guard. Approved cap $5.08; 4/9 sessions and 30/144 API requests. Accounted spend including retained reservations: $0.800700. No paid replacements. The owner's exact provider/model/failover decision remains pending.

The conservative guard stopped during Sonnet PR 354 after four billed requests, without a completed visual result. Accounted spend $0.800699695 plus the next Sonnet worst-case reservation $4.3709568 would exceed the $5.08 cap. No billing reservations remain outstanding. All three PR 403 architecture trials completed; Kimi/GLM PR 354 and all PR 376 trials were not started. This is a budget-limited attempt, not evidence of a large-schema quality failure. No replacements or restarts were performed.

Read-only credit reconciliation at 2026-10-20T19:22:32.662Z: $5.082638 before, $4.281938 after. The decrease matches $0.800700 in request charges; 0 outstanding reservations.

## Historical visual evidence

These are existing combined-review outputs, not visual-task completions. Corrected-runner outputs are inspected for current visual syntax/scope; the prior source-grounded diagram verdict is shown separately. Full-review findings, overall pass/fail and expected-fact recall do not determine the visual gate. Prior diagram passes do not assess all descriptive prose/omissions under the new task. Peer-filtered combinations are excluded because they retain the same independent visuals rather than adding independent evidence.

**Unavailable** includes failed/interrupted/missing output; **runner-ineligible** predates one or more evidence/DOM/final-message fixes. Neither is scored as zero false claims or perfect accuracy. **Unassessed** is not a pass. Historical costs remain in the original ledgers and are not quoted as visual-only costs.

<!-- prettier-ignore -->
| Candidate | Attempts | Usable historical output | Current syntax/scope pass | Prior diagram pass / fail / unassessed |
| --- | ---: | ---: | ---: | ---: |
| cheaperinference/deepseek-v4.1-flash | 9 | 0 | 0 | N/A |
| cheaperinference/gemini-3.8-flash | 9 | 0 | 0 | N/A |
| cheaperinference/claude-sonnet-5.5 | 9 | 0 | 0 | N/A |
| openrouter/deepseek/deepseek-v4.1-flash | 9 | 0 | 0 | N/A |
| openrouter/google/gemini-3.8-flash | 9 | 5 | 5 | 4 / 1 / 0 |
| openrouter/anthropic/claude-sonnet-5.5 | 9 | 9 | 9 | 9 / 0 / 0 |
| openrouter/moonshotai/kimi-k2.5 | 12 | 9 | 9 | 0 / 9 / 0 |
| openrouter/z-ai/glm-5.3 | 11 | 9 | 9 | 3 / 6 / 0 |

## Dedicated visual-task gate

Exploratory retest of the corrected generic source-grounding instructions: one repetition per model/fixture, not the three-repetition adoption gate. A visual pass still requires the strict four-key contract, source/diagram/omission checks, denied-tool boundaries, stable telemetry, returned request billing and a runtime within 15 minutes. No model is adopted from this retest.

<!-- prettier-ignore -->
| Session | Result | Assessed | Visual pass |
| --- | --- | --- | --- |
| visuals:anthropic/claude-sonnet-5.5:pr403:1 | pass | yes | yes |
| visuals:moonshotai/kimi-k2.5:pr403:1 | fail | yes | no |
| visuals:z-ai/glm-5.3:pr403:1 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:1 | failed | no | no |

## Candidate completion, quality and cost

Each candidate has three planned sessions, one per frozen fixture. Completed means structured output, not proven diagram accuracy. Passes require a source assessment. Failed calls and retained reservations count toward the cap; missing billing is not zero. No paid replacements. A single trial per fixture cannot establish reliability or satisfy the adoption gate.

<!-- prettier-ignore -->
| Model | Attempted / planned | Completed | Failed / unfinished | Source assessed | Visual passes | False visual claims | Requests | Accounted USD | Returned billed USD | Mean latency seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-sonnet-5.5 | 2 / 3 | 1 | 1 | 1 | 1 | 0 | 15 | 0.676025 | 0.676025 | 71.3 |
| moonshotai/kimi-k2.5 | 1 / 3 | 1 | 0 | 1 | 0 | 2 | 7 | 0.095291 | 0.095291 | 85.9 |
| z-ai/glm-5.3 | 1 / 3 | 1 | 0 | 1 | 0 | 1 | 8 | 0.029384 | 0.029384 | 81.7 |

This single-repetition retest cannot clear the three-repetition adoption gate. Keep model adoption disabled regardless of exploratory passes.

## Dedicated source assessment notes

These are implementation-agent adjudications against frozen source, not independent human approvals. False-claim counts group related errors; they are not an accuracy percentage or a count of all possible assertions. Incidental count/wording mistakes are distinguished from material topology/cardinality errors in the notes.

### visuals:anthropic/claude-sonnet-5.5:pr403:1

Result: pass; execution status: success.

The prior unsupported shared-volume topology is removed: the volume is an isolated declaration, production REDIS_URL is left unresolved, and legacy preview workflow bindings are distinguished from documented shared-queue intent. Code adapter/producers/processor edges are source anchored; omitted bot/runtime/unchanged-source details are disclosed. Minor overbroad overview wording ('no checked-in file binds') is immediately qualified by the explicit preview workflow binding in both prose and diagram, so it is not scored as a material topology error. This is an implementation-agent source adjudication, not independent human approval; one successful trial does not establish reliability.

- Source evidence: 143990e030030f5d6bd2c2b51306c0750f8c9bbf:.railway/railway.ts:25-63 retains scraper-queue, adds pocket-trash-queue and separately declares redis-volume without an attachment field; :103 preserves REDIS_URL.
- Source evidence: 143990e030030f5d6bd2c2b51306c0750f8c9bbf:apps/scraper/src/jobs.ts:118-129 passes env.REDIS_URL to the checkpoint connection and createScraperQueues; apps/scraper/src/queue/queues.ts:297-318 defines the two bounded adapter queues.
- Source evidence: 143990e030030f5d6bd2c2b51306c0750f8c9bbf:.github/workflows/deploy.yml:664 constructs the preview scraper-queue reference; docs/railway.md:104-134 and :274-276 reserve the later cutover for separate approval.

### visuals:moonshotai/kimi-k2.5:pr403:1

Result: fail; execution status: success.

Structured completion is not a visual pass: all diagrams were removed, including the required architecture flowchart. The output also repeats the unsupported shared-volume assertion in prose. It correctly preserves the staged cutover and preview legacy reference, but the source-grounding correction did not fix this trial. The separate policy wording error is recorded rather than treating otherwise useful prose as fully accurate. No paid replacement or repair was attempted.

- False visual claim: Claims both Redis resources use redis-volume, but the IaC declares the volume separately without either attachment binding.
- False visual claim: Summarizes queue policy as five retries and 24-hour retention; the source sets five total attempts, 24-hour completed retention and seven-day failed retention.
- Source evidence: 143990e030030f5d6bd2c2b51306c0750f8c9bbf:.railway/railway.ts:25-63 and :117 list two Redis resources plus a separately declared 5000 MB volume; no attachment field binds them.
- Source evidence: 143990e030030f5d6bd2c2b51306c0750f8c9bbf:apps/scraper/src/queue/queues.ts:17-27 sets attempts:5, completed ageSeconds:86400/count:1000 and failed ageSeconds:604800.
- Source evidence: Retained output diagrams is empty; coverageGaps records architecture removal for unsafe raw HTML and removal of ineligible schema-domain/schema-er diagrams.

### visuals:z-ai/glm-5.3:pr403:1

Result: fail; execution status: success.

The retained application architecture diagram is source-grounded, and prose correctly separates retained/staged Redis resources and unverified runtime state without inventing a volume binding. This improves the prior material topology failure. The overall trial still fails the coverage gate because it calls supplied workflow content truncated rather than unread. Minor transcription errors in the head SHA and queue name in coverage prose are noted but not counted as independent material relationship errors. Ineligible payload-domain/ER diagrams and an excess architecture diagram were removed and disclosed. No paid replacement or repair was attempted.

- False visual claim: Claims supplied deploy.yml content was truncated after line 1191; the runner supplied the complete changed head file (1771 lines, 74552 bytes). Unread or tool-output-limited content is not missing evidence.
- Source evidence: 143990e030030f5d6bd2c2b51306c0750f8c9bbf:apps/scraper/src/jobs.ts:118-129 and apps/scraper/src/queue/queues.ts:297-324 establish the Redis URL and bounded item/image adapter wiring.
- Source evidence: 143990e030030f5d6bd2c2b51306c0750f8c9bbf:packages/queue/src/bullmq.ts:33-46, :120-143 and :389-407 pass the adapter's Redis connection to Queue and Worker; packages/queue/src/index.ts:276 defines the in-memory test adapter.
- Source evidence: 143990e030030f5d6bd2c2b51306c0750f8c9bbf:.railway/railway.ts:25-63 and :103 declare retained/staged resources separately from preserved runtime URL; deploy.yml:664 and docs/railway.md:274-276 preserve the preview legacy target.
- Source evidence: Frozen .github/workflows/deploy.yml is 1771 lines / 74552 bytes, below matrix.context.limits.maxFileBytes 524288. prepareReviewContext and materializeReviewEvidence supply full head content; production metadata at lines 1575-1601 is supplied but unread, not truncated out of the evidence.

### visuals:anthropic/claude-sonnet-5.5:pr354:1

Result: failed; execution status: error.

No usable dedicated visual output; no zero-defect or accuracy score assigned.

## Frozen fixtures and source checks

### PR #403

Base: bf39b9ac64ebfc70a63cd878b9d09c12af087a46; head: 143990e030030f5d6bd2c2b51306c0750f8c9bbf.

- Show scraper producers/processor and the shared queue abstraction accurately.
- Separate staged shared Redis from the retained active scraper-queue; do not invent a production cutover or shared-volume attachment.
- State that deployment state was not inspected; source topology is not live infrastructure evidence.

### PR #354

Base: bb113ecd82a2aab50e18941fc090a3dc21a52cfc; head: 0c3e8fe0d5cd58f2841f479cdeffd901b416f4fb.

- Show a domain map and focused ER slice(s), with explicit omitted tables and relationships.
- Preserve shared-primary-key subtype optionality; a product is not simultaneously a mandatory pen, part and refill.
- Verify nullable exclusive targets/carriers, non-unique successor links and selection-mediated installed items against migration/schema constraints.

### PR #376

Base: 572891683ca3a377fdeaf91ed86cd368bb2712e6; head: 7fd6eeb5ecec326cd2e77b940c7e2a5cb340a9f5.

- Use a focused ERD for persisted Trends dimensions, not a UI screenshot or an invented architecture diagram.
- Preserve nullable headline/Unspecified/general aggregation dimensions and many-to-one references across generations/scopes.
- Distinguish exact live catalog counts from privacy-filtered persisted collection counts; do not infer a non-global material-specific primary key.

## Per-attempt inventory

<!-- prettier-ignore -->
| Attempt | Evidence status | Current syntax/scope | Prior source diagram verdict |
| --- | --- | --- | --- |
| cheaperinference:deepseek-v4.1-flash:pr403:1 | runner-ineligible | N/A | N/A |
| cheaperinference:deepseek-v4.1-flash:pr403:2 | unavailable | N/A | N/A |
| cheaperinference:deepseek-v4.1-flash:pr403:3 | unavailable | N/A | N/A |
| cheaperinference:deepseek-v4.1-flash:pr354:1 | runner-ineligible | N/A | N/A |
| cheaperinference:deepseek-v4.1-flash:pr354:2 | runner-ineligible | N/A | N/A |
| cheaperinference:deepseek-v4.1-flash:pr354:3 | runner-ineligible | N/A | N/A |
| cheaperinference:deepseek-v4.1-flash:pr376:1 | unavailable | N/A | N/A |
| cheaperinference:deepseek-v4.1-flash:pr376:2 | unavailable | N/A | N/A |
| cheaperinference:deepseek-v4.1-flash:pr376:3 | unavailable | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr403:1 | runner-ineligible | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr403:2 | runner-ineligible | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr403:3 | runner-ineligible | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr354:1 | runner-ineligible | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr354:2 | runner-ineligible | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr354:3 | runner-ineligible | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr376:1 | runner-ineligible | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr376:2 | runner-ineligible | N/A | N/A |
| cheaperinference:gemini-3.8-flash:pr376:3 | runner-ineligible | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr403:1 | unavailable | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr403:2 | unavailable | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr403:3 | unavailable | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr354:1 | unavailable | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr354:2 | unavailable | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr354:3 | unavailable | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr376:1 | unavailable | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr376:2 | unavailable | N/A | N/A |
| cheaperinference:claude-sonnet-5.5:pr376:3 | unavailable | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr403:1 | runner-ineligible | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr403:2 | runner-ineligible | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr403:3 | unavailable | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr354:1 | runner-ineligible | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr354:2 | unavailable | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr354:3 | runner-ineligible | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr376:1 | runner-ineligible | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr376:2 | runner-ineligible | N/A | N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr376:3 | unavailable | N/A | N/A |
| openrouter:google/gemini-3.8-flash:pr403:1 | runner-ineligible | N/A | N/A |
| openrouter:google/gemini-3.8-flash:pr403:2 | runner-ineligible | N/A | N/A |
| openrouter:google/gemini-3.8-flash:pr403:3 | unavailable | N/A | N/A |
| openrouter:google/gemini-3.8-flash:pr354:1 | historical-only | pass | pass |
| openrouter:google/gemini-3.8-flash:pr354:2 | unavailable | N/A | N/A |
| openrouter:google/gemini-3.8-flash:pr354:3 | historical-only | pass | fail |
| openrouter:google/gemini-3.8-flash:pr376:1 | historical-only | pass | pass |
| openrouter:google/gemini-3.8-flash:pr376:2 | historical-only | pass | pass |
| openrouter:google/gemini-3.8-flash:pr376:3 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr403:1 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr403:2 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr403:3 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr354:1 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr354:2 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr354:3 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr376:1 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr376:2 | historical-only | pass | pass |
| openrouter:anthropic/claude-sonnet-5.5:pr376:3 | historical-only | pass | pass |
| independent:moonshotai/kimi-k2.5:pr403:1 | unavailable | N/A | N/A |
| independent:z-ai/glm-5.3:pr403:1 | historical-only | pass | fail |
| independent:moonshotai/kimi-k2.5:pr403:2 | unavailable | N/A | N/A |
| independent:z-ai/glm-5.3:pr403:2 | historical-only | pass | fail |
| independent:moonshotai/kimi-k2.5:pr403:3 | unavailable | N/A | N/A |
| independent:z-ai/glm-5.3:pr403:3 | historical-only | pass | pass |
| independent:moonshotai/kimi-k2.5:pr354:1 | historical-only | pass | fail |
| independent:z-ai/glm-5.3:pr354:1 | historical-only | pass | fail |
| independent:moonshotai/kimi-k2.5:pr403:1:envelope-replacement | historical-only | pass | fail |
| independent:moonshotai/kimi-k2.5:pr403:2:envelope-replacement | historical-only | pass | fail |
| independent:moonshotai/kimi-k2.5:pr403:3:envelope-replacement | historical-only | pass | fail |
| independent:moonshotai/kimi-k2.5:pr354:2 | historical-only | pass | fail |
| independent:z-ai/glm-5.3:pr354:2 | unavailable | N/A | N/A |
| independent:moonshotai/kimi-k2.5:pr354:3 | historical-only | pass | fail |
| independent:z-ai/glm-5.3:pr354:3 | unavailable | N/A | N/A |
| independent:moonshotai/kimi-k2.5:pr376:1 | historical-only | pass | fail |
| independent:z-ai/glm-5.3:pr376:1 | historical-only | pass | pass |
| independent:z-ai/glm-5.3:pr354:2:output-limit-replacement | historical-only | pass | fail |
| independent:z-ai/glm-5.3:pr354:3:output-limit-replacement | historical-only | pass | fail |
| independent:moonshotai/kimi-k2.5:pr376:2 | historical-only | pass | fail |
| independent:z-ai/glm-5.3:pr376:2 | historical-only | pass | fail |
| independent:moonshotai/kimi-k2.5:pr376:3 | historical-only | pass | fail |
| independent:z-ai/glm-5.3:pr376:3 | historical-only | pass | pass |

## Read-only catalog snapshot

Verified from https://openrouter.ai/api/v1/models at 2026-10-20T19:15:42.678Z; no inference was executed. Prices are USD per million tokens, not an estimate of full tool-loop cost.

<!-- prettier-ignore -->
| Exact OpenRouter model | Input / output | Context tokens |
| --- | ---: | ---: |
| anthropic/claude-sonnet-5.5 | $2 / $10 | 1000000 |
| moonshotai/kimi-k2.5 | $0.5 / $2.5 | 262144 |
| z-ai/glm-5.3 | $0.079 / $1.4 | 1048576 |

## Next approval

This campaign has a separately approved $5.08 cumulative cap and 9-session / 144-request ceilings, with no paid replacements. Returned per-request billing supplies gate cost when complete; unknown/retained request billing cannot pass. Stop before a conservative reservation cannot fit, even if the nominal balance is positive. Any further campaign or replacement needs new authorization. No production model is selected; the owner's exact provider/model/failover approval and live adoption checks remain required. The report command itself is offline and cannot execute inference.
