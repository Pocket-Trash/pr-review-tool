# Phase 1 visual reliability evaluation

Campaign: owner-approved-10-visual-facts-2026-10-21. Status: stopped-at-guard. Cap: $10, including paid failures, repairs and retained reservations. 27/27 slots recorded; 185/432 requests. Accounted: $2.981266. No paid replacements.

[Results and request billing](visual-facts-results.json) · [Source assessments](visual-facts-assessments.json)

Planning estimate: $9.3600832932. Highest billed prior reliability session per exact model/fixture, times three repetitions and 1.2 contingency. Catalog prices verified unchanged before launch. Smaller candidate sets and host-owned prose are not assumed to guarantee a lower cost. Full-context reservations can stop a slot before nominal cap. All failures, repairs and retained reservations count; no replacements.

Structured completion is not source accuracy. A visual pass requires source, diagram, coverage, omissions, telemetry, billing and denied-tool assessments. Unassessed/unavailable output is never a zero-defect score. Runner coverage confirms supplied/read ranges, not comprehension. Source-call edges do not prove runtime infrastructure. Each candidate needs all nine frozen trials to pass; route approval and live activation remain separate.

<!-- prettier-ignore -->
| Session | Execution | Structured | Repaired | Source / diagram / coverage | Assessed | Visual pass |
| --- | --- | --- | --- | --- | --- | --- |
| visuals:anthropic/claude-sonnet-5.5:pr403:1 | success | yes | no | pass / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:1 | success | yes | no | pass / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:1 | success | yes | no | pass / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr403:2 | success | yes | no | pass / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:2 | success | yes | no | pass / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:2 | success | yes | no | pass / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr403:3 | success | yes | no | pass / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:3 | success | yes | no | pass / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:3 | success | yes | no | pass / pass / pass | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:1 | success | yes | no | pass / pass / pass | yes | no |
| visuals:moonshotai/kimi-k2.5:pr354:1 | error | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr376:1 | success | yes | no | pass / pass / pass | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:2 | error | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr354:2 | success | yes | no | pass / pass / pass | yes | no |
| visuals:moonshotai/kimi-k2.5:pr376:2 | success | yes | no | pass / pass / pass | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:3 | error | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr354:3 | success | yes | yes | pass / pass / pass | yes | no |
| visuals:moonshotai/kimi-k2.5:pr376:3 | success | yes | no | pass / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr403:1 | success | yes | no | pass / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr354:1 | success | yes | no | pass / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr376:1 | success | yes | no | pass / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr403:2 | error | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr354:2 | request-limited | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr376:2 | success | yes | no | pass / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr403:3 | success | yes | no | pass / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr354:3 | success | yes | no | pass / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr376:3 | success | yes | no | pass / pass / pass | yes | no |

## Candidate outcome inventory

Unstarted includes slots without a forwarded request and slots not yet recorded. Budget-limited is a locally ended active session; request-limited is separate. Unavailable includes other failed/interrupted output. Repairs do not replace paid slots. Unknown billing stops the campaign, not just one model.

<!-- prettier-ignore -->
| Model | Structured / planned | Repaired | Budget-limited | Request-limited | Unstarted | Unavailable | Unassessed structured | Visual passes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-sonnet-5.5 | 9 / 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| moonshotai/kimi-k2.5 | 6 / 9 | 1 | 0 | 0 | 0 | 3 | 0 | 0 |
| z-ai/glm-5.3 | 7 / 9 | 0 | 0 | 1 | 0 | 1 | 0 | 0 |

## Source assessments

These are implementation-agent assessments, not independent human approvals. Successful but unassessed sessions do not pass. See the separate source-free request ledger for returned billing and retained reservations.

### visuals:anthropic/claude-sonnet-5.5:pr403:1

Result: fail.

Pass for the explicitly bounded declaration/source-call view. Host-generated prose avoids invented runtime and lifecycle claims. The narrower template and excluded package internals limit usefulness; this pass does not establish full architecture coverage or runtime behavior. Implementation-agent assessment, not independent human approval.

