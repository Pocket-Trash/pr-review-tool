# Phase 3 review-only evaluation

No dedicated review-only inference has run. No production route/model/failover is selected. Fresh paid evaluation requires a separate approved dollar/session/request cap; historical campaign ledgers remain closed.

## Dedicated review gate

Each candidate must complete all three frozen PRs three times with the strict four-key review-only contract and source assessment: no material false claims or false blockers, accurate coverage/generated-artifact omissions, held denied-tool boundaries, stable telemetry, full tool loop, complete request billing and at most 15 minutes. Expected-fact recall is not overall accuracy. Missing, failed and unassessed output is unavailable, never perfect or zero defects. Diagrams are excluded. Peer critique is optional and requires its own assessed evidence, not agreement-based truth.

<!-- prettier-ignore -->
| Session | Result | Assessed | Review pass |
| --- | --- | --- | --- |
| No fresh sessions | awaiting approval | N/A | N/A |

## Source-grounded regression checks

### PR #403

Base: bf39b9ac64ebfc70a63cd878b9d09c12af087a46; head: 143990e030030f5d6bd2c2b51306c0750f8c9bbf.

- Distinguish retained active scraper-queue from staged shared Redis; do not invent missing volumes, shared attachments or production cutover.
- Check queue TTL, job lifecycle and release behavior against frozen source rather than assumed runtime defaults.
- Qualify performance estimates and disclose uninspected deployment state and omitted source.

### PR #354

Base: bb113ecd82a2aab50e18941fc090a3dc21a52cfc; head: 0c3e8fe0d5cd58f2841f479cdeffd901b416f4fb.

- Account for Drizzle migrator transaction wrapping and deferred detail triggers before claiming incomplete createProduct records commit successfully.
- Verify qualified inner-join global-alias behavior, optional subtypes and exclusive target constraints rather than hypothesizing missing protections.
- Support severity, impact and fixes with source; distinguish observed integrity risks from unmeasured query-cost estimates.

### PR #376

Base: 572891683ca3a377fdeaf91ed86cd368bb2712e6; head: 7fd6eeb5ecec326cd2e77b940c7e2a5cb340a9f5.

- Respect the globally unique material-specific primary key, exact live catalog counts and privacy-filtered persisted collection counts.
- Distinguish response projections and distinct aggregation scopes from duplicate physical storage; do not invent dirty reads from rolled-back transactions.
- Inspect existing Trends tests and dedicated suppression flags before claiming missing material coverage; qualify narrower coverage improvements.

## Historical evidence only

These combined-task outputs cannot become dedicated review-only completions. False-claim counts below are prior whole-output assessments, possibly including descriptive/diagram claims; they are not relabeled as finding-only verdicts. Prior diagram quality and whole-task pass/fail do not decide the new review gate. Historical costs/latencies remain in the original reports and are not quoted as review-only measurements. Unassessed claim counts are N/A, not zero.

