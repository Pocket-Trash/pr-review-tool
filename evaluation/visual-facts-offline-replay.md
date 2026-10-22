# Offline omission-merge replay — not new paid trials

ENG-569 fixes the final source-omission merge in the automatic, local and evaluation callers. Each uses the same order-preserving union of coverage strings. The model protocol, source facts, diagrams, safety validator and strict gate are unchanged.

The regression `offline coverage replay removes only duplicates without rescoring the paid ledger` applies that merge to all 22 successful frozen ENG-568 outputs and runs the unchanged strict gate. It proves:

- Each output loses exactly one repeated omission, but no distinct coverage statement.
- Overview, source facts/citations and every diagram remain identical.
- All 22 resulting outputs pass the strict gate: Sonnet 9/9, Kimi 6/9, GLM 7/9 planned slots. The five failed sessions remain failed.
- The original ledger is unchanged, SHA-256 `3065125940acc6a48b876a803c9392aef6e6da809efc9e9ad4f9353091124c07`. Its raw strict results remain zero passes for all models.

An actual restricted-runner fake invocation additionally verifies distinct source omissions survive once each alongside runner-owned returned-read coverage. No API inference, paid replacement, new accuracy assessment or independent human approval occurs in this replay.

This is deterministic postprocessing evidence on the recorded model selections, not a new stochastic campaign or proof of full source/runtime/schema coverage. Sonnet is the only candidate whose nine recorded selections pass after the fix; the tiny architecture slices and bounded analyzer omissions still need owner review. Provider/model/failover route adoption and activation remain separate decisions. Nothing was merged or deployed.

See [raw paid outcome and limitations](visual-facts-outcome.md) and [raw report](visual-facts-report.md). The campaign billed $2.981265592 against its separate $10 cap; this replay spends $0.