- Source evidence: Frozen 143990e .railway/railway.ts:26-41/58-114 and jobs.ts:101-147/370-437 support the selected source-call clusters and declaration spans; no network/volume binding or cutover is asserted.
- Source evidence: Before-source is the comparison merge-base 00033f1, not current base tip bf39b9a. legacyScraperQueue is a newly named declaration, not a claim the underlying legacy Redis resource is new; changed function/variable declaration text is compared at the exact before/head ranges.
- Source evidence: Host scope is explicit: 31/64 candidate nodes, 20/64 relationships and 12/33 facts selected, plus prior/full and focused-catalog exclusions. This omits adapter/package internals and is not a complete shared-queue topology or semantic review. Five complete billed requests, five reported model calls, one invocation and no repair.

### visuals:anthropic/claude-sonnet-5.5:pr354:1

Result: fail.

Pass for selected declaration facts and constrained FK slices. This is not full schema coverage, migration equivalence, CHECK/trigger interpretation or a correctness review. Host templates trade narrative detail for verifiable claims. Implementation-agent assessment, not independent human approval.

- Source evidence: Frozen bb113ec..0c3e8fe collection.ts only modifies existing collection/product/material/alias/finish declarations; pens.ts introduces the selected Pens/configuration/refill/owned-detail declarations. The 32 generated fact statements use those classifications and exact before/head spans, not patch offsets.
- Source evidence: pens.ts:52-143/342-520/553-749 supports the domain map and two ER slices. Shared-PK subtype minima remain optional; installed-refill/part/material/finish FKs retain nullability. No arbitrary CHECK exclusivity, trigger minima, maker edge or invented composite PK is asserted.
- Source evidence: Final host counts are 3 diagrams, 33/128 candidate nodes, 54/158 relationships, 32/78 selected facts. Unselected provenance/market/compatibility and unsupported relationships remain bounded scope, not falsely missing source. Fourteen complete billed requests and reported model calls, one invocation, no repair.

### visuals:anthropic/claude-sonnet-5.5:pr376:1

Result: fail.

Pass for bounded source facts and an explicitly limited ER. Discarded architecture cannot leave stale model prose; service/UI behavior and unsupported schema relationships remain unassessed. Implementation-agent assessment, not human approval.

- Source evidence: Frozen 5728916..7fd6eeb trends.ts:16-49 modifies the generation declaration, :52-104 adds material trend, :107-150 retains the two existing product-type trend declarations. catalog-api.ts:1339-1352 adds exactly the two material wrappers. Host summaries give the correct before/head references for all six selected facts.
- Source evidence: The ER shows surrogate id for material trend and only the two supported contextual generation FKs, with no invented material-specific PK or XOR interpretation. Unsupported material-trend FKs and external targets remain host-catalog limitations rather than absent source claims.
- Source evidence: Architecture/ineligible is recorded and discarded; final overview says one diagram and coverage says retained schema-er. Counts 4/68 nodes, 2/66 relationships and 6/24 facts match that scope. Four complete billed requests/model calls, one invocation, no repair; generated snapshot omission remains visible.

### visuals:anthropic/claude-sonnet-5.5:pr403:2

Result: fail.

Pass for bounded source-call clusters and verified declaration text changes. Package/adapter internals and full runtime architecture are outside the shown slice; this is not independent human approval.

- Source evidence: Frozen 00033f1..143990e source replay exactly matches the catalogue hash, all 13 published declaration summaries and before/head citations, every rendered source-call edge, and final overview/coverage counts.
- Source evidence: Selected IaC/producer/job clusters use 30/64 candidate nodes and 20/64 relationships. No runtime Redis, volume binding, completed-job filtering or failure-lifecycle claim is published. legacyScraperQueue is explicitly a new declaration name, not a new physical resource.
- Source evidence: Five complete billed requests/model calls, one invocation, no repair. Host source inventory and full/focused-catalog exclusions remain visible.

### visuals:anthropic/claude-sonnet-5.5:pr354:2

