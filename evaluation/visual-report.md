# Phase 1 visual-only evaluation

New visual-only campaign: completed. Approved cap $7.89; 27/27 sessions and 159/432 API requests. Accounted spend including retained reservations: $2.808252. No paid replacements. The owner's exact provider/model/failover decision remains pending.

Read-only credit reconciliation at 2026-10-20T16:01:57.572Z: $7.890890 before, $5.082638 after. The decrease matches $2.808252 in request charges; 0 outstanding reservations.

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
| visuals:anthropic/claude-sonnet-5.5:pr403:1 | fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:1 | fail | yes | no |
| visuals:z-ai/glm-5.3:pr403:1 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:1 | fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr354:1 | fail | yes | no |
| visuals:z-ai/glm-5.3:pr354:1 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:1 | pass | yes | yes |
| visuals:moonshotai/kimi-k2.5:pr376:1 | failed | no | no |
| visuals:z-ai/glm-5.3:pr376:1 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr403:2 | fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:2 | fail | yes | no |
| visuals:z-ai/glm-5.3:pr403:2 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:2 | fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr354:2 | fail | yes | no |
| visuals:z-ai/glm-5.3:pr354:2 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:2 | pass | yes | yes |
| visuals:moonshotai/kimi-k2.5:pr376:2 | failed | no | no |
| visuals:z-ai/glm-5.3:pr376:2 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr403:3 | fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr403:3 | failed | no | no |
| visuals:z-ai/glm-5.3:pr403:3 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr354:3 | fail | yes | no |
| visuals:moonshotai/kimi-k2.5:pr354:3 | fail | yes | no |
| visuals:z-ai/glm-5.3:pr354:3 | fail | yes | no |
| visuals:anthropic/claude-sonnet-5.5:pr376:3 | pass | yes | yes |
| visuals:moonshotai/kimi-k2.5:pr376:3 | failed | no | no |
| visuals:z-ai/glm-5.3:pr376:3 | fail | yes | no |

## Candidate completion, quality and cost

Each candidate has nine planned sessions. Passes require a source assessment, not just JSON/Mermaid validity. Accounted cost includes failed-call reservations; returned billed cost excludes unknown charges. Mean latency uses known attempt durations, including validation failures; interrupted sessions with no final duration are excluded, not assigned zero. The gate uses returned request billing rather than treating missing SDK cost as zero. One Kimi PR 403 repetition-three session was interrupted and not replaced; its last request charge was reconciled from the provider's generation receipt.

<!-- prettier-ignore -->
| Model | Attempted / planned | Completed | Failed / unfinished | Source assessed | Visual passes | False visual claims | Requests | Accounted USD | Returned billed USD | Mean latency seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-sonnet-5.5 | 9 / 9 | 9 | 0 | 9 | 3 | 9 | 57 | 2.144167 | 2.144167 | 63.4 |
| moonshotai/kimi-k2.5 | 9 / 9 | 5 | 4 | 5 | 0 | 13 | 50 | 0.562966 | 0.562966 | 78.8 |
| z-ai/glm-5.3 | 9 / 9 | 9 | 0 | 9 | 0 | 33 | 52 | 0.101120 | 0.101120 | 52.2 |

No candidate clears all nine dedicated visual trials. Structured completion alone is not a visual quality pass; keep model adoption disabled.

## Dedicated source assessment notes

These are implementation-agent adjudications against frozen source, not independent human approvals. False-claim counts group related errors; they are not an accuracy percentage or a count of all possible assertions. Incidental count/wording mistakes are distinguished from material topology/cardinality errors in the notes.

### visuals:anthropic/claude-sonnet-5.5:pr403:1

Result: fail; execution status: success.

The descriptive queue/package architecture and staging distinction are supported. A material storage-topology edge is invented despite the live-state disclaimer, so source/diagram gates fail. The disclosure of partial reads and unchanged-source limitations is accurate; no review findings are generated.

- False visual claim: The architecture diagram draws both LegacyRedis --- Volume and NewRedis --- Volume, asserting a shared attachment to redis-volume. The frozen IaC declares the volume separately and provides no attachment from the new Redis resource; live bindings were not inspected.
- Source evidence: PR 403 frozen head .railway/railway.ts: legacyScraperQueue and sharedQueue declare deployment/network settings; redisVolume is a separate volume resource. The project resources array alone does not prove a shared mount.
- Source evidence: PR 403 frozen head apps/scraper/src/queue/queues.ts: createBullMqQueueAdapter builds bounded item/image queues with replaceCompleted, shared retention/retry and payload validators.
- Source evidence: The result distinguishes documented staged cutover from retained legacy Redis and discloses omitted lockfile, partial large-file reads and unavailable live state.
- Source evidence: Ten returned-billed model requests completed with 28 reported tool iterations under the pinned default-deny isolated runner; selected skills are the two visual writing skills.

