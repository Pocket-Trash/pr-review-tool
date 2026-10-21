# Phase 1 visual reliability evaluation

Campaign: owner-approved-18-combined-visual-corrected-2026-10-20. Status: stopped-at-guard. Cap: $11.407086251, including paid failures, repairs and retained reservations. 27/27 slots recorded; 311/432 requests. Accounted: $6.490914. No paid replacements.

[Results and request billing](visual-corrected-results.json) · [Source assessments](visual-corrected-assessments.json)

Shared approval: $18 total. Frozen v1 debit: $6.592913749. Combined accounted: $13.083827. The corrected allowance is not another $18.

Planning estimate: $9.3600832932. Highest billed v1 session per model and fixture, times three repetitions, times 1.2 contingency: $9.3600832932 corrected; $15.9529970422 combined. Planning estimate only. Sonnet slots first, then Kimi, then GLM for conservative reservation headroom. All failures, repairs and retained reservations count toward $18 combined; no paid replacements.

Structured completion is not source accuracy. A visual pass requires source, diagram, coverage, omissions, telemetry, billing and denied-tool assessments. Unassessed/unavailable output is never a zero-defect score. Runner coverage confirms supplied/read ranges, not comprehension. Source-call edges do not prove runtime infrastructure. Each candidate needs all nine frozen trials to pass; route approval and live activation remain separate.

<!-- prettier-ignore -->
| Session | Execution | Structured | Repaired | Source / diagram / coverage | Assessed | Visual pass |
| --- | --- | --- | --- | --- | --- | --- |
| visuals:anthropic/claude-sonnet-5.5:pr403:1 | success | yes | no | pass / pass / pass | yes | yes |
| visuals:anthropic/claude-sonnet-5.5:pr354:1 | success | yes | no | pass / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:1 | success | yes | no | pass / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr403:2 | success | yes | no | pass / pass / pass | yes | yes |
| visuals:anthropic/claude-sonnet-5.5:pr354:2 | success | yes | no | pass / pass / fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:2 | success | yes | no | fail / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr403:3 | success | yes | no | fail / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:3 | success | yes | no | fail / pass / pass | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:3 | success | yes | no | pass / pass / fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:1 | error | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr354:1 | success | yes | no | fail / pass / fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr376:1 | success | yes | no | fail / pass / fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:2 | error | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr354:2 | error | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr376:2 | success | yes | no | fail / pass / fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:3 | error | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr354:3 | request-limited | no | no | unassessed | no | N/A |
| visuals:moonshotai/kimi-k2.5:pr376:3 | error | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr403:1 | success | yes | no | unknown / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr354:1 | request-limited | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr376:1 | success | yes | no | pass / pass / pass | yes | yes |
| visuals:z-ai/glm-5.3:pr403:2 | success | yes | no | pass / pass / pass | yes | yes |
| visuals:z-ai/glm-5.3:pr354:2 | error | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr376:2 | success | yes | no | fail / pass / fail | yes | no |
| visuals:z-ai/glm-5.3:pr403:3 | success | yes | no | fail / pass / pass | yes | no |
| visuals:z-ai/glm-5.3:pr354:3 | request-limited | no | no | unassessed | no | N/A |
| visuals:z-ai/glm-5.3:pr376:3 | success | yes | no | pass / pass / fail | yes | no |

## Candidate outcome inventory

Unstarted includes slots without a forwarded request and slots not yet recorded. Budget-limited is a locally ended active session; request-limited is separate. Unavailable includes other failed/interrupted output. Repairs do not replace paid slots. Unknown billing stops the campaign, not just one model.

<!-- prettier-ignore -->
| Model | Structured / planned | Repaired | Budget-limited | Request-limited | Unstarted | Unavailable | Unassessed structured | Visual passes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-sonnet-5.5 | 9 / 9 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| moonshotai/kimi-k2.5 | 3 / 9 | 0 | 0 | 1 | 0 | 5 | 0 | 0 |
| z-ai/glm-5.3 | 6 / 9 | 0 | 0 | 2 | 0 | 1 | 0 | 2 |

## Source assessments

These are implementation-agent assessments, not independent human approvals. Successful but unassessed sessions do not pass. See the separate source-free request ledger for returned billing and retained reservations.

### visuals:anthropic/claude-sonnet-5.5:pr403:1

Result: pass.