Result: fail.

Pass for declared-source slices, not complete Pens coverage or correctness. Source replay and manual assessment are implementation-agent evidence, not independent human approval.

- Source evidence: Frozen bb113ec..0c3e8fe source replay exactly matches catalogue hash, all 31 source-fact/citation strings, rendered domain/ER edges and cardinalities, and final host counts.
- Source evidence: pens.ts introduces the selected Pens/configuration/refill/owned-detail declarations; existing collection/product/material/finish declarations are modified, not new. Nullability and shared-PK optionality remain source-derived; unsupported CHECK/trigger semantics are unassessed.
- Source evidence: Three diagrams use 31/128 candidate nodes and 52/158 relationships; unselected provenance/market/evidence scope is not called absent source. Seven complete billed requests/model calls, one invocation, no repair.

### visuals:anthropic/claude-sonnet-5.5:pr376:2

Result: fail.

Pass for explicitly limited schema facts/ER. Omitting API/service behavior from this selection is not a claim it is absent; runtime and unsupported schema semantics remain unassessed. Not human approval.

- Source evidence: Frozen 5728916..7fd6eeb replay matches the catalogue hash, all four selected declaration summaries/citations and the exact ER source-record rendering.
- Source evidence: The new material-trend declaration, modified generation and two unchanged contextual trend tables match trends.ts:16-150 and their before-source ranges. No invented composite PK, mandatory nullable dimensions or XOR prose appears.
- Source evidence: Final scope correctly reports one ER, 4/68 candidate nodes, 2/66 relationships and 4/24 facts. Missing material-trend relationship evidence and external definitions remain explicit host limitations. Five complete billed requests/model calls, one invocation, no repair.

### visuals:anthropic/claude-sonnet-5.5:pr403:3

Result: fail.

Pass for narrower source-call/declaration view, not end-to-end queue architecture. Adapter/package internals are excluded by candidate/selection limits; implementation-agent assessment, not human approval.

- Source evidence: Frozen 00033f1..143990e replay exactly matches catalogue hash, all 16 generated declaration/citation strings, source-call edges and final scope counts.
- Source evidence: Selected IaC/producer/job clusters use 29/64 candidate nodes and 19/64 relationships; policy/function declaration additions and text modifications are source facts, not runtime attachment, queue migration or conditional lifecycle assertions.
- Source evidence: Five complete billed requests/model calls, one invocation and no repair. Host evidence, generated lockfile and bounded catalogue exclusions are retained.

### visuals:anthropic/claude-sonnet-5.5:pr354:3

Result: fail.

Pass for selected source declarations and bounded FK diagrams. Full provenance/compatibility and trigger behavior are not assessed; this is not complete schema coverage or human approval.

- Source evidence: Frozen bb113ec..0c3e8fe replay matches catalogue hash, 27 verified declaration/citation strings and exact domain/ER rendering, including nullable choice and installed-refill/part FKs.
- Source evidence: The selected Pens tables are new declarations, while collectionItem/product/productMaterial/finishOption source text is modified. No pre-existing collection/slider/spinner table is labeled new or exclusive semantics invented for nullable evidence carriers.
- Source evidence: Three retained diagrams use 27/128 candidate nodes and 47/158 relationships; other catalogued scope is explicitly omitted, not absent. Nine complete billed requests/model calls, one invocation, no repair.

### visuals:anthropic/claude-sonnet-5.5:pr376:3

Result: fail.

Pass for bounded schema facts and the limited ER, not source/service/runtime completeness. Host-rendered counts and citations avoid the prior prose errors; implementation-agent evidence, not human approval.

- Source evidence: Frozen 5728916..7fd6eeb trends.ts:16-150 and catalog-api.ts:1339-1352 support the six generated declaration facts: one new table, modified generation, two unchanged contextual tables and two added wrappers.
- Source evidence: Retained ER has the known id/composite keys and two supported generation FKs. Missing material-trend FK records are disclosed in host catalogue limitations, not replaced by guessed external keys or constraints.
- Source evidence: Architecture/ineligible is recorded and discarded; final prose reports one ER, 4/68 nodes, 2/66 relationships, 6/24 facts without stale architecture claims. One invocation, no repair; complete billing and usage telemetry.