### visuals:moonshotai/kimi-k2.5:pr403:1

Result: fail; execution status: success.

The package and producer/processor relationships are useful, and prose calls the shared Redis staged. The unqualified active connection in the diagram contradicts that distinction. A false unavailable-source disclaimer also fails coverage accuracy. Ineligible extra diagram types were omitted by the existing sanitizer and disclosed.

- False visual claim: BullMQ --> Shared is drawn as the active Redis connection without a staged qualifier. Frozen IaC preserves REDIS_URL and migration documentation retains the legacy scraper queue until separately approved cutover.
- False visual claim: The coverage gap says package tsconfig details are unavailable, although packages/queue/tsconfig.json is a changed source file supplied in the frozen comparison.
- Source evidence: PR 403 frozen .railway/railway.ts preserves scraper REDIS_URL and declares both legacyScraperQueue and sharedQueue; no new live consumer binding is established.
- Source evidence: apps/scraper/src/queue/queues.ts constructs the BullMQ adapter from redisUrl and permits an injected adapter; producer/processor migration supports the package-layer map.
- Source evidence: Frozen comparison includes packages/queue/tsconfig.json; pnpm-lock.yaml was omitted before context limits.
- Source evidence: Dedicated session completed a structured visual result under the isolated default-deny runner; writing skills and per-request billing are recorded in the campaign ledger.

### visuals:z-ai/glm-5.3:pr403:1

Result: fail; execution status: success.

The portable package migration is recognizable, but staged infrastructure, adapter implementation location and available evidence are misrepresented. Current syntax succeeds after scope sanitation; that does not repair these source claims. Runtime and generated-file limitations are otherwise disclosed.

- False visual claim: The diagram connects the adapter Redis connection to both shared and legacy Redis as active solid edges without a staged qualifier; preserved REDIS_URL and docs/railway.md retain the legacy preview queue until separately approved cutover.
- False visual claim: The diagram and changed-area prose place the in-memory adapter in test-contract.ts. createInMemoryQueueAdapter is defined in packages/queue/src/index.ts; test-contract.ts exports the shared adapter test suite.
- False visual claim: The result says full current source contents were unavailable. The prepared evidence included frozen head contents as well as patches; unread contents are not unavailable contents.
- Source evidence: PR 403 head .railway/railway.ts preserves REDIS_URL; docs/railway.md lines 274-276 retains scraper-queue until approved provisioning/cutover, while its shared-volume text describes intended shared deployment.
- Source evidence: PR 403 head packages/queue/src/index.ts line 276 defines createInMemoryQueueAdapter; test-contract.ts line 14 defines defineQueueAdapterContract.
- Source evidence: The restricted runner materializes both patch and supplied head content into separate plaintext evidence files before invocation; omitted lockfile is disclosed.
- Source evidence: Seven billed requests and sixteen reported tool iterations completed. SDK estimated cost is $0.025244444 versus $0.012103444 returned request billing; the report uses returned billing, not the SDK estimate. Default-deny isolation and visual writing skills remained configured.

### visuals:anthropic/claude-sonnet-5.5:pr354:1

Result: fail; execution status: success.

The domain map and two focused ER slices cover the affected groups and preserve most optionality. Both successor self-relations assert uniqueness absent from the schema, failing the source/semantic gate. The 46-table wording is an incidental count error; the material failures scored here are the two successor cardinalities. Limitations disclose untraced trigger bodies, partial relations/docs/test reads and omitted ER details.

- False visual claim: refill_offering_identifier |o--o| refill_offering_identifier makes successor one-to-one. successor_id is nullable and non-unique, so multiple predecessors may reference the same successor.
- False visual claim: refill_offering_market_status |o--o| refill_offering_market_status repeats the unsupported one-to-one successor cardinality.
- Source evidence: PR 354 frozen head packages/database/src/schema/pens.ts lines 970-989 and 1050-1068: nullable successor self-FKs with ordinary non-unique successor indexes.
- Source evidence: Frozen migration lines 994-1004 check successor scope; lines 1144-1145 create non-unique successor indexes, not incoming-link uniqueness.
- Source evidence: Subtype ER edges preserve optional shared-PK children; configuration carrier edges are optional, and installed items are selection-mediated. Coverage lists omitted table families and constraints rather than claiming complete ER coverage.
- Source evidence: Six returned-billed requests, fifteen reported tool iterations and a strict visual-only completion under default-deny isolation; generated snapshot omitted.

