# Phase 1 visual reliability evaluation

Campaign: owner-approved-10-visual-facts-2026-10-21. Status: approved, not run. Cap: $10, including paid failures, repairs and retained reservations. 0/27 slots recorded; 0/432 requests. Accounted: $0.000000. No paid replacements.

[Results and request billing](visual-facts-results.json) · [Source assessments](visual-facts-assessments.json)

Planning estimate: $9.3600832932. Highest billed prior reliability session per exact model/fixture, times three repetitions and 1.2 contingency. Catalog prices verified unchanged before launch. Smaller candidate sets and host-owned prose are not assumed to guarantee a lower cost. Full-context reservations can stop a slot before nominal cap. All failures, repairs and retained reservations count; no replacements.

Structured completion is not source accuracy. A visual pass requires source, diagram, coverage, omissions, telemetry, billing and denied-tool assessments. Unassessed/unavailable output is never a zero-defect score. Runner coverage confirms supplied/read ranges, not comprehension. Source-call edges do not prove runtime infrastructure. Each candidate needs all nine frozen trials to pass; route approval and live activation remain separate.

<!-- prettier-ignore -->
| Session | Execution | Structured | Repaired | Source / diagram / coverage | Assessed | Visual pass |
| --- | --- | --- | --- | --- | --- | --- |
| No sessions | unstarted | no | no | unassessed | no | N/A |

## Candidate outcome inventory

Unstarted includes slots without a forwarded request and slots not yet recorded. Budget-limited is a locally ended active session; request-limited is separate. Unavailable includes other failed/interrupted output. Repairs do not replace paid slots. Unknown billing stops the campaign, not just one model.

<!-- prettier-ignore -->
| Model | Structured / planned | Repaired | Budget-limited | Request-limited | Unstarted | Unavailable | Unassessed structured | Visual passes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-sonnet-5.5 | 0 / 9 | 0 | 0 | 0 | 9 | 0 | 0 | N/A |
| moonshotai/kimi-k2.5 | 0 / 9 | 0 | 0 | 0 | 9 | 0 | 0 | N/A |
| z-ai/glm-5.3 | 0 / 9 | 0 | 0 | 0 | 9 | 0 | 0 | N/A |

## Source assessments

These are implementation-agent assessments, not independent human approvals. Successful but unassessed sessions do not pass. See the separate source-free request ledger for returned billing and retained reservations.

## Frozen evidence and versions

Runner SHA: not run. Pipeline formats: {"runner":"phase1-facts-v3","prompt":"host-relationship-facts-v3","evidence":"frozen-evidence-v1","relationships":"visual-relationships-v1","repair":"single-pass-facts-v3","budget":"session-capability-full-context-v1"}.

- PR #403: base bf39b9ac64ebfc70a63cd878b9d09c12af087a46; head 143990e030030f5d6bd2c2b51306c0750f8c9bbf.
- PR #354: base bb113ecd82a2aab50e18941fc090a3dc21a52cfc; head 0c3e8fe0d5cd58f2841f479cdeffd901b416f4fb.
- PR #376: base 572891683ca3a377fdeaf91ed86cd368bb2712e6; head 7fd6eeb5ecec326cd2e77b940c7e2a5cb340a9f5.

All historical campaigns remain closed and unchanged. This offline report does not execute inference, select a model, authorize replacements or enable production.