### visuals:moonshotai/kimi-k2.5:pr403:1

Result: fail.

Pass for a narrow IaC source-call slice and source declaration facts, not the complete queue architecture. Implementation-agent assessment and replay, not independent human approval.

- Source evidence: Frozen 00033f1..143990e replay matches the catalogue hash, all 32 declaration/citation strings and the exact source-call rendering.
- Source evidence: Selected IaC slice contains 7/64 nodes and 22/64 source-call records, including distinct preserve-call source lines. The 32/33 selected facts describe declaration changes, not physical resource creation or runtime behavior.
- Source evidence: Four complete billed requests/model calls, one invocation, no repair. Host coverage discloses omitted adapter/package internals and other bounded catalogue scope.

### visuals:moonshotai/kimi-k2.5:pr354:1

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr376:1

Result: fail.

Pass for the bounded schema/declaration contract, not complete source, service or runtime coverage. Unsupported material-trend relationships remain disclosed catalogue limitations. Implementation-agent evidence, not human approval.

- Source evidence: Frozen 5728916..7fd6eeb trends.ts and catalog-api.ts support six host declaration summaries and exact before/head citations: new material trend and wrappers, modified generation, unchanged contextual trend tables.
- Source evidence: The ER retains the material-trend surrogate id and two supported contextual generation FKs; it does not invent nullable mandatory edges, composite material keys or CHECK semantics.
- Source evidence: Final scope correctly reports one ER, 4/68 nodes, 2/66 relationships and 6/24 facts after dropping ineligible architecture. Four complete billed requests/model calls, one invocation, no repair.

### visuals:moonshotai/kimi-k2.5:pr403:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr354:2

Result: fail.

Pass for bounded declaration/FK slices, not full Pens coverage or runtime/migration verification. Some entity declarations also appear as generic declaration facts; these are duplicate descriptions, not additional tables. Implementation-agent assessment, not human approval.

- Source evidence: Frozen bb113ec..0c3e8fe selected declaration summaries distinguish modified existing collection/product/finish declarations from new Pens declarations and retain exact before/head citations.
- Source evidence: The domain map and two ER slices retain declared keys and nullable configuration/installed-refill/evidence carriers. Unsupported CHECK, trigger and exclusivity semantics are not asserted.
- Source evidence: Host scope reports 53/128 nodes, 67/158 relationships and 32/78 facts. Thirteen complete billed requests/model calls, one invocation, no repair; omitted records remain explicit rather than absent source claims.

### visuals:moonshotai/kimi-k2.5:pr376:2

Result: fail.

Pass for the limited schema/declaration contract, not whole-service or runtime coverage. Implementation-agent source assessment, not independent human approval.

- Source evidence: Frozen trends.ts:16-150 and catalog-api.ts:1339-1352 support six declaration facts: added material trend and wrappers, modified generation, unchanged contextual trend tables.
- Source evidence: ER surrogate/composite keys and two contextual generation FKs match supported records; missing material-trend edges remain disclosed limitations, without inferred XOR or mandatory nullable relationships.
- Source evidence: Host counts are one ER, 4/68 nodes, 2/66 relationships and 6/24 facts. Three complete billed requests/model calls, one invocation, no repair.

### visuals:moonshotai/kimi-k2.5:pr403:3

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr354:3

Result: fail.

Pass for bounded declared-source slices, not complete schema, migration or runtime correctness. This is positive paid evidence for a successful single repair, not a guarantee of repair reliability. Implementation-agent assessment, not independent human approval.

