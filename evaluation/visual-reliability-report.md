# Phase 1 visual reliability evaluation

Campaign: owner-approved-15-visual-reliability-2026-10-20. Status: stopped-at-guard. Cap: $15, including paid failures, repairs and retained reservations. 27/27 slots recorded; 341/432 requests. Accounted: $6.592914. No paid replacements.

[Results and request billing](visual-reliability-results.json) · [Source assessments](visual-reliability-assessments.json)

Planning estimate: $12.83. For each model/fixture use the highest previously billed completed session. For Kimi PR376, with no completion, use its highest other fixture. Sum three repetitions: $4.070786526. Allow a full additional pass for every slot, 50% extra context cost and 5% price cushion: $12.8229775569, rounded up. This is a planning estimate, not a completion guarantee. All paid failures, repairs and retained reservations count; stop at $15, no paid replacements.

Structured completion is not source accuracy. A visual pass requires source, diagram, coverage, omissions, telemetry, billing and denied-tool assessments. Unassessed/unavailable output is never a zero-defect score. Runner coverage confirms supplied/read ranges, not comprehension. Source-call edges do not prove runtime infrastructure. Each candidate needs all nine frozen trials to pass; route approval and live activation remain separate.

<!-- prettier-ignore -->
| Session | Execution | Structured | Repaired | Source / diagram / coverage | Assessed | Visual pass |
| --- | --- | --- | --- | --- | --- | --- |
| visuals:anthropic/claude-sonnet-5.5:pr403:1 | success | yes | no | pass / pass / pass | yes | yes |
| visuals:moonshotai/kimi-k2.5:pr403:1 | error | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr403:1 | success | yes | yes | fail / fail / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:1 | success | yes | no | pass / pass / fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr354:1 | request-limited | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr354:1 | success | yes | no | fail / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:1 | success | yes | no | pass / pass / pass | yes | yes |
| visuals:moonshotai/kimi-k2.5:pr376:1 | success | yes | no | fail / pass / fail | yes | no |
| visuals:z-ai/glm-5.3:pr376:1 | success | yes | no | fail / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr403:2 | request-limited | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr403:2 | error | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr403:2 | success | yes | yes | fail / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:2 | success | yes | no | pass / pass / fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr354:2 | error | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr354:2 | success | yes | no | fail / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:2 | success | yes | no | unknown / pass / pass | yes | no |
| visuals:moonshotai/kimi-k2.5:pr376:2 | request-limited | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr376:2 | success | yes | no | fail / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr403:3 | success | yes | no | pass / pass / pass | yes | yes |
| visuals:moonshotai/kimi-k2.5:pr403:3 | success | yes | no | fail / pass / fail | yes | no |
| visuals:z-ai/glm-5.3:pr403:3 | success | yes | no | pass / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:3 | success | yes | no | pass / pass / fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr354:3 | request-limited | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr354:3 | success | yes | no | fail / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:3 | success | yes | no | pass / pass / pass | yes | yes |
| visuals:moonshotai/kimi-k2.5:pr376:3 | success | yes | no | pass / pass / fail | yes | no |
| visuals:z-ai/glm-5.3:pr376:3 | request-limited | no | no | unassessed | no | N/A |

## Candidate outcome inventory

Unstarted includes slots without a forwarded request and slots not yet recorded. Budget-limited is a locally ended active session; request-limited is separate. Unavailable includes other failed/interrupted output. Repairs do not replace paid slots. Unknown billing stops the campaign, not just one model.

<!-- prettier-ignore -->
| Model | Structured / planned | Repaired | Budget-limited | Request-limited | Unstarted | Unavailable | Unassessed structured | Visual passes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-sonnet-5.5 | 8 / 9 | 0 | 0 | 1 | 0 | 0 | 0 | 4 |
| moonshotai/kimi-k2.5 | 3 / 9 | 0 | 0 | 3 | 0 | 3 | 0 | 0 |
| z-ai/glm-5.3 | 8 / 9 | 2 | 0 | 1 | 0 | 0 | 0 | 0 |