Pass for descriptive declared-source clusters, not an end-to-end runtime topology. No invented volume attachment or completed cutover, and omitted processor/producer internals and documented conflicts are explicit. Implementation-agent assessment, not independent human approval.

- Source evidence: Frozen 143990e .railway/railway.ts:26-56 declares both Redis resources and a standalone 5000 MB volume; :103 preserves REDIS_URL and :117 lists resources without attaching them. The diagram labels only source-call clusters, not runtime bindings.
- Source evidence: jobs.ts:118/129, queues.ts:297-320 and packages/queue/src/bullmq.ts:23-82 support the connection/adapter descriptions and selected internal calls. docs/railway.md:20/104-134/213-224/274-276 supports documented target intent versus future cutover; infrastructure-diagram.yaml:113-115/157-158/194-195 supports documented queue edges.
- Source evidence: 13 metered requests with complete billing; pinned read-only runner. Host read ranges now confirm full IaC and ADR reads and partial queue/adapter reads, while correctly keeping other supplied files distinct from no-confirmed-read. Bounded-catalog and generated lockfile omissions remain disclosed.

### visuals:anthropic/claude-sonnet-5.5:pr354:1

Result: fail.

No visual pass: source/cardinality slices are supported, but coverage prose still contradicts the retained diagram. Counted as one grouped false coverage claim. Implementation-agent assessment, not independent human approval.

- False visual claim: The second model limitation says market and source-listing tables appear only in prose, but the returned domain map explicitly contains catalog_market, catalog_source_listing, catalog_source_evidence and product_source_listing.
- Source evidence: Frozen 0c3e8fe pens.ts:52-65/68-143 supports shared-PK optional product subtypes and the refill composite FK to product, not a maker edge. Nullable assertion/choice carriers remain optional in the host-rendered ERs.
- Source evidence: collection.ts diff adds serial_number, composite unique keys and concept-scoped aliases rather than introducing its pre-existing collection tables. pens.ts:597-748 supports collection pen details and nullable installed-part selection. Output accurately separates these changes.
- Source evidence: The output's own domain map includes n49/n51/n52/n53 market/listing nodes and edges while its coverage prose says those tables appear only in prose. This is a self-contradictory coverage claim, not an invented FK.
- Source evidence: Nine requests with complete billing and nine usage model calls; one invocation, no repair. Source-read telemetry, omitted generated snapshot and bounded static-analysis limitations are retained.

### visuals:anthropic/claude-sonnet-5.5:pr376:1

Result: fail.

No visual pass: supported ER/source description, but stale partial-success coverage prose refers to a discarded architecture diagram. This is not the wholly failed narrative case fixed by ENG-564. Implementation-agent assessment, not human approval.

- False visual claim: Coverage describes what 'the architecture diagram covers', but host validation removed that ineligible diagram and the final output contains only an ER diagram.
- Source evidence: Frozen 7fd6eeb trends.ts:16-104 defines generation and the new material trend, with id as its primary key and nullable dimension columns; :107-150 defines the two existing composite-PK trend tables and generation FKs. The rendered ER correctly shows the two supported edges and no invented composite PK for material-specific.
- Source evidence: The new material-trend FKs and outside-file targets are explicitly omitted from the diagram rather than asserted as unavailable source; CHECK expressions are not claimed to be XOR. Web/service descriptions identify material drill-down changes without claiming runtime verification.
- Source evidence: Validation attempt 0 records architecture/ineligible; the final diagrams array contains only schema-er, contradicting the fifth model coverage claim. No repair was needed for the eligible ER requirement.

### visuals:anthropic/claude-sonnet-5.5:pr403:2

Result: pass.

Pass for bounded declared-source architecture; documented target intent is separated from runtime. No invented infrastructure edge or undisclosed generated-file dependence. Implementation-agent assessment, not human approval.

- Source evidence: Frozen 143990e .railway/railway.ts:25-56/103/117 and docs/railway.md:104-134/274-276 support additive resource declarations and future approved cutover, not an active binding or volume attachment.
- Source evidence: jobs.ts:118-138, queues.ts:297-324, processor.ts:319-358 and packages/queue/src/bullmq.ts:23-82 support selected internal source calls and described URL-based adapter wiring. Cross-file/runtime edges are explicitly omitted.
- Source evidence: The output discloses unread adapter/contract tests and other unassessed internals without turning supplied evidence into unavailable source. Twelve metered requests, complete billing, one invocation and no repair.

### visuals:anthropic/claude-sonnet-5.5:pr354:2