- Source evidence: Frozen bb113ec..0c3e8fe supports 32 host-rendered declaration summaries and citations, separating new Pens declarations from existing modified collection/product/finish source text.
- Source evidence: Initial invalid domain/ER selections were rejected. One same-session repair returns a supported domain map and two ER slices; host prose is regenerated from the surviving diagrams rather than retaining the failed selection's scope.
- Source evidence: Final counts match 37/128 candidate nodes, 57/158 relationships, 32/78 facts and two recorded initial validation errors. Nullable configuration/installed-part carriers remain optional; no CHECK/trigger/lifecycle claim is inferred. Twelve complete billed requests/model calls and two invocation usage reports include repair.

### visuals:moonshotai/kimi-k2.5:pr376:3

Result: fail.

Pass for the limited schema/declaration contract, not complete source/service/runtime coverage. Implementation-agent assessment, not human approval.

- Source evidence: Frozen 5728916..7fd6eeb supports the four selected change facts: added material-trend table and two wrappers, modified generation declaration, with exact source/baseline spans.
- Source evidence: The ER includes two unchanged contextual trend tables and their supported generation FKs. Material trend retains surrogate id; unsupported material edges and arbitrary CHECK semantics are not guessed.
- Source evidence: Host scope is one ER, 4/68 nodes, 2/66 relationships and 4/24 facts. Three complete billed requests/model calls, one invocation, no repair.

### visuals:z-ai/glm-5.3:pr403:1

Result: fail.

Pass only for a very small IaC source-call view and source declaration facts. It is not a complete or particularly rich queue architecture explanation; implementation-agent assessment, not human approval.

- Source evidence: Frozen 00033f1..143990e supports all 32 selected declaration status/citation strings; newly named legacyScraperQueue is not described as a new physical Redis resource.
- Source evidence: Architecture contains only six IaC source nodes and four supported redis/service/github call records. No queue attachment, deployed volume, cutover or conditional lifecycle claim is asserted.
- Source evidence: Final host scope is 6/64 nodes, 4/64 relationships and 32/33 facts, explicitly disclosing omitted adapter/job topology. Five complete billed requests/model calls, one invocation, no repair.

### visuals:z-ai/glm-5.3:pr354:1

Result: fail.

Pass for bounded declared-source/FK slices, not complete schema or migration/trigger semantics. Implementation-agent assessment, not independent human approval.

- Source evidence: Frozen bb113ec..0c3e8fe supports 32 declaration facts and exact before/head citations, distinguishing existing modified collection/product/finish declarations from added Pens entities/helpers.
- Source evidence: Retained domain map and two ER slices cover configuration and refill/compatibility source relationships. Nullable choice/installed-refill/assertion carriers remain optional, with no inferred CHECK exclusivity, successor relationship or invented primary key.
- Source evidence: Host scope accurately reports 34/128 nodes, 45/158 relationships and 32/78 facts. Ten complete billed requests/model calls, one invocation, no repair; unselected source scope remains explicit.

### visuals:z-ai/glm-5.3:pr376:1

Result: fail.

Pass for bounded source declarations and the limited ER, not whole-source or runtime completeness. Implementation-agent assessment, not human approval.

- Source evidence: Frozen 5728916..7fd6eeb supports all six declaration facts and exact baseline/head citations; two existing trend tables remain unchanged context, not newly introduced tables.
- Source evidence: Retained ER uses the material-trend surrogate id and two supported contextual generation FKs. Unsupported material relationships, CHECK semantics and runtime behavior remain explicit limitations.
- Source evidence: Ineligible architecture is dropped; final prose accurately says one ER, 4/68 nodes, 2/66 relationships, 6/24 facts and one recorded candidate diagnostic. Four complete billed requests/model calls, one invocation, no repair.

### visuals:z-ai/glm-5.3:pr403:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr354:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr376:2

Result: fail.

Pass for limited declared-source facts and ER semantics, not full source/service/runtime coverage. Implementation-agent assessment, not human approval.

- Source evidence: Frozen 5728916..7fd6eeb supports six exact source/baseline declaration summaries: added material-trend table and two wrappers, modified generation, unchanged contextual tables.
- Source evidence: The ER retains the surrogate material-trend key and two supported contextual generation FKs, without guessed nullable material edges or XOR semantics.
- Source evidence: Ineligible architecture is dropped and recorded; final counts are one ER, 4/68 nodes, 2/66 relationships and 6/24 facts with one candidate diagnostic. Four complete billed requests/model calls, one invocation, no repair.