## Source assessments

These are implementation-agent assessments, not independent human approvals. Successful but unassessed sessions do not pass. See the separate source-free request ledger for returned billing and retained reservations.

### visuals:anthropic/claude-sonnet-5.5:pr403:1

Result: pass.

Pass for the bounded declared-source architecture slice, not runtime topology or an end-to-end call graph. It has no unsupported volume/cutover edge and accurately discloses disconnected clusters and omitted processor paths. The path-alias telemetry limitation is host-owned and does not turn supplied source into unavailable source.

- Source evidence: Frozen 143990e .railway/railway.ts:26-56 declares both Redis resources and a separate volume; :103 preserves REDIS_URL, without a resource attachment.
- Source evidence: jobs.ts:118/129, queue/queues.ts:297-320 and packages/queue/src/bullmq.ts:23-82 support the selected source-call clusters. No guessed cross-file binding, volume edge or cutover is drawn.
- Source evidence: deploy.yml:30/664/720 and docs/railway.md:104-134/274-276 support retained preview configuration versus staged/documented intent. Processor and other omitted implementation paths are explicitly disclosed.
- Source evidence: 13 metered requests and 13 reported model calls; restricted pinned runner with read-only tools. The host correctly reports full supplied files but no confirmed ranges because of the diagnosed macOS path alias. This is not proof of unread/unavailable source.

### visuals:moonshotai/kimi-k2.5:pr403:1

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr403:1

Result: fail.

Structured repair completion is not a quality pass. Node-only syntax passed the original reducer, but this is not an architecture map of supported connections. ENG-563 adds a later offline rejection; the frozen campaign result is not rewritten. Preserving the initial failure narrative also made the combined output internally inconsistent.

- False visual claim: The final overview and gaps say no diagram or source-grounded selection could be produced, while the repaired result contains selected source nodes. Initial failure prose was preserved across repair, leaving contradictory final coverage claims.
- Source evidence: The frozen relationship catalogue has 512 nodes and 716 source-call relationships, including .railway/railway.ts:26/39/51/58/103. The repaired selection chooses 32 existing nodes but no relationships.
- Source evidence: The public output has one node-only architecture flowchart, an empty changedAreas array, and an overview still stating that no diagrams are returned and content could not be read.
- Source evidence: 10 metered requests, complete usage, two validation attempts, default-deny read-only runner; no forbidden action is evidenced.

### visuals:anthropic/claude-sonnet-5.5:pr354:1

Result: fail.

The diagram/cardinality regressions improve, but the strict all-gates pass still fails on a narrower catalogue-coverage contradiction. This is not an invented FK or mandatory optional subtype; the error is confusing omitted relationships with absent entity definitions.

- False visual claim: An omission note says market-status and identifier parent nodes n57/n59 are not in the catalogue. Both entity nodes are present; their outgoing FK edges were omitted by the bounded analyzer. Other notes correctly say those entities were merely left out of the diagrams.
- Source evidence: Frozen 0c3e8fe pens.ts:955-1004 and :1031-1090 define refill_offering_market_status and refill_offering_identifier; the identical per-fixture host catalogue contains them as n57/n59 (66 entity nodes, 90 accepted FKs).
- Source evidence: Host-rendered ER slices preserve optional shared-PK subtypes, nullable carrier/target links, product_source_listing listing_id PK and composite UNIQUE versus actual PK distinctions.
- Source evidence: pens.ts:434-437/1196-1199 and migration.sql:715-772 support the disclosed CHECK/conditional-trigger limitations. The model does not claim FK-only diagrams capture all trigger semantics.
- Source evidence: 13 metered requests and 13 reported model calls; three diagrams, no repair, complete billing and read-only restricted runner.

### visuals:moonshotai/kimi-k2.5:pr354:1

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr354:1

Result: fail.