<!-- prettier-ignore -->
| Attempt | Evidence status | Findings | Prior whole-output false claims / blockers |
| --- | --- | ---: | --- |
| cheaperinference:deepseek-v4.1-flash:pr403:1 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:deepseek-v4.1-flash:pr403:2 | unavailable | N/A | N/A / N/A |
| cheaperinference:deepseek-v4.1-flash:pr403:3 | unavailable | N/A | N/A / N/A |
| cheaperinference:deepseek-v4.1-flash:pr354:1 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:deepseek-v4.1-flash:pr354:2 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:deepseek-v4.1-flash:pr354:3 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:deepseek-v4.1-flash:pr376:1 | unavailable | N/A | N/A / N/A |
| cheaperinference:deepseek-v4.1-flash:pr376:2 | unavailable | N/A | N/A / N/A |
| cheaperinference:deepseek-v4.1-flash:pr376:3 | unavailable | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr403:1 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr403:2 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr403:3 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr354:1 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr354:2 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr354:3 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr376:1 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr376:2 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:gemini-3.8-flash:pr376:3 | runner-ineligible | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr403:1 | unavailable | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr403:2 | unavailable | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr403:3 | unavailable | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr354:1 | unavailable | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr354:2 | unavailable | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr354:3 | unavailable | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr376:1 | unavailable | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr376:2 | unavailable | N/A | N/A / N/A |
| cheaperinference:claude-sonnet-5.5:pr376:3 | unavailable | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr403:1 | runner-ineligible | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr403:2 | runner-ineligible | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr403:3 | unavailable | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr354:1 | runner-ineligible | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr354:2 | unavailable | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr354:3 | runner-ineligible | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr376:1 | runner-ineligible | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr376:2 | runner-ineligible | N/A | N/A / N/A |
| openrouter:deepseek/deepseek-v4.1-flash:pr376:3 | unavailable | N/A | N/A / N/A |
| openrouter:google/gemini-3.8-flash:pr403:1 | runner-ineligible | N/A | N/A / N/A |
| openrouter:google/gemini-3.8-flash:pr403:2 | runner-ineligible | N/A | N/A / N/A |
| openrouter:google/gemini-3.8-flash:pr403:3 | unavailable | N/A | N/A / N/A |
| openrouter:google/gemini-3.8-flash:pr354:1 | historical-only | 6 | 2 / 0 |
| openrouter:google/gemini-3.8-flash:pr354:2 | unavailable | N/A | N/A / N/A |
| openrouter:google/gemini-3.8-flash:pr354:3 | historical-only | 5 | 2 / 0 |
| openrouter:google/gemini-3.8-flash:pr376:1 | historical-only | 2 | 1 / 0 |
| openrouter:google/gemini-3.8-flash:pr376:2 | historical-only | 2 | 0 / 0 |
| openrouter:google/gemini-3.8-flash:pr376:3 | historical-only | 4 | 1 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr403:1 | historical-only | 9 | 0 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr403:2 | historical-only | 8 | 0 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr403:3 | historical-only | 8 | 0 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr354:1 | historical-only | 7 | 0 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr354:2 | historical-only | 10 | 0 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr354:3 | historical-only | 8 | 0 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr376:1 | historical-only | 6 | 1 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr376:2 | historical-only | 6 | 1 / 0 |
| openrouter:anthropic/claude-sonnet-5.5:pr376:3 | historical-only | 3 | 0 / 0 |
| independent:moonshotai/kimi-k2.5:pr403:1 | unavailable | N/A | N/A / N/A |
| independent:z-ai/glm-5.3:pr403:1 | historical-only | 5 | 0 / 0 |
| independent:moonshotai/kimi-k2.5:pr403:2 | unavailable | N/A | N/A / N/A |
| independent:z-ai/glm-5.3:pr403:2 | historical-only | 5 | 2 / 1 |
| independent:moonshotai/kimi-k2.5:pr403:3 | unavailable | N/A | N/A / N/A |
| independent:z-ai/glm-5.3:pr403:3 | historical-only | 7 | 3 / 0 |
| independent:moonshotai/kimi-k2.5:pr354:1 | historical-only | 6 | 4 / 2 |
| independent:z-ai/glm-5.3:pr354:1 | historical-only | 6 | 2 / 0 |
| independent:moonshotai/kimi-k2.5:pr403:1:envelope-replacement | historical-only | 7 | 2 / 0 |
| independent:moonshotai/kimi-k2.5:pr403:2:envelope-replacement | historical-only | 7 | 2 / 0 |
| independent:moonshotai/kimi-k2.5:pr403:3:envelope-replacement | historical-only | 7 | 3 / 1 |
| independent:moonshotai/kimi-k2.5:pr354:2 | historical-only | 8 | 5 / 1 |
| independent:z-ai/glm-5.3:pr354:2 | unavailable | N/A | N/A / N/A |
| independent:moonshotai/kimi-k2.5:pr354:3 | historical-only | 7 | 4 / 1 |
| independent:z-ai/glm-5.3:pr354:3 | unavailable | N/A | N/A / N/A |
| independent:moonshotai/kimi-k2.5:pr376:1 | historical-only | 6 | 3 / 0 |
| independent:z-ai/glm-5.3:pr376:1 | historical-only | 3 | 2 / 0 |
| independent:z-ai/glm-5.3:pr354:2:output-limit-replacement | historical-only | 5 | 0 / 0 |
| independent:z-ai/glm-5.3:pr354:3:output-limit-replacement | historical-only | 6 | 0 / 0 |
| independent:moonshotai/kimi-k2.5:pr376:2 | historical-only | 4 | 1 / 0 |
| independent:z-ai/glm-5.3:pr376:2 | historical-only | 6 | 0 / 0 |
| independent:moonshotai/kimi-k2.5:pr376:3 | historical-only | 6 | 3 / 1 |
| independent:z-ai/glm-5.3:pr376:3 | historical-only | 4 | 1 / 0 |

## Activation gate

Keep review execution disabled. Record exact available provider/model/failover, current prices, a fresh approved cap and durable per-request reservations before paid inference. Source-adjudicate every completion and publish task-specific completion, latency and cost separately from diagrams. Owner approval and live dual-lane adoption/authorization/failure checks remain required; this offline report cannot activate or run inference.