Result: fail.

No visual pass due to a grouped self-contradictory omission claim. Source relationships and nullable cardinalities are supported. Implementation-agent assessment, not human approval.

- False visual claim: The second coverage limitation groups terminology tables n29-n32 as present in the domain map or second ER, but product_alias (n30) appears in neither; a later limitation correctly says it is omitted.
- Source evidence: Frozen 0c3e8fe pens.ts:52-143/342-515/557-741 supports shared-PK details, composite configuration relationships and optional carriers. pens.ts:436 and :1198 explicitly require exactly one configuration carrier and assertion target respectively; these are not invented CHECK semantics.
- Source evidence: pens.ts:752-1335 supports market/listing/provenance/compatibility entities; migration.sql:715-1133 contains the named deferred trigger groups and :1060-1064 the append-only evidence trigger. SQL bodies are not turned into unsupported ER minima.
- Source evidence: Domain/ER node selections do not contain product_alias, contradicting the second coverage statement about n29-n32. Eleven billed requests, one invocation, no repair. Generated snapshot and unassessed migration comparisons are disclosed.

### visuals:anthropic/claude-sonnet-5.5:pr376:2

Result: fail.

No strict visual pass: source semantics and ER cardinalities are supported, but source-location claims misidentify the service methods. One grouped citation error, not a claim that the service behavior is wrong. Implementation-agent assessment, not human approval.

- False visual claim: The service summary locates getPublicCollectionMaterialTrends at approximately lines 145-200, but that method starts at line 216; that range is the catalog query. Its catalog-query range 57-136 is also mostly types and ends before the SQL body at 148-191.
- Source evidence: Frozen 7fd6eeb trends.ts:16-104/107-150 supports the id PK, nullable dimensions and two shown contextual generation FKs. Missing material-trend and outside-file target relationships are disclosed, not guessed.
- Source evidence: Frozen packages/services/src/db/trends/index.ts:128-207 contains getPublicCatalogMaterialTrends, with SQL at :148-191; getPublicCollectionMaterialTrends starts :216. The asserted approximate source ranges do not locate the described collection reader.
- Source evidence: The output correctly distinguishes exact catalog counts from rounded active-generation collection counts, and does not invent a composite PK or claim the scope implication is XOR. No repair or stale discarded diagram reference.

### visuals:anthropic/claude-sonnet-5.5:pr403:3

Result: fail.

No strict visual pass because unlabeled patch-relative citations mislocate the evidence. Diagram semantics and the migration description itself are supported; one grouped citation error. Implementation-agent assessment, not human approval.

- False visual claim: The overview and documentation summary cite docs/railway.md:61-91 as the six-stage migration and :153-155 as the retained preview queue handoff. Those are patch-relative locations, not those source lines; the frozen head sections are :104-134 and :274-276. Unlike repetition 2, these citations are not labeled patch lines.
- Source evidence: Frozen 143990e .railway/railway.ts:26-56/103/117 supports retained/new resources with no runtime or volume attachment. Selected edges are source-call declarations only; the source expression preserve at :92 is not labeled a Redis binding.
- Source evidence: queues.ts:297-340, jobs.ts:118/129 and packages/queue/src/bullmq.ts:23-82 support the queue/adapter descriptions. Documentation intent is correctly distinguished from runtime, but docs/railway.md source positions are misidentified.
- Source evidence: Frozen docs/railway.md:104-134 contains six-stage migration and :274-276 retains the preview legacy queue. No repair; complete billed session with supplied/read range reporting and declared unassessed internals.

### visuals:anthropic/claude-sonnet-5.5:pr354:3

Result: fail.

No visual pass: no invented ER relationship, but prose extends exclusive-carrier semantics to an independently nullable evidence pair. One grouped source-semantics claim. Implementation-agent assessment, not human approval.

- False visual claim: The fifth model limitation calls the provenance slice's nullable carriers/targets exclusive, citing pens.ts:827-864 alongside :1196-1199. catalog_source_evidence at :827-864 has independently nullable listing_id and market_id and no exclusivity constraint; only the assertion target at :1198 has the cited exactly-one check.
- Source evidence: Frozen 0c3e8fe pens.ts:434-437 and :1196-1199 explicitly enforce exactly-one configuration carrier and assertion target. In contrast :827-864 only checks evidence checksum/claim validity, not listing/market exclusivity.
- Source evidence: collection.ts:169-173 supports the omitted collection-owner FK; the selected host-rendered ERs retain nullable carriers and composite target/primary keys correctly. Generated HTML is described, not used as source truth; migration equivalence and trigger-derived minima are not asserted.
- Source evidence: Thirteen requests, complete returned billing, one invocation and no repair. Host source-read and bounded-catalog limitations are retained.