Host rendering prevents the earlier invented edges/key markers, but source/prose and omission explanations are still inaccurate. Passing diagram semantics alone does not make this a visual pass.

- False visual claim: Describes existing collection.ts finish_option and slider/spinner subtype tables as additions made by this PR. The frozen collection diff adds serial_number, composite uniqueness and terminology-alias changes, not those existing table families.
- False visual claim: A coverage explanation calls pens.ts:110 a product_detail_refill maker_id reference. That location is the pen-mechanism reference; the actual refill maker relationship uses the product (id,maker_id) composite FK at :139-143.
- Source evidence: Frozen bb113ec..0c3e8fe collection.ts diff (+33/-17): serial_number/check, product/product_material/finish_option uniqueness and terminology-alias concept/scope changes; existing slider/spinner and finish families predate the PR.
- Source evidence: pens.ts:104-112 defines product_detail_pen_mechanism and its mechanismId reference; :129-143 defines product_detail_refill and the composite product FK.
- Source evidence: Three host-rendered diagrams use accepted IDs, with optional carrier/target cardinalities and no invented PK markers; missing CHECK/SQL semantics and snapshot exclusion are disclosed.
- Source evidence: 14 metered requests, complete usage, one validation attempt, restricted read-only runner.

### visuals:anthropic/claude-sonnet-5.5:pr376:1

Result: pass.

Pass for an explicitly limited entity/PK view plus source-grounded FK prose, not a complete ER graph. The host analyzer over-conservatively drops known generation references when it encounters an unrelated partial unique index; this is tracked for offline correction. No composite material-specific PK or mandatory nullable dimension is invented.

- Source evidence: Frozen 7fd6eeb trends.ts:16-150 supports the four entity PK declarations, the new material table/flag, nullable dimensions and composite material-specific FK. scraper.ts target definitions are outside this PR's supplied evidence.
- Source evidence: trends.ts:83-102 and migration.sql:1-19 support scope uniqueness, count/parent-consistency CHECKs and the declared FKs. The diagram explicitly has no edges because the bounded catalogue accepted none; actual FK declarations are described separately, not invented as rendered cardinalities.
- Source evidence: services/db/trends/index.ts:6-10/128-288/557-610 supports threshold five, exact live catalog counts versus rounded collection aggregates and a 36-hour stale threshold.
- Source evidence: Nine metered requests and nine reported model calls, one validation attempt, no generated snapshot output or forbidden tool action.

### visuals:moonshotai/kimi-k2.5:pr376:1

Result: fail.

Structured completion is an improvement over unavailable output, but the coverage/cardinality explanation does not describe the final diagram and includes an unsupported nullability-to-inverse-multiplicity inference. No bad relationship is actually rendered.

- False visual claim: Claims external cardinalities were marked conceptual and parent-to-child cardinality assumes zero-to-many from nullable FK columns, although the final host-rendered ERD has no relationships. Nullability alone also cannot establish inverse uniqueness/multiplicity.
- Source evidence: Frozen 7fd6eeb trends.ts:58-72/98-102 declares required generation, nullable dimensions and a composite material-specific FK. Its FKs have no accepted catalogue relationship IDs in this runner version; the actual final diagram contains entity PKs only.
- Source evidence: services/db/trends/index.ts:6-10 confirms threshold/rounding five and 36-hour staleness; exact live catalog versus privacy-safe generation-backed collection counts is otherwise described correctly.
- Source evidence: Nine metered requests and nine reported model calls, one validation attempt, restricted read-only runner.

### visuals:z-ai/glm-5.3:pr376:1

Result: fail.

Host rendering prevents invented PKs/cardinalities, but filtering an ineligible diagram leaves stale prose. Coverage also confuses the analyzer's limitation with absent local source, and the CHECK explanation is inaccurate.

