# Phase 1 visual-only evaluation

No fresh visual-only inference has run. A new $7.89 cap is approved for at most 27 sessions / 432 API requests; failed charges and retained reservations count. The owner's exact provider/model/failover decision remains pending. The earlier $10 peer campaign is closed.

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

All three repetitions of every frozen fixture must complete the strict four-key visual contract, pass source/diagram/omission checks, preserve denied-tool boundaries, report stable telemetry and returned request billing, and finish within 15 minutes. No candidate is selected from historical evidence alone.

<!-- prettier-ignore -->
| Session | Result | Assessed | Visual pass |
| --- | --- | --- | --- |
| No fresh sessions | approved, not run | N/A | N/A |

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

Verified from https://openrouter.ai/api/v1/models at 2026-10-20T03:27:12.331Z; no inference was executed. Prices are USD per million tokens, not an estimate of full tool-loop cost.

<!-- prettier-ignore -->
| Exact OpenRouter model | Input / output | Context tokens |
| --- | ---: | ---: |
| anthropic/claude-sonnet-5.5 | $2 / $10 | 1000000 |
| moonshotai/kimi-k2.5 | $0.5 / $2.5 | 262144 |
| z-ai/glm-5.3 | $0.079 / $1.4 | 1048576 |

## Next approval

This campaign has a separately approved $7.89 cumulative cap and 27-session / 432-request ceilings, with no paid replacements. Returned per-request billing supplies gate cost when complete; unknown/retained request billing cannot pass. Stop before a conservative reservation cannot fit, even if the nominal balance is positive. Any further campaign or replacement needs new authorization. No production model is selected; the owner's exact provider/model/failover approval and live adoption checks remain required. The report command itself is offline and cannot execute inference.