### visuals:anthropic/claude-sonnet-5.5:pr376:3

Result: fail.

No visual pass due to an overbroad catalogue-absence claim; source/ER relationships themselves are supported. Implementation-agent assessment, not human approval.

- False visual claim: The first model limitation says the omitted material-trend FKs have no entity nodes for their targets. public_trends_generation is one such target and is explicitly present in the catalog and the returned ER. Missing relationship evidence is not a missing target node.
- Source evidence: Frozen 7fd6eeb trends.ts:58-60 points material trend to generation; the returned ER contains public_trends_generation. External product-type/material targets are separately absent, so the limitation overgeneralizes that absence to the local generation target.
- Source evidence: trends.ts:52-104/107-150 and migration.sql:1-19 support the surrogate id, nullable dimension FKs and two displayed contextual generation relationships. No composite-PK or XOR invention; service prose distinguishes exact catalog and rounded collection aggregates.
- Source evidence: Seven billed requests, one invocation, no repair. Snapshot omission and unassessed UI/query internals are retained and no discarded architecture diagram is described as present.

### visuals:moonshotai/kimi-k2.5:pr403:1

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr354:1

Result: fail.

No visual pass: correct retained core relationships do not cure wrong change attribution or false evidence-absence claims. The new Pens diagram scope is not represented or clearly disclosed. Two grouped false claims; implementation-agent assessment, not human approval.

- False visual claim: Overview and changedAreas call pre-existing collection, product, image, finish and slider/spinner tables new additions; the frozen collection.ts diff is only +33/-17 and modifies those existing tables.
- False visual claim: Coverage says no indexes or constraint triggers are visible and FK actions are not provided, despite supplied pens.ts indexes and explicit onDelete actions and supplied migration.sql constraint triggers.
- Source evidence: Frozen bb113ec..0c3e8fe collection.ts adds serial_number, composite unique targets and concept alias edits, not new core collection/product tables. pens.ts is the new Pens module; neither retained diagram includes its new entities, without an explicit Pens-diagram exclusion.
- Source evidence: pens.ts:53-65/139-143/613-630 contains explicit FK actions and index/CHECK declarations; migration.sql:715-1133 contains supplied constraint triggers. Availability is runner-owned and those files were supplied.
- Source evidence: The retained ER's collection ownership/image edges are supported and nullable source semantics are host-rendered. An additional invalid ER was rejected without creating a missing required kind. Five billed requests, one invocation, no repair.

### visuals:moonshotai/kimi-k2.5:pr376:1

Result: fail.

No visual pass: wrong change attribution and an undisclosed omitted material-generation relationship, despite supported retained ER edges. One grouped change-attribution claim; implementation-agent assessment, not human approval.

- False visual claim: Overview calls all four trend tables new and changedAreas labels existing trend/configuration API functions added. The frozen diff adds one material-trend table and two material read wrappers, not those existing tables/functions.
- Source evidence: Frozen 5728916..7fd6eeb trends.ts adds :52-104 plus has_suppressed_material_values at :40; generation and the two product-type trend tables already exist. catalog-api.ts adds getPublicCatalogMaterialTrends and getPublicCollectionMaterialTrends, not the surrounding existing reads and configuration methods.
- Source evidence: The host-rendered ER's two generation edges and composite product-type trend PKs match trends.ts:107-150. The new material trend has an enforced generation FK at :58-60, but its omitted edge is not disclosed; coverage only discusses omitted outside-file dimension targets.
- Source evidence: Five requests with complete returned billing, one invocation and no repair. No unsafe Mermaid or invented material-specific composite PK survives.

### visuals:moonshotai/kimi-k2.5:pr403:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr354:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr376:2

Result: fail.

No visual pass: two grouped source/change claims and incomplete scope disclosure. Host-rendered relationships remain valid; implementation-agent assessment, not human approval.