- False visual claim: The final overview promises two visuals including a code architecture, but the ineligible architecture was removed and only one ERD survives. Its statement about FK markers also does not match the PK-only final ERD.
- False visual claim: Attributes all missing FK edges, including generation references, to absent external scraper definitions. public_trends_generation and its id PK are supplied locally in trends.ts; the analyzer's unrelated constraint conservatism is the reason those local edges were dropped.
- False visual claim: Describes the material-specific-implies-material CHECK as exclusive nullable carriers. It is a parent-consistency implication and allows both fields to be populated.
- Source evidence: The initial validation sidecar records architecture/ineligible; the final output contains one schema-er diagram only, with four entities and PK markers, and no selected FK relationships.
- Source evidence: Frozen 7fd6eeb trends.ts:16-49 supplies public_trends_generation.id, and :58-60/110-112/132-134 references it. The partial active index at :45-47 is unrelated to that proven PK.
- Source evidence: trends.ts:94-97 encodes materialSpecificId IS NULL OR materialId IS NOT NULL, not exclusive-or.
- Source evidence: 15 metered requests and 15 reported model calls, one validation attempt, complete billing and restricted read-only runner.

### visuals:anthropic/claude-sonnet-5.5:pr403:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr403:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr403:2

Result: fail.

The second architecture repair contains real supported connections, unlike repetition one's node-only graph. It still fails source/coverage quality because the original failure narrative contradicts the repaired diagram. ENG-564 addresses this later, without rewriting the frozen result.

- False visual claim: The retained initial overview says no visuals or source-grounded selections are returned, but the repaired final result contains a source-call architecture diagram. Its current coverage claims still describe the failed initial attempt.
- Source evidence: Frozen 143990e .railway/railway.ts:26/39/51/58 and producer source-call anchors support the repaired selected edges. No resource attachment or live cutover is invented.
- Source evidence: The validation sidecar records architecture missing on attempt zero and satisfied on attempt one. The final overview and empty changedAreas were retained from attempt zero.
- Source evidence: All request billing is returned, reported usage covers both invocations, and the pinned runner remains read-only/default-deny.

### visuals:anthropic/claude-sonnet-5.5:pr354:2

Result: fail.

No new unsupported diagram edge/cardinality was found. The strict pass fails on a source-availability/direction explanation in the model's omissions prose, not on the host-rendered FK graph. The approximate 'about 40' new-table count is not treated as a material topology claim.

- False visual claim: Says refill_offering n41 has no outgoing catalogue FK and is only a target of r45. r45 is its outgoing refill_product_id FK to product_detail_refill, declared at pens.ts:557-559. The catalogue-coverage explanation reverses a known relationship and also conflates missing alias links with missing concept nodes.
- Source evidence: Frozen 0c3e8fe pens.ts:553-595 defines refill_offering; the same fixture catalogue records r45 from n41 to n28. product_detail_refill and catalog_terminology_concept are supplied entity nodes.
- Source evidence: Host-rendered shared-PK and configuration ER slices preserve actual keys, optional subtypes and nullable carriers. CHECK and conditional trigger limits are explicitly disclosed.
- Source evidence: migration.sql:774-798 enforces exactly one Pens detail when a Pens-detail trigger is invoked for a surviving collection_item; the model qualifies the scope rather than requiring every collection item to have a pen subtype.
- Source evidence: 13 metered requests/model calls, one validation attempt, complete usage and billing, restricted read-only tools.

### visuals:moonshotai/kimi-k2.5:pr354:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr354:2

Result: fail.

Diagram and coverage behavior improve, but change attribution and citation accuracy remain below the strict source gate. No invented final PK/cardinality was found.

