# Evidence-backed Phase 1 evaluation: what passed and what did not

All 27 approved sessions finished on runner `691a2c16d60fcd6394bbbd2f71ee2413940c817b`. The separate $10 campaign billed **$2.981265592** across 185 requests, including failures and repairs. No reservations remain; settled credits reconcile. No paid replacement sessions were run.

| Model      | Structured outputs | Bounded source/diagram/coverage assessments passed | Raw strict visual passes |
| ---------- | ------------------ | -------------------------------------------------- | ------------------------ |
| Sonnet 5.5 | 9/9                | 9/9                                                | 0/9                      |
| Kimi K2.5  | 6/9                | 6/9                                                | 0/9                      |
| GLM-5.3    | 7/9                | 7/9                                                | 0/9                      |

**Why zero strict passes?** Every successful output repeats a trusted generated-file omission. The existing sanitizer removes the duplicate, changing the coverage-gap count; the unchanged strict gate therefore fails its output-consistency check. This is a host presentation bug, not evidence of invented model claims. These raw results are preserved, not rescored or silently upgraded. The omission must be merged once in the runner and checked offline against these recorded outputs before considering adoption.

All 22 usable outputs were assessed against frozen source and replayed against their exact catalogue hashes, source-fact citations, rendered relationship records and final scope counts. No unsupported published source claims were found **within this deliberately narrower contract**. These implementation-agent assessments are not independent human approval. They do not prove that the bounded analyzer is universally correct.

The tradeoff is substantial: prose describes declaration-text changes, not behavior. Architecture views are bounded source-call slices; GLM often selects only a tiny IaC cluster, and focused candidates exclude queue-adapter internals. Small-schema ERs omit unsupported material-trend relationships rather than guess. CHECK rules, triggers, lifecycle behavior, runtime topology, full schema coverage and migration equivalence remain unassessed. These results are not directly comparable to earlier free-form narrative accuracy.

Kimi had three failed sessions: one large-schema and two architecture sessions. GLM had one failed architecture session and one request-limited large-schema session. Six sessions attempted repair; Kimi's third large-schema session recovered successfully. This is positive evidence for one paid repair, not proof that repair is reliable generally.

See [raw report](visual-facts-report.md), [request billing](visual-facts-results.json) and [source assessments](visual-facts-assessments.json). The campaign is closed. No new inference, provider/model/failover selection, merge, activation or production deployment is authorized by these results.