### visuals:moonshotai/kimi-k2.5:pr354:1

Result: fail; execution status: success.

The descriptive group map and most prose match the schema, including conditional remedies and exclusive carriers. The three carrier edges introduce inverse uniqueness that the schema does not enforce. A requested refill ER slice was discarded for syntax and disclosed; parse/scope sanitation does not make the surviving cardinalities correct.

- False visual claim: product_configuration_choice ||--o| product_material asserts each material belongs to exactly one choice; the nullable carrier FK permits many choices to reference a material, with no inverse uniqueness.
- False visual claim: product_configuration_choice ||--o| finish_option repeats the unsupported inverse one-to-one cardinality.
- False visual claim: product_configuration_choice ||--o| product_detail_pen_part repeats the unsupported inverse one-to-one cardinality.
- Source evidence: PR 354 frozen pens.ts product_configuration_choice has nullable productMaterialId, finishOptionId and partProductId; carrier_valid uses num_nonnulls(...)=1 but does not uniquely constrain those referenced carrier IDs.
- Source evidence: Shared-PK product subtypes are optional in the emitted ERD, and installed parts are mediated through collection_item_configuration_selection, matching the schema.
- Source evidence: The emitted coverage notes disclose the omitted refill/evidence ER slice after Mermaid validation failed; the domain map still covers those groups.
- Source evidence: Five returned-billed requests, twelve reported tool iterations and a strict visual-only completion under the isolated default-deny runner. Generated snapshot excluded.

### visuals:z-ai/glm-5.3:pr354:1

Result: fail; execution status: success.

The output covers the requested domain map and two parse-valid ER slices, with disclosed source omissions. Multiple mandatory endpoints and the broad shared-key description materially change the schema meaning. Column inventories do not compensate for incorrect relationship optionality. The 43-table count is incidental and not the scored failure.

- False visual claim: Overview says all tables use shared product/collection primary keys. Most new offering, market, concept, evidence and configuration entities have independent identity keys; only the detail subtypes share root keys.
- False visual claim: The configuration ERD makes material, finish and part carrier relationships all mandatory. Each carrier FK is nullable and exactly one carrier is selected per choice.
- False visual claim: The compatibility ERD makes target group, target refill and required tip all mandatory. Target group versus refill is exclusive and nullable; required tip is optional.
- False visual claim: The installed-part relation makes every selection require an installed collection item; installed_part_collection_item_id is nullable.
- False visual claim: CATALOG_TERMINOLOGY_CONCEPT ||--|| REFILL_COMPATIBILITY_GROUP requires a group for every terminology concept, although only a subset of concepts backs a group.
- False visual claim: Both successor self-relations use a mandatory endpoint, omitting nullable successor_id for unsuperseded rows.
- Source evidence: PR 354 frozen pens.ts: productDetailId and collectionDetailId define shared-PK subtypes; independent entities use identity().
- Source evidence: pens.ts lines 435-436 enforces exactly one nullable configuration carrier; lines 1149-1158 and 1197-1198 make tip optional and targets exclusive.
- Source evidence: collection_item_configuration_selection has nullable installedPartCollectionItemId; refill_compatibility_group uniquely references a concept but not vice versa.
- Source evidence: Nullable successor FKs and ordinary indexes appear at pens.ts lines 970-989 and 1050-1068. Five model requests completed with returned billing under isolated default-deny visual execution. Snapshot omitted.

### visuals:anthropic/claude-sonnet-5.5:pr376:1

Result: pass; execution status: success.

The relevant persisted material ER slice matches nullable headline/Unspecified/general dimensions and many-to-one references. Prose preserves live exact catalog versus persisted privacy counts and the dedicated material suppression flag. No material false descriptive/diagram claim established; uninspected source details are disclosed rather than replaced with hypotheses.

- Source evidence: PR 376 frozen trends.ts and migration.sql lines 1-19: mandatory generation_id; nullable product_type_id, material_id and material_specific_id; composite specific-parent FK; coalesced scope index and separate suppressed-material flag.
- Source evidence: Frozen services/db/trends/index.ts separates exact catalog grouping from active-generation collection rows; lines 555-566 independently suppress material rows, and lines 597-605 insert their own privacy-transformed dimensions.
- Source evidence: The focused ERD uses optional material/type/specific endpoints and many rows per generation/scope, retains globally unique material_specific.id, and discloses omitted SQL source entities and partial web reads.
- Source evidence: Five returned-billed requests completed under isolated default-deny execution with the two writing skills. Generated snapshot omitted; ineligible architecture output omitted with coverage text.