- False visual claim: Again describes existing collection.ts finish_option and slider/spinner table families as additions in this PR, rather than distinguishing the serial-number, composite-key and terminology-alias diff.
- False visual claim: Cites pens.ts:1241-1258 for refill_compatibility_assertion targets; those are compatibility-evidence fields. The assertion targets are at :1146-1158. The selected host graph is not wrong, but the prose citation does not support its named declaration.
- Source evidence: Frozen bb113ec..0c3e8fe collection.ts diff does not add those table families; pens.ts is the new schema file.
- Source evidence: pens.ts:1146-1158 versus :1241-1258 distinguishes assertion targets from evidence carriers. The prose conflates these anchors even though the accepted edge IDs remain correctly rendered.
- Source evidence: Catalogue omissions now correctly acknowledge n57/n59 exist without accepted outgoing FKs. Snapshot exclusion and bounded diagram scope are accurately disclosed.
- Source evidence: 12 metered requests/model calls, one validation attempt, complete billing, restricted read-only tools.

### visuals:anthropic/claude-sonnet-5.5:pr376:2

Result: fail.

No definite bad rendered cardinality or false claim is counted. Source accuracy remains unknown, not a pass, because the blanket optional-parent wording is ambiguous after a list that includes required generation_id. The strict gate does not turn that ambiguity into a zero-defect score.

- Source evidence: Frozen 7fd6eeb trends.ts:58-60 makes generation_id NOT NULL; :62-72 makes the three dimensions nullable. The entity-only rendered diagram has correct declared PKs and no FK/cardinality edges.
- Source evidence: After listing all four FK targets, the prose says the columns are nullable/non-unique and those would be optional parents. It may refer only to the three earlier named dimensions, but does not clearly exclude the required generation parent.
- Source evidence: Missing catalogue edges, absent scraper target definitions, partial service/UI reads, CHECK limitations and snapshot exclusion are explicitly disclosed.
- Source evidence: 11 metered requests/model calls, one validation attempt, returned billing, restricted read-only runner.

### visuals:moonshotai/kimi-k2.5:pr376:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr376:2

Result: fail.

The same source/coverage problems recur despite valid host-rendered keys. There are also incidental wording/citation typos (including broadcloth instead of broadcloak in a migration path), not counted as extra topology defects. No invented diagram PK/cardinality was found.

- False visual claim: Promises two diagrams and describes the scope of an architecture diagram that the sanitizer removed as ineligible; only one ERD survives.
- False visual claim: Again attributes every missing FK edge to absent scraper target definitions, although generation_id references the locally supplied generation table and its proven id PK.
- False visual claim: Calls the material-specific-implies-material CHECK a scope exclusivity rule. Its implication allows both fields to be populated and is not XOR.
- Source evidence: The sidecar records architecture/ineligible, while the final output contains only the four-entity PK-only schema-er diagram.
- Source evidence: Frozen 7fd6eeb trends.ts:16-49/58-60/110-112/132-134 supplies and references the generation PK. Missing external scraper targets do not explain removal of these local references.
- Source evidence: trends.ts:94-97 encodes materialSpecificId IS NULL OR materialId IS NOT NULL, not mutual exclusion.
- Source evidence: 14 metered requests/model calls, one validation attempt, complete billing, restricted read-only tools.

### visuals:anthropic/claude-sonnet-5.5:pr403:3

Result: pass.

Pass for the bounded source-declaration/call architecture. No volume attachment or cutover is invented; disconnected cross-file clusters and omitted implementation paths are disclosed. It is not a runtime topology verification.

- Source evidence: Frozen 143990e .railway/railway.ts:26/39/51/58/103 supplies both Redis declarations, a separate volume, scraper service and preserved URL. Resource-list membership is explicitly not used as an attachment.
- Source evidence: jobs.ts:118-138, queues.ts:297-324, bullmq.ts:23-82 and autmog/grimsmo producer calls at :104/:189 support the selected source-call clusters.
- Source evidence: deploy.yml:30/664, docs/railway.md:205-215/274-276 and environment-variable/test references support the stated staged-versus-retained conflict. Cross-file connections, worker internals and runtime state are explicitly not drawn as verified facts.
- Source evidence: 13 metered requests/model calls, one validation attempt, complete billing and restricted read-only tools.