### visuals:z-ai/glm-5.3:pr403:3

Result: fail.

Pass for a very narrow IaC source-call slice, not complete shared-queue architecture. Implementation-agent source assessment, not independent human approval.

- Source evidence: Frozen 00033f1..143990e supports 31 selected declaration/citation strings. New declaration names do not assert new physical resources; changed source text does not assert changed runtime behavior.
- Source evidence: The seven IaC source nodes and five call records are supported redis/service/github/preserve expressions, not deployed queue, networking or volume attachment relationships.
- Source evidence: Host scope accurately reports 7/64 nodes, 5/64 relationships and 31/33 facts. Four complete billed requests/model calls, one invocation, no repair; omitted package/job topology remains explicit.

### visuals:z-ai/glm-5.3:pr354:3

Result: fail.

Pass for bounded declared-source slices, not full schema/migration/runtime verification. Implementation-agent assessment, not human approval.

- Source evidence: Frozen bb113ec..0c3e8fe supports 32 declaration statuses and exact source/baseline citations, including new Pens/provenance/compatibility entities and modified existing collection/product/finish declarations.
- Source evidence: Domain map and two ER slices preserve supported configuration, nullable choice, refill and compatibility FK/key semantics. Source evidence carriers are not mislabeled exclusive and no successor uniqueness or CHECK/trigger interpretation is invented.
- Source evidence: Final scope is 38/128 nodes, 47/158 relationships and 32/78 facts. Nine complete billed requests/model calls, one invocation, no repair; remaining source/catalogue scope stays explicitly unassessed.

### visuals:z-ai/glm-5.3:pr376:3

Result: fail.

Pass for limited schema facts/ER, not complete source/service/runtime coverage. Implementation-agent assessment, not independent human approval.

- Source evidence: Frozen trends.ts:16-150 and catalog-api.ts:1339-1352 support all six declaration summaries and their before/head citations, with existing trend tables correctly retained as context.
- Source evidence: The ER retains surrogate material-trend id and two contextual generation FKs. No invented composite PK, mandatory nullable dimensions or XOR prose survives.
- Source evidence: Ineligible architecture is dropped and recorded; host counts are one ER, 4/68 nodes, 2/66 relationships and 6/24 facts. Three complete billed requests/model calls, one invocation, no repair.

## Credit reconciliation

{"checkedAt":"2026-10-21T21:55:22.263Z","beforeUsd":16.198110818000004,"afterUsd":13.216845226000004,"returnedBilledUsd":2.9812655919999993,"outstandingReservations":0,"deltaMatchesBilled":true,"initialCheck":{"checkedAt":"2026-10-21T21:54:17.411Z","afterUsd":13.234467194000004,"deltaMatchesBilled":false}}

## Frozen evidence and versions

Runner SHA: 691a2c16d60fcd6394bbbd2f71ee2413940c817b. Pipeline formats: {"runner":"phase1-facts-v3","prompt":"host-relationship-facts-v3","evidence":"frozen-evidence-v1","relationships":"visual-relationships-v1","repair":"single-pass-facts-v3","budget":"session-capability-full-context-v1"}.

- PR #403: base bf39b9ac64ebfc70a63cd878b9d09c12af087a46; head 143990e030030f5d6bd2c2b51306c0750f8c9bbf.
- PR #354: base bb113ecd82a2aab50e18941fc090a3dc21a52cfc; head 0c3e8fe0d5cd58f2841f479cdeffd901b416f4fb.
- PR #376: base 572891683ca3a377fdeaf91ed86cd368bb2712e6; head 7fd6eeb5ecec326cd2e77b940c7e2a5cb340a9f5.

All historical campaigns remain closed and unchanged. This offline report does not execute inference, select a model, authorize replacements or enable production.