- False visual claim: Overview/changedAreas call all four trends entities and surrounding existing trend API reads new, although only material trend, a generation flag and two material wrappers are added.
- False visual claim: Coverage calls the material-trend to material-specific composite FK junction-mediated, but trends.ts:98-102 declares a direct composite foreign key.
- Source evidence: Frozen 5728916..7fd6eeb trends.ts and catalog-api.ts diffs show the one new table and two new material read wrappers. Existing product-type trend tables/read methods are context, not additions.
- Source evidence: trends.ts:98-102 directly declares (material_id,material_specific_id) to material_specific(material_id,id), with no junction table. Its outside-file target definition is omitted, but the FK declaration is supplied.
- Source evidence: The retained ER's two generation edges and keys match :107-150. The new material trend's missing generation edge (:58-60) is not disclosed. Six requests, complete billing, one invocation and no repair.

### visuals:moonshotai/kimi-k2.5:pr403:3

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr354:3

Result: failed.

No usable output; no accuracy score assigned.

### visuals:moonshotai/kimi-k2.5:pr376:3

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr403:1

Result: fail.

Not a strict visual pass: source accuracy remains unknown because completed-job filtering wording is ambiguous. No definite false claim counted for that ambiguity. Retained diagram/coverage are supported; implementation-agent assessment, not human approval.

- Source evidence: Frozen 143990e .railway/railway.ts:26-56/58-114/117 supports the selected source-call declarations, not a volume/network attachment. The output correctly separates declared staging from runtime cutover.
- Source evidence: autmog/producer.ts:92-107 and grimsmo/producer.ts:166-191 enqueue through the contract. bullmq.ts:203-216 rejects an existing non-completed job and removes/replaces a completed job when replaceCompleted is true. The phrase 'filter already-completed jobs' is ambiguous between that delegated handling and incorrectly skipping completed jobs.
- Source evidence: index.ts:276 onwards defines the in-memory adapter; queues.ts:17-27/30-268/297-380 supports policy, new payload schemas and adapter helpers. Supplied-source reads and bounded catalogue omissions are retained. Sixteen billed requests; one unsupported extra diagram rejected while a supported IaC slice survives, no repair.

### visuals:z-ai/glm-5.3:pr354:1

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr376:1

Result: pass.

Pass for a bounded source-grounded ER slice with clearly disclosed omitted relationships, not a complete schema or runtime verification. 'Keyed by generation' is qualified by the explicit id PK and generation FK description. Implementation-agent assessment, not human approval.

- Source evidence: Frozen 7fd6eeb trends.ts:52-104 supports new material-trend id PK, required generation FK, nullable dimension FKs and composite specific-parent FK. :107-150 supports existing product-type trend composite keys and the two rendered generation edges.
- Source evidence: catalog-api.ts:1339-1352 contains exactly the two new GET wrappers and cited service calls. Migration path broadcloak and :1-19 match the new table/constraints. No XOR, composite-PK or all-four-tables-new claim is made.
- Source evidence: Coverage explicitly distinguishes present-but-unlinked material-trend/generation entities from absent external target definitions. An ineligible architecture candidate is removed without stale narrative claiming it remains. Eleven requests with complete billing, one invocation, no repair; snapshot and unassessed UI are disclosed.

### visuals:z-ai/glm-5.3:pr403:2

Result: pass.

Pass for bounded source-call architecture, not runtime topology or migration activation. No invented attachment, missing-node claim or stale output-count prose. Implementation-agent assessment, not human approval.

- Source evidence: Frozen 143990e .railway/railway.ts:26-56/61-64/103/117 supports additive Redis declaration, retained volume and preserved service environment. No resource-list attachment or completed cutover is asserted.
- Source evidence: jobs.ts:117-139, queues.ts:297-338, processor.ts:319-358 and bullmq.ts:23-82 support dedicated checkpoint versus adapter-owned queue connections and the selected file-local source calls. index.ts:276-303 supports in-memory adapter/closure.
- Source evidence: Output scopes its 32-node diagram and explicitly omits producer/worker/redrive internals and unreconciled docs. Host inventory and bounded-catalog omissions remain present. Eleven complete billed requests, one invocation, no repair or discarded diagram.

### visuals:z-ai/glm-5.3:pr354:2

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr376:2

Result: fail.

No visual pass: change-attribution and stale partial-success coverage prose remain wrong, although retained ER semantics are supported. Two grouped false claims; implementation-agent assessment, not human approval.