### visuals:moonshotai/kimi-k2.5:pr403:3

Result: fail.

The renderer protects the final graph, but the prose still asserts the earlier unsupported storage/network declarations. The broad verb 'provisions' is not counted as an additional independent error.

- False visual claim: Describes redisVolume as a retained attachment and says a scraper-to-Redis network attachment is declared in the networking block. Frozen IaC declares a volume and preserves REDIS_URL, but establishes neither attachment. Calling runtime verification unknown does not support those declaration claims.
- Source evidence: Frozen 143990e .railway/railway.ts:26-56 declares separate Redis resources and a volume; :58-114 defines scraper service settings and :103 preserves REDIS_URL. There is no explicit volume-to-Redis or scraper-to-Redis binding.
- Source evidence: The surviving host-rendered IaC diagram contains source-call edges only and no invented attachment. Three other architecture selections were rejected; one valid required diagram survived without repair.
- Source evidence: Eight metered requests/model calls, one validation attempt, complete billing and restricted read-only tools.

### visuals:z-ai/glm-5.3:pr403:3

Result: fail.

The source-call slice is valid and does not equate a shared redis factory expression with a verified shared runtime resource. The strict gate fails on catalogue-availability prose, not on a newly invented storage/network edge.

- False visual claim: Says the package scaffolding, including packages/queue/src/index.ts and src/test-contract.ts, contributes no catalogue nodes or edges, then elsewhere acknowledges their unselected relationships. The exact frozen catalogue includes 87 index.ts nodes and eight test-contract.ts nodes.
- Source evidence: Read-only reconstruction from the exact bf39b9a..143990e comparison and frozen Git blobs reproduces catalogue SHA256 c4191241493dd8be7cbc5894149a1d204e04b572c489010729e49d6ab4279818, with those package nodes present.
- Source evidence: The final selected IaC source-call edges are supported by .railway/railway.ts:26/39/51/58/61/92 and do not attach either Redis resource to the volume or assert a cutover.
- Source evidence: 12 metered requests/model calls, one validation attempt; two other architecture selections were rejected while the valid IaC slice survived. No extra repair was required for the satisfied required kind.

### visuals:anthropic/claude-sonnet-5.5:pr354:3

Result: fail.

The FK diagrams are sound. Strict coverage fails on a contradictory omitted-target explanation rather than a new drawn cardinality or composite-PK error.

- False visual claim: An omission note lists product_detail_refill.maker_id among unrendered FKs to absent external targets. That column participates in the accepted (id,maker_id) FK to product, and that exact FK is rendered in ER slice one. The main prose correctly describes it, making the gap contradictory.
- Source evidence: Frozen 0c3e8fe pens.ts:129-143 and collection.ts product_id_maker_unique support catalogue r29 from product_detail_refill to product, not a direct FK to an absent maker table.
- Source evidence: The final ER slice includes product ||--o| product_detail_refill labelled FK id,maker_id and correctly marks maker_id as FK, not PK.
- Source evidence: Shared-PK optionality, nullable installed carriers and configuration choices remain host-derived. Conditional trigger/CHECK limitations are explicitly disclosed.
- Source evidence: 16 metered requests/model calls completed within the session ceiling, one validation attempt, complete billing and restricted tools.

### visuals:moonshotai/kimi-k2.5:pr354:3

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr354:3

Result: fail.

This repetition no longer calls the existing finish/slider families newly added, but still conflates alias-carrier semantics and overstates why capped evidence was omitted. Diagram semantics pass separately.