### visuals:moonshotai/kimi-k2.5:pr376:1

Result: failed; execution status: error.

No usable dedicated visual output; no zero-defect or accuracy score assigned.

### visuals:z-ai/glm-5.3:pr376:1

Result: fail; execution status: success.

The output supplies a useful focused slice but repeats two source-level schema errors: composite rather than global primary key and an unconditional mandatory material edge. A disclaimer that unchanged definitions were inferred does not make those precise false assertions safe.

- False visual claim: MATERIAL_SPECIFIC marks both material_id and id as PK, inventing a composite primary key. material_specific.id is the global primary key; the composite referenced pair is a separate unique key.
- False visual claim: The extra MATERIALS ||--o{ PUBLIC_COLLECTION_ITEM_MATERIAL_TREND edge makes material mandatory for every row, contradicting nullable material_id/Unspecified rows and the optional edge already drawn.
- Source evidence: PR 376 frozen packages/database/src/schema/scraper.ts defines materialSpecific.id as primaryKey and materialId as a required FK with a separate composite unique key.
- Source evidence: Frozen trends.ts and migration.sql lines 4-6 permit null product_type_id, material_id and material_specific_id; scope_valid only requires material_id when a specific is present.
- Source evidence: The rest of the focused ERD and prose retain privacy-transformed persisted counts, independent material suppression and exact catalog aggregation, with source omissions disclosed.
- Source evidence: Five returned-billed requests completed with structured output, visual writing skills and default-deny isolation. Ineligible architecture/domain output was omitted with coverage text; generated snapshot excluded.

### visuals:anthropic/claude-sonnet-5.5:pr403:2

Result: fail; execution status: success.

Staged/retained annotations improve over the first trial, but the shared-volume link remains unsupported. The score treats that edge as an unsupported topology assertion, not as proof of live infrastructure state. Other package/build/queue descriptions and coverage limitations are supported.

- False visual claim: The diagram connects both retained LegacyRedis and staged SharedRedis to redis-volume. Dashing the new edge distinguishes staging but still asserts a two-resource volume attachment not established by the IaC; no binding verification is supplied.
- Source evidence: PR 403 frozen .railway/railway.ts declares redisVolume separately and preserves REDIS_URL; resources-array membership does not establish two Redis volume attachments.
- Source evidence: docs/railway.md describes intended shared deployment and retained legacy preview handoff, not evidence that both Redis resources attach to the same volume.
- Source evidence: The remaining graph labels retained legacy connections, future approved cutover and docs-only Discord intent; queue source supports package/producer/processor relationships and retained cron checkpoint Redis.
- Source evidence: Dedicated visual completion and request billing are recorded; partial large-file reads, absent pnpm-install source, live state and lockfile omissions are disclosed under default-deny isolation.

### visuals:moonshotai/kimi-k2.5:pr403:2

Result: fail; execution status: success.

The sanitizer correctly removes unsafe output, leaving no required architecture visualization. A material deployment-change claim is also unsupported. Scope-ineligible domain/ER diagrams are disclosed as omitted; no paid replacement was attempted.

- False visual claim: Changed-area prose says deploy.yml adds RAILWAY_SCRAPER_QUEUE_PREVIEW_SERVICE_NAME and switches preview to the shared queue reference. The frozen deploy diff only adds RAILPACK_INSTALL_CMD staging; the documented preview handoff remains on scraper-queue until approved cutover.
- Source evidence: PR 403 frozen .github/workflows/deploy.yml additions set RAILPACK_INSTALL_CMD for preview and production; docs/railway.md lines 274-276 preserves the legacy preview queue.
- Source evidence: The required architecture diagram was removed for unsafe raw HTML; diagrams is empty and coverage explicitly reports no valid architecture flowchart.
- Source evidence: The portable queue and adapter descriptions match changed package/scraper source. Generated lockfile and partial producer reads are disclosed.
- Source evidence: Six returned-billed requests completed a structured response under default-deny execution with visual writing skills. This is a structured completion, not a successful visual artifact.

### visuals:z-ai/glm-5.3:pr403:2

Result: fail; execution status: success.

The output distinguishes staged migration in prose but still depicts two active backend connections. Most package/test/build relationships are supported. It also loosely describes retained builder/cron settings as gains, but the scored material topology error is the unqualified dual Redis connection.

- False visual claim: The production BullMQ/ioredis node has solid connections to both shared and retained legacy Redis. The frozen configuration preserves a single REDIS_URL and establishes neither simultaneous consumption nor an approved shared-Redis cutover.
- Source evidence: PR 403 frozen .railway/railway.ts preserves scraper REDIS_URL; docs/railway.md lines 274-276 keeps preview handoff on scraper-queue until approved cutover.
- Source evidence: Queue adapter and scraper factories take one Redis URL; producers and processor call portable typed queues, supporting the package portion of the diagram.
- Source evidence: Coverage discloses unread Railway docs, omitted lockfile, unavailable live state/full base and sanitizer-removed extra diagrams.
- Source evidence: A dedicated structured visual completion and returned request billing are recorded under default-deny isolation and writing-only skills.

### visuals:anthropic/claude-sonnet-5.5:pr354:2

Result: fail; execution status: success.

The second trial repeats both successor uniqueness errors. Its diagrams preserve most other optionality, but one evidence-availability claim conflicts with the supplied context. Incidental 46-table counting is not scored as a material failure.

- False visual claim: refill_offering_market_status |o--o| refill_offering_market_status falsely makes nullable, non-unique successor links one-to-one.
- False visual claim: refill_offering_identifier |o--o| refill_offering_identifier repeats the unsupported one-to-one successor restriction.
- False visual claim: Changed-area prose says relations.ts content was not included in evidence. The runner supplied its frozen head content and patch; not reading it is different from its absence.
- Source evidence: PR 354 frozen pens.ts lines 970-989 and 1050-1068 plus migration lines 994-1004/1144-1145: nullable self-FKs, scope checks and non-unique successor indexes.
- Source evidence: The frozen comparison includes packages/database/src/schema/relations.ts; prepared evidence materializes its patch and head source. Other coverage text correctly calls it unmapped.
- Source evidence: The surviving domain map/two ER slices otherwise preserve optional subtype/carrier/installed-refill relationships and disclose omitted families/constraints. Returned request billing and default-deny visual completion are recorded.

### visuals:moonshotai/kimi-k2.5:pr354:2

Result: fail; execution status: success.

The second Kimi schema trial produces both ER slices, but repeats carrier cardinality errors and adds a reversed requirement relation and mandatory exclusive-target edges. The table count is incidental. Source constraints, rather than Mermaid parse success, decide the failure.

- False visual claim: The three product_configuration_choice ||--o| carrier edges invent inverse uniqueness for material, finish and part references; nullable carrier FKs allow many choices to reference one carrier.
- False visual claim: product_configuration_choice_requirement ||--o{ product_configuration_choice reverses the required-choice relationship, implying many choices per requirement and a required requirement per choice.
- False visual claim: The compatibility ERD makes tip, refill target and group target simultaneously mandatory, contradicting the nullable required tip and exactly-one target constraint.
- Source evidence: PR 354 frozen pens.ts configuration carrier check uses num_nonnulls(...)=1 without unique carrier IDs; each requirement has one requiredChoiceId FK, and a choice can appear in many requirements.
- Source evidence: pens.ts lines 1149-1158 and 1197-1198: required tip nullable, targetGroupId and targetRefillProductId nullable and mutually exclusive.
- Source evidence: The domain map and two focused slices cover affected groups and disclose broader omissions; snapshot excluded. Five billed requests completed under the isolated visual-only runner.

### visuals:z-ai/glm-5.3:pr354:2

Result: fail; execution status: success.

This trial has broad table-family coverage but multiple material relationship cardinality errors. It is parse-valid, not schema-accurate. Incidental table-count wording is not the scored failure.

- False visual claim: mechanism ||--o| product_detail_pen_mechanism invents uniqueness of mechanism_id; many product details may reference one mechanism.
- False visual claim: The three material/finish/part carrier relationships are mandatory, although their nullable FKs are mutually exclusive per choice.
- False visual claim: product-to-nose-profile is drawn one-to-many despite a product-id primary key; concept-to-alias is drawn one-to-one despite multiple aliases, and maker-to-alias is mandatory despite nullable makerId.
- False visual claim: Both successor self-edges assert mandatory one-to-one rather than optional non-unique links.
- False visual claim: Source evidence is shown with mandatory listing and market parents, although both FKs are nullable.
- False visual claim: Compatibility assertions are shown requiring tip, group and refill simultaneously; the tip is optional and exactly one target is selected.
- False visual claim: The product-pen/refill/offering to collection_detail_pen edges impose inverse uniqueness on catalog references; many owned items may reference one catalog product/offering, and installed refill/offering references are optional.
- Source evidence: PR 354 frozen pens.ts defines required non-unique mechanismId, PK productId on pen_nose_profile_assignment, multiple aliases per concept and nullable maker-scoped aliases in collection.ts.
- Source evidence: pens.ts carrier_valid, assertion_target_valid, optional evidence/listing/market and collection installed-refill FKs establish the missing optionality; catalog reference FKs have no inverse uniqueness.
- Source evidence: pens.ts successor_id declarations and migration scope triggers/non-unique indexes contradict the one-to-one self-edges.
- Source evidence: The output supplies a domain map and two focused slices with omitted scope disclosed; six returned-billed requests completed in the isolated visual-only runner and generated snapshot remained excluded.

### visuals:anthropic/claude-sonnet-5.5:pr376:2

Result: pass; execution status: success.

The second Trends result preserves the source dimensions and exact-versus-private counting distinction with no established material false claim. One coverage sentence still describes an architecture diagram that the sanitizer omitted, but the explicit omission is also reported; this stale descriptive sentence does not change the retained ERD's meaning or claim complete UI coverage.

- Source evidence: PR 376 frozen trends.ts and migration.sql lines 1-19: mandatory generation and nullable product type/material/specific, composite parent FK, coalesced scope uniqueness and dedicated suppression flag.
- Source evidence: Frozen service separates live exact catalog groups from privacy-transformed owned-item/collector material rows and swaps the active generation after insertion; materialSpecific.id is a global PK in scraper.ts.
- Source evidence: The focused ERD preserves these keys/cardinalities and explicitly omits unchanged parent detail and sibling trend tables. Generated snapshot and partial UI/test reads are disclosed; returned billing and isolated visual-only completion are recorded.

### visuals:moonshotai/kimi-k2.5:pr376:2

Result: failed; execution status: error.

No usable dedicated visual output; no zero-defect or accuracy score assigned.

### visuals:z-ai/glm-5.3:pr376:2

Result: fail; execution status: success.

Global material-specific primary-key identity improves over repetition one, but nullable aggregate dimensions and zero-child materials are represented incorrectly. References to flow/pipeline visuals survive scope sanitation in prose; explicit omission messages identify their removal.

- False visual claim: The material, material-specific and product-type ER edges are all mandatory, contradicting nullable headline/Unspecified/general bucket dimensions.
- False visual claim: MATERIAL ||--|{ MATERIAL_SPECIFIC requires at least one specific for every material; the schema imposes no such parent-side minimum.
- Source evidence: PR 376 frozen trends.ts and migration.sql lines 4-6 allow null product_type_id, material_id and material_specific_id; specific-parent scope only requires material when a specific is present.
- Source evidence: Frozen scraper.ts materialSpecific has an id PK and required materialId FK, without a constraint requiring every material to own at least one specific.
- Source evidence: The prose preserves exact catalog versus privacy-transformed collection counts; generated snapshot and partial web reads are disclosed. Five billed model requests completed under default-deny visual execution.

### visuals:anthropic/claude-sonnet-5.5:pr403:3

Result: fail; execution status: success.

The third Sonnet architecture trial improves the active-target qualifier, but repeats the unsupported shared-volume assertion. Other descriptive topology and coverage limitations are supported.

- False visual claim: Both new and legacy Redis resources are drawn with solid links to the retained redis-volume, although no two-resource attachment is established in the frozen IaC or verified runtime evidence.
- Source evidence: PR 403 frozen .railway/railway.ts declares the volume as a separate resource and preserves REDIS_URL; docs describe intended shared deployment and retained legacy migration stages, not verified dual attachments.
- Source evidence: This trial correctly labels active target uncertainty, retained preview handoff, approved future cutover and docs-only Discord usage; source supports the queue package, producer, processor and build relationships.
- Source evidence: Coverage discloses partial implementation/test reads, absent script source and live variables/state; the strict visual result and returned request billing remain under default-deny execution.

### visuals:moonshotai/kimi-k2.5:pr403:3

Result: failed; execution status: interrupted.

No usable dedicated visual output; no zero-defect or accuracy score assigned.

### visuals:z-ai/glm-5.3:pr403:3

Result: fail; execution status: success.

The surviving generic Redis edge avoids the prior active-target mistake. Unsupported storage prose and evidence/diagram coverage claims still fail the source gate. The interrupted Kimi session was skipped, not replaced, before this planned GLM trial.

- False visual claim: Railway changed-area prose asserts the new shared Redis uses the same volume while the legacy resource remains. The frozen IaC declares a separate retained volume without proving this two-resource attachment.
- False visual claim: Coverage says only changed hunks were available; the prepared workspace supplied frozen head contents as well as patches.
- False visual claim: Coverage says the diagram shows staged and retained Railway resources, but the surviving diagram has only a generic Redis node; a second diagram was removed by the scope cap.
- Source evidence: PR 403 frozen .railway/railway.ts declares both Redis resources plus a separate redisVolume, preserves REDIS_URL, and does not establish dual volume binding; docs describe intended deployment and retained handoff.
- Source evidence: The retained diagram accurately shows the portable package/scraper queue boundary without guessing a specific active Redis target, but does not show the Railway resource distinction described in coverage.
- Source evidence: The runner materializes both changed-file head content and patch evidence. Six returned-billed requests completed after resumption with unchanged visual prompt/default-deny isolation and generated lockfile exclusion.

### visuals:anthropic/claude-sonnet-5.5:pr354:3

Result: fail; execution status: success.

The third Sonnet schema trial reduces the error set and gets the 45-new-table count right, but the market-status successor relation remains materially too restrictive. Omitted identifier successor linkage is disclosed through partial slice scope rather than scored as a false claim.

- False visual claim: refill_offering_market_status |o--o| refill_offering_market_status still imposes one-to-one successor cardinality, although successor_id is nullable and non-unique.
- Source evidence: PR 354 frozen pens.ts lines 970-989 and migration lines 994-1004/1145 define the nullable self-FK, successor scope check and non-unique successor index.
- Source evidence: Other retained ER relationships preserve optional shared-PK subtypes, nullable carriers and targets, many owned items per product, selection-mediated installed items and optional source-evidence parents.
- Source evidence: The domain map and two slices disclose omitted terminology/part/evidence tables, partial attributes, untraced constraints and unread source sections. Five billed requests completed under unchanged visual prompt/default-deny execution; generated snapshot excluded.

### visuals:moonshotai/kimi-k2.5:pr354:3

Result: fail; execution status: success.

The third Kimi schema trial changes the membership entity level and repeats mandatory alternative-edge errors. It also mislocates collection detail declarations and overstates table counts; the material scored issues are the membership FK, optionality and evidence-availability claims.

- False visual claim: The domain map and refill ERD link refill_offering to refill_compatibility_group_membership. Membership references refillProductId/product_detail_refill, not an offering.
- False visual claim: The compatibility ERD makes required tip and both exclusive target types mandatory rather than optional/alternative.
- False visual claim: The configuration ERD makes material, finish and part carriers mandatory even though exactly one nullable carrier is chosen.
- False visual claim: Service prose says primary implementation details are not visible in this PR scope; frozen catalog/index.ts head content and its alias-change patch were supplied.
- Source evidence: PR 354 frozen pens.ts refillCompatibilityGroupMembership has groupId and refillProductId FKs, with no offeringId; its source rows therefore do not support offering-level membership.
- Source evidence: pens.ts carrier_valid and assertion_target_valid checks enforce exactly one nullable carrier/target; requiredTipProductId remains nullable.
- Source evidence: Frozen prepared context includes packages/services/src/db/catalog/index.ts; source shows concept-based alias creation/listing, not missing primary implementation evidence.
- Source evidence: Four billed model calls completed a structured visual-only response under unchanged default-deny runner settings. The snapshot is excluded and broader omissions are disclosed.

### visuals:z-ai/glm-5.3:pr354:3

Result: fail; execution status: success.

The third GLM large-schema trial again changes material optionality and inverse multiplicity, and invents a direct refill/group link. Broad diagram coverage and parse success do not establish constraint accuracy.

- False visual claim: mechanism-to-product_detail_pen_mechanism is one-to-one instead of non-unique many-to-one.
- False visual claim: REFILL_COMPATIBILITY_GROUP ||--o| PRODUCT_DETAIL_REFILL invents a direct single-group/shared-row relationship; refills join groups through refill_compatibility_group_membership.
- False visual claim: Catalog pen/refill/offering references from collection_detail_pen are drawn inverse-unique, and installed references mandatory; many owned rows may reference one catalog row and installed references are nullable.
- False visual claim: Concept-to-pen_nose_profile_assignment is inverse-unique, although multiple product assignments may share one concept.
- False visual claim: The three nullable exclusive configuration carriers are mandatory in the ERD.
- False visual claim: Installed-part selection is shown mandatory and inverse-unique rather than nullable and non-unique.
- False visual claim: Source-evidence listing and market parents are mandatory despite nullable source columns.
- False visual claim: Product-to-product_source_listing is one-to-one, although listingId is the PK and a product can have multiple source listings.
- False visual claim: The market-status successor self-edge is mandatory one-to-one despite its nullable non-unique successor FK.
- Source evidence: PR 354 frozen pens.ts FK and uniqueness declarations: non-unique mechanismId/conceptId/catalog references; nullable installed items and source-evidence parents; product_source_listing keyed by listingId rather than productId.
- Source evidence: Refill group membership uses groupId plus refillProductId, not a direct shared refill/group key. Configuration carrier_valid selects exactly one nullable carrier.
- Source evidence: Market-status successor_id is nullable and has only an ordinary index plus scope validation, as in pens.ts lines 970-989 and migration lines 994-1004/1145.
- Source evidence: Three parse-valid focused diagrams and disclosed omissions completed under unchanged isolated visual execution; returned billing is recorded and generated snapshot omitted.

### visuals:anthropic/claude-sonnet-5.5:pr376:3

Result: pass; execution status: success.

All three Sonnet Trends trials preserve the relevant persisted dimensions and exact-versus-private distinction. This trial avoids asserting unseen material-specific key attributes and qualifies its unchanged-parent inference. A leftover coverage reference to an omitted architecture node is non-material given the explicit sanitizer omission.

- Source evidence: PR 376 frozen trends.ts and migration.sql preserve required generation, nullable headline/type/material/specific dimensions, composite specific-parent FK and scoped uniqueness.
- Source evidence: Frozen service uses live exact catalog groups versus privacy-transformed active-generation collection counts, a dedicated suppressed-material flag and insertion before activation in the existing transaction.
- Source evidence: The retained ER slice correctly represents nullable parents and many scoped rows; inferred unchanged-parent detail is qualified and matches frozen scraper.ts. No composite material-specific PK is invented.
- Source evidence: Partial UI/export reads, generated snapshot and scope-ineligible architecture output are disclosed. Returned billing and isolated visual-only completion remain recorded.

### visuals:moonshotai/kimi-k2.5:pr376:3

Result: failed; execution status: error.

No usable dedicated visual output; no zero-defect or accuracy score assigned.

### visuals:z-ai/glm-5.3:pr376:3

Result: fail; execution status: success.

No required ERD survives validation. Zero material false visual claims therefore does not mean a visual pass. The catalog-filters summary loosely calls existing type/parser helpers new; the actual delta extends them with material keys. This wording issue is not scored as a material topology error, but is recorded here rather than called perfect prose. Ineligible architecture/domain outputs were omitted and disclosed.

- Source evidence: PR 376 frozen trends.ts/migration and service source support the material table, scoped uniqueness, suppression flag, exact catalog reads and privacy-transformed generation refresh described in the prose.
- Source evidence: The required focused ERD was rejected for invalid Mermaid; the retained diagrams array is empty and coverage explicitly reports no valid focused ER diagram.
- Source evidence: Generated snapshot, partial unchanged entity definitions and non-evidenced runtime scheduling are disclosed; six returned-billed requests completed under unchanged isolated visual-only execution.

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

Verified from https://openrouter.ai/api/v1/models at 2026-10-20T15:25:40.039Z; no inference was executed. Prices are USD per million tokens, not an estimate of full tool-loop cost.

<!-- prettier-ignore -->
| Exact OpenRouter model | Input / output | Context tokens |
| --- | ---: | ---: |
| anthropic/claude-sonnet-5.5 | $2 / $10 | 1000000 |
| moonshotai/kimi-k2.5 | $0.5 / $2.5 | 262144 |
| z-ai/glm-5.3 | $0.079 / $1.4 | 1048576 |

## Next approval

This campaign has a separately approved $7.89 cumulative cap and 27-session / 432-request ceilings, with no paid replacements. Returned per-request billing supplies gate cost when complete; unknown/retained request billing cannot pass. Stop before a conservative reservation cannot fit, even if the nominal balance is positive. Any further campaign or replacement needs new authorization. No production model is selected; the owner's exact provider/model/failover approval and live adoption checks remain required. The report command itself is offline and cannot execute inference.