- False visual claim: Overview and server-functions summary label the surrounding existing Trends/configuration handlers added, although catalog-api.ts adds only the two material read wrappers.
- False visual claim: Coverage says schema, service and server-function surfaces are visualized, but the final output contains only schema-er after the architecture candidate was removed.
- Source evidence: Frozen 5728916..7fd6eeb catalog-api.ts diff adds only getPublicCatalogMaterialTrends and getPublicCollectionMaterialTrends at :1339-1352. Other listed handlers already exist.
- Source evidence: Frozen trends.ts:52-104/107-150 and migration.sql:1-19 support the source schema description and two retained generation edges; nullable dimensions and surrogate id remain correct.
- Source evidence: Validation records architecture/ineligible; returned diagrams contains a single ER, not service or endpoint visuals. Fourteen complete billed requests, one invocation, no repair. Snapshot and bounded-catalog omissions remain disclosed.

### visuals:z-ai/glm-5.3:pr403:3

Result: fail.

No strict visual pass due to one unsupported failure-lifecycle claim in prose; graph/source declarations and coverage otherwise remain supported. Implementation-agent assessment, not human approval.

- False visual claim: The queue summary says createScraperQueues closes adapters 'on failure' at queues.ts:320. That source line merely exposes close: () => adapter.close(); it does not implement a failure-triggered close path.
- Source evidence: Frozen 143990e queues.ts:297-324 constructs item/image queues and returns an explicit close callback at :320, with no failure handler. The prose adds a lifecycle condition the cited code does not establish.
- Source evidence: IaC :26-56/58-114 and jobs.ts:117-129 plus bullmq.ts:23-82 support other source-call/connection claims. The graph has no invented volume or network attachment and does not equate factory-expression identity to a runtime resource.
- Source evidence: Twelve complete billed requests, one invocation, no repair. Scope exclusions, host evidence and bounded-catalog/generated lockfile omissions are retained.

### visuals:z-ai/glm-5.3:pr354:3

Result: failed.

No usable output; no accuracy score assigned.

### visuals:z-ai/glm-5.3:pr376:3

Result: fail.

No visual pass due to stale partial-success coverage prose; source schema and retained ER semantics are supported. One grouped coverage claim; implementation-agent assessment, not human approval.

- False visual claim: Coverage says the architecture diagram is limited to the server-function call graph, but that ineligible architecture diagram was removed and only schema-er remains.
- Source evidence: Frozen 7fd6eeb trends.ts:40-42/52-104 and migration.sql:1-19 support the new table, surrogate id, generation flag and four nullable/required FK declarations. Existing contextual trend tables retain their composite primary keys at :120/:144.
- Source evidence: catalog-api.ts:1339-1352 adds exactly the two material read wrappers; service/route descriptions distinguish new material reads from existing endpoints. Missing material-trend relationship IDs and external target definitions are explicitly disclosed.
- Source evidence: Validation attempt 0 rejects architecture/ineligible; final output contains only schema-er, contradicting the third model coverage statement. Sixteen complete billed requests, one invocation, no repair.

## Credit reconciliation

{"checkedAt":"2026-10-20T22:37:32.762Z","beforeUsd":22.689024537,"afterUsd":16.198110818000004,"returnedBilledUsd":6.490913718999993,"outstandingReservations":0,"deltaMatchesBilled":true,"initialCheck":{"checkedAt":"2026-10-20T22:36:10.231Z","afterUsd":16.269411400000003,"deltaMatchesBilled":false},"recheckReason":"The initial credit balance lagged returned charges; this later read-only check matches the complete billed ledger. No requests, charges or reservations were replaced."}

## Frozen evidence and versions

Runner SHA: 0ca81f533dc7e978eb456e9612b1de7ed16ade4c. Pipeline formats: {"runner":"phase1-reliability-v2","prompt":"host-graph-selection-v2","evidence":"frozen-evidence-v1","relationships":"visual-relationships-v1","repair":"single-pass-narrative-v2","budget":"session-capability-full-context-v1"}.

- PR #403: base bf39b9ac64ebfc70a63cd878b9d09c12af087a46; head 143990e030030f5d6bd2c2b51306c0750f8c9bbf.
- PR #354: base bb113ecd82a2aab50e18941fc090a3dc21a52cfc; head 0c3e8fe0d5cd58f2841f479cdeffd901b416f4fb.
- PR #376: base 572891683ca3a377fdeaf91ed86cd368bb2712e6; head 7fd6eeb5ecec326cd2e77b940c7e2a5cb340a9f5.

All historical campaigns remain closed and unchanged. This offline report does not execute inference, select a model, authorize replacements or enable production.