- False visual claim: Overview says catalog_terminology_alias references the concept through a nullable maker carrier. The concept FK is mandatory (concept_id,canonical_namespace); maker_id is a separate optional reference.
- False visual claim: Treats all catalogue-cap omissions as beyond this PR's scope/unrelated domains. The host recorded size/count truncation, not a semantic determination that those omitted declarations were irrelevant.
- Source evidence: Frozen bb113ec..0c3e8fe collection.ts diff adds non-null concept_id and the composite concept/namespace FK, while independently making maker_id nullable.
- Source evidence: The host catalogue records only bounded omissions (652 nodes, 373 relationships), not an unrelated-domain classification. Omitted source-call records can still belong to supplied changed files.
- Source evidence: Accepted IDs render real shared-PK, configuration and compatibility relationships without invented PK/cardinality overrides.
- Source evidence: 11 metered requests/model calls, one validation attempt, complete billing and restricted read-only tools.

### visuals:anthropic/claude-sonnet-5.5:pr376:3

Result: pass.

Pass for the bounded entity/PK diagram and source-grounded FK prose. No mandatory nullable dimension or invented material-specific composite PK appears. This does not certify a complete ER graph or runtime deployment.

- Source evidence: Frozen 7fd6eeb trends.ts:52-104 distinguishes required generation_id from nullable product_type_id/material_id/material_specific_id and correctly names the composite FK and scope constraints.
- Source evidence: migration.sql:1-19 supplies the four declared FK targets; unavailable external target key details are not invented. Existing composite-PK trend tables are identified as context.
- Source evidence: The limited PK-only ERD and its lack of accepted relationship IDs are explicitly disclosed; generated snapshot and untraced UI/service details are reported separately.
- Source evidence: Nine metered requests/model calls, one validation attempt, complete billing and restricted read-only tools.

### visuals:moonshotai/kimi-k2.5:pr376:3

Result: fail.

Source/PK output is sound but the omission note inaccurately narrates inferred rendered cardinalities. The strict coverage gate therefore fails separately from diagram semantics.

- False visual claim: Says ER cardinality was inferred from nullable FK declarations, although the final host-rendered ERD has no relationships or cardinality marks. The coverage explanation does not describe the published diagram.
- Source evidence: Frozen 7fd6eeb trends.ts:58-72/98-102 supports the described required generation, optional dimensions and composite reference. The actual diagram contains only four entity PK declarations.
- Source evidence: The overview correctly distinguishes exact catalog-product counts from privacy-safe collection counts; item/collector rounding refers to the latter and is not counted as a definite catalogue-count error.
- Source evidence: Eight metered requests/model calls, one validation attempt, complete billing and restricted read-only tools.

### visuals:z-ai/glm-5.3:pr376:3

Result: failed.

No usable output; no accuracy score assigned.

## Credit reconciliation

{"checkedAt":"2026-10-20T21:35:01.315Z","beforeUsd":29.281938286000003,"afterUsd":22.689024537,"returnedBilledUsd":6.592913749000001,"outstandingReservations":0,"deltaMatchesBilled":true,"initialCheck":{"checkedAt":"2026-10-20T21:33:13.151Z","afterUsd":22.724869127000005,"deltaMatchesBilled":false},"recheckReason":"The initial balance did not yet match returned charges; a later read-only balance matches exactly. No requests or charges were replaced."}

## Frozen evidence and versions

Runner SHA: 91b7ec176237f6b3bed54cf319b962234702f67f. Pipeline formats: {"runner":"phase1-reliability-v1","prompt":"host-graph-selection-v1","evidence":"frozen-evidence-v1","relationships":"visual-relationships-v1","repair":"single-pass-v1","budget":"session-capability-full-context-v1"}.

- PR #403: base bf39b9ac64ebfc70a63cd878b9d09c12af087a46; head 143990e030030f5d6bd2c2b51306c0750f8c9bbf.
- PR #354: base bb113ecd82a2aab50e18941fc090a3dc21a52cfc; head 0c3e8fe0d5cd58f2841f479cdeffd901b416f4fb.
- PR #376: base 572891683ca3a377fdeaf91ed86cd368bb2712e6; head 7fd6eeb5ecec326cd2e77b940c7e2a5cb340a9f5.

All historical campaigns remain closed and unchanged. This offline report does not execute inference, select a model, authorize replacements or enable production.
