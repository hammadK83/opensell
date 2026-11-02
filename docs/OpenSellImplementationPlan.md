# OpenSell — Master Product & Implementation Specification

**Version:** 2.0  
**Status:** Living product and engineering specification  
**Updated:** November 2, 2026  
**Target:** Initial public release (P0), followed by enhancements (P1) and monetization (P2)  
**Repository:** `hammadK83/opensell`  
**Recommended repository path:** `docs/OpenSellImplementationPlan.md`

> **Scope of this document.** This is the product and engineering foundation for OpenSell. It defines desired behavior, ordered feature dependencies, system constraints, quality expectations, and acceptance criteria. It does not claim that proposed functionality already exists. Where a decision remains open, the proposal is marked as such rather than silently treated as settled.

## Contents

1. [Product vision and release boundaries](#1-product-vision-and-release-boundaries)
2. [Engineering principles and cross-cutting requirements](#2-engineering-principles-and-cross-cutting-requirements)
3. [Current technical baseline and migration constraints](#3-current-technical-baseline-and-migration-constraints)
4. [Canonical domain and interaction rules](#4-canonical-domain-and-interaction-rules)
5. [Ordered implementation map](#5-ordered-implementation-map)
6. [P0: Core launch features, in implementation order](#6-p0-core-launch-features-in-implementation-order)
7. [P1: Post-launch enhancements](#7-p1-post-launch-enhancements)
8. [P2: Monetization](#8-p2-monetization)
9. [Cross-feature verification and release gates](#9-cross-feature-verification-and-release-gates)
10. [Open product and architecture decisions](#10-open-product-and-architecture-decisions)
11. [Change control and documentation conventions](#11-change-control-and-documentation-conventions)

---

## 1. Product vision and release boundaries

OpenSell is a **location-first, offline-first marketplace for physical products and locally offered services**. Its core transaction journey is: select an area → discover a relevant listing → examine its details → contact the seller or provider in chat → arrange the transaction or service outside the app.

The app does not initially process payment for the underlying product or service. An initial release **must support real two-way buyer–seller communication**. A directory of listings with no contact mechanism is not considered a usable marketplace.

### 1.1 Product pillars

- **Local relevance:** Product discovery centers on the item's approximate location; service discovery centers on whether the provider serves the buyer's location.
- **Two listing types, shared foundations:** Products and services share listings, media, ownership, favorites, moderation, and chat infrastructure, but have separate field rules, pricing models, and lifecycle behavior.
- **Offline resilience:** Previously acquired content remains browsable. Local drafts, compatible mutations, and outgoing messages persist across app restart and synchronize safely on reconnection. Offline actions are never falsely presented as server-confirmed.
- **Privacy and trust:** Approximate public areas replace private residential coordinates. The backend enforces ownership, contact permissions, anti-abuse rules, and moderation.
- **Cost containment:** Before monetization exists, expenses must be capped through usage budgets, quotas, low-cost architecture, and independently verified provider restrictions. A free tier by itself is not a hard budget.
- **Incremental delivery:** Every feature should produce a verifiable end-to-end capability. Avoid speculative infrastructure not needed by the current feature or an explicit future dependency.

### 1.2 Release scope

| Priority                       | Scope                                                                                                                                                                                                                                                                                                                                                                 | Not included                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **P0: Functional marketplace** | Working authentication; product and service listings; manual/device location; nearby discovery; details; protected media uploads; offline drafts/cache/sync; listing management; favorites; public profiles; text chat/inquiries; unread awareness and feasible new-message notifications; share links; essential moderation, quotas, security, and launch operations | Video, complex maps, transactions, service booking, advanced recommendations, paid promotion |
| **P1: Experience expansion**   | Map-based discovery and public meetup UX; optional video; richer filters/search; enhanced chat; expanded business profiles                                                                                                                                                                                                                                            | Payment for physical goods/services, fully managed appointments                              |
| **P2: Monetization**           | Pro subscriptions; credits ledger and purchases; geographically relevant sponsored boosts; reporting and purchase reconciliation                                                                                                                                                                                                                                      | Unlimited resource usage, guaranteed advertising outcomes                                    |

**Launch definition:** A local buyer can find an active product or applicable service, send a listing-linked inquiry, and receive a seller/provider response. A seller can create, publish, and manage a listing; reasonable loss of connectivity does not destroy local work; private data and financial exposure are controlled.

### 1.3 Terms and requirement levels

- **MUST / SHALL:** Required for the release containing the feature; a failed requirement blocks completion.
- **SHOULD:** Expected unless a documented trade-off is accepted.
- **MAY:** Optional enhancement, not a prerequisite.
- **Server-confirmed:** Accepted and persisted by the backend, not merely queued on a device.
- **General area:** Publicly shareable location deliberately less precise than a private address.
- **Service coverage:** Geographic region where a provider accepts inquiries, distinct from business location.

---

## 2. Engineering principles and cross-cutting requirements

The rules here apply to **every feature**, unless that feature explicitly adds a stricter requirement. Individual feature sections reference these rules rather than restating them in full.

### 2.1 System boundaries and data ownership

| Concern                    | Preferred boundary                           | Invariant                                                                                       |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Mobile UI                  | Expo / React Native / TypeScript             | Screens render local domain state, not ad hoc raw network responses                             |
| Structured offline data    | SQLite                                       | Persistent source of truth for local-first marketplace UI, chat history, and pending operations |
| Local media                | App-managed file storage                     | Unsynced drafts/media cannot be evicted as disposable cache                                     |
| Secrets                    | Expo SecureStore                             | Credentials never in ordinary SQLite tables or analytics                                        |
| Network                    | Existing authenticated Axios client          | Reuse session handling and shared API error contracts                                           |
| Backend                    | Express / TypeScript                         | Authoritative validation, authorization, quotas, lifecycle, idempotency                         |
| Persistent server data     | MongoDB / Mongoose                           | Index-backed queries, atomic mutations, private/public projection separation                    |
| Shared contracts           | `packages/shared` / Zod                      | Explicit, versioned request/response validation and discriminated listing types                 |
| Object storage             | Provider selected under verified cost policy | No direct unbounded upload authorization or unrestricted public objects                         |
| External maps, email, push | Provider-specific adapters                   | No billable invocation without independently enforced bounds                                    |

**Architectural rule:** Avoid independent, conflicting sources of truth for the same marketplace data (for example, storing authoritative listings separately in SQLite, Redux, and a query cache). Redux may continue to own authentication state; SQLite owns persistent marketplace state; network libraries orchestrate fetching, not ownership.

### 2.2 API and persistence contracts

- All API input is validated on the backend, including path parameters, query parameters, headers that control behavior, and payloads. Client validation improves UX but never replaces server validation.
- Prefer explicit public summary and detail DTOs over serializing database documents. Never leak password hashes, verification data, tokens, email addresses, private location, or nonpublic moderation information.
- Writes that can be retried must accept stable **idempotency keys or client-generated operation IDs**. Semantically identical retries must not create duplicate listings, charges, favorites, or messages.
- Listings and mutable resources carry a **revision/version** for conditional updates. Return a conflict response when a stale edit cannot safely overwrite newer server data.
- Use bounded page sizes and stable cursor pagination with deterministic tie-breakers. Bind cursors to filter/sort/geographic context; a cursor from one query must not be usable as another query's continuation.
- Timestamps are assigned by the backend in UTC; clients format them for the locale and must not dictate publication dates, ordering, price history, or server-confirmed delivery status.
- Use stable resource IDs and client-created UUIDs for offline-created operations; persist the mapping between local and server identifiers.
- Use clearly differentiated states for **local draft**, **queued**, **syncing**, **server-confirmed**, **retryable failure**, **permanent failure**, and **conflict**. Do not overload an API's domain status for local sync state.
- Deletions/archives must propagate to offline clients through a documented invalidation/tombstone strategy. Avoid relying solely on a disappearing row in a refreshed feed.
- API errors use a consistent machine-readable code, a safe user-facing message, and retry semantics. HTTP 401, 403, 404, 409, 422, and 429 must not be conflated.

### 2.3 Security and privacy requirements

- Enforce authorization for every write and every private read. Prefer resource-scoped queries/updates that incorporate the authenticated actor rather than in-memory authorization followed by a separate write.
- Authentication, email verification, session refresh, and account isolation must remain correct through loss of connectivity, concurrency, and application restarts.
- Require no background location permission. Request foreground location only after an explicit action; manual area selection must work without permission.
- Separate **searcher location**, **listing public point/area**, **provider coverage**, and **meetup location** in both storage and API contracts. Raw device location and private provider coordinates must not accidentally appear in public DTOs, logs, crash reports, media metadata, or share URLs.
- Implement reasonable reporting, blocking, spam prevention, prohibited-content rules, and restrictions for regulated services before public launch.
- Treat uploaded files, externally supplied text, message content, and metadata as untrusted. Validate media type, size, ownership, and allowed references server-side; strip sensitive image metadata.
- Do not store card numbers or directly implement payment authorization; future digital purchases require an appropriately compliant billing integration.

### 2.4 Availability, synchronization, and fault tolerance

- Internet access is not required for cached browsing, local drafts, and durable outgoing queue creation. Internet access **is** required for actual publication, buyer–seller delivery, fresh cross-device visibility, and purchase confirmation.
- An offline operation survives process death/restart and has explicit retry policy, ordering dependencies, and a non-destructive failure path.
- Sync correctness does not depend on guaranteed background scheduling; start, foreground, reconnection, and explicit user action provide recovery paths.
- Handle duplicate delivery, out-of-order responses, network timeout after a successful server write, expired credentials, missing local media, server-side deletion, and partial synchronization.
- Use bounded local caches and per-account isolation. Define what happens to unsent edits/messages on logout rather than silently leaking or deleting them.
- Shared user-specific data may use incremental synchronization; **public marketplace search must not attempt to replicate the entire marketplace to each device**. Public feed data is a query-scoped cache, refreshed and expired independently.

### 2.5 Performance and scalability

- Design queries for **indexed, bounded work**, not full-collection scans. Verify geospatial and sort plans using representative datasets.
- Paginate listing feeds, seller-owned listings, favorites, chat inboxes, message history, and administrative reports. Avoid N+1 seller/profile lookups.
- Use summary payloads for feeds and separate detail payloads; serve optimized thumbnails rather than original uploads in scrolling lists.
- Maintain stable ordering under concurrent creation/edits. Never assume a simple timestamp alone uniquely orders records.
- Ensure rate-limit and quota enforcement remains correct across multiple backend instances; avoid process-memory-only counters for security or billing-critical controls.
- Explicitly test cold start, app resume, low-end device rendering, poor connectivity, and large/empty local caches. Avoid unbounded SQLite subscriptions, in-memory message arrays, and repeated entire-dataset refreshes.
- Establish observable service-level goals during pilot testing. **Initial targets (proposed, to validate against chosen hosting):** p95 cached feed interaction under 300 ms after data is locally available; p95 indexed API read under 800 ms at defined pilot concurrency; no unbounded request or upload payloads. Targets must be measured, not asserted without tests.
- Capacity should scale via indexes, projections, pagination, bounded queues, media delivery/caching, and stateless backend behavior before introducing complex additional infrastructure.

### 2.6 Cost control as a reliability requirement

- Set explicit per-IP, per-account, per-endpoint, and application-wide quotas for costly operations. Set different budgets for reads, sign-up, listing publication, upload bytes/objects, media delivery exposure, geocoding, email, and chat sends.
- Enforce upload reservations and maximum sizes/counts **before** issuing object-storage authorization; verify actual stored objects and reconcile abandoned reservations.
- Define both a **soft warning threshold** and **hard refusal threshold** for global budgets. At a hard threshold, expensive actions fail closed with useful retry/error UX; cached reads and local drafts should continue where safe.
- Use provider-side hard caps or shutoff capabilities wherever available. Billing alerts are not spending limits; an external service without effective spending constraints requires documented accepted risk or a safer alternative.
- Make quotas and feature flags remotely configurable. Provide separate kill switches for sign-ups, new listings, media uploads, expensive lookup APIs, and chat sends. A disabled operation must not drain retries indefinitely.
- Every third-party dependency must have a cost assessment: free allowance, billable dimensions, hard-cap behavior, abuse exposure, and exit strategy. No assumption of a guaranteed $0 public launch solely because a provider advertises a free tier.
- Enforce app API budgets **without creating a single shared rate limit that makes chat unusable**. Use endpoint-aware budgets and prioritize essential communication over nonessential refreshes.

### 2.7 Quality, observability, accessibility, and maintainability

- Follow current repository structure and naming. Extend existing modules/contracts intentionally; avoid duplicate parallel implementations unless temporarily needed for migration.
- Require unit, integration, and critical mobile behavioral tests, including negative authorization and failure recovery. Mocking the API alone is insufficient for database atomicity or geospatial behavior.
- Keep existing lint, formatting, builds, shared/backend/mobile type checks, automated tests, and platform export checks green. Add migration, index, and compatibility tests when persistence contracts change.
- Use structured, redacted logs with correlation IDs, operation IDs, safe error codes, and metrics for sync lag/failures, upload failures, rate-limits, message delivery delay, and quota exhaustion. Never log credentials, precise private coordinates, raw message content, or payment secrets.
- UI must provide accessible labels, readable contrast, resilient keyboard behavior, clear pending/error states, and alternatives when permissions are denied. Verify basic screen-reader navigation and dynamic text sizing.
- Document configuration, required indexes, operational recovery, data retention, feature flags, and external-service assumptions in the appropriate repository documentation.
- Every feature must be secure and usable **with an empty dataset**, a partially populated dataset, an offline device, and an expired session.

---

## 3. Current technical baseline and migration constraints

**Observed GitHub `master` snapshot:** `ab9d099be477e6da5680fe0432bef8437555777a`, inspected November 2, 2026. This snapshot is a planning reference, not a declaration that its tests were executed in this document's preparation.

**Already present (preserve where sound):**

- Express backend with TypeScript, MongoDB/Mongoose, shared Zod contracts, authentication, email verification, token refresh/recovery, and MongoDB-backed authentication rate limits.
- Product CRUD routes and a bounded, cursor-paginated product list; seller-specific listings, product model, and request/response schemas.
- Expo/React Native application with authentication screens, secure token storage, authenticated API client, session recovery, navigation, basic profile screen, and a shared styling system.
- Backend/mobile automated tests, repository verification workflow, type checking, linting, and platform export checks.

**Not yet evidenced in that snapshot:** unified product/service listings, location-first search, SQLite marketplace persistence, durable marketplace sync, image-upload infrastructure, usable browse/feed and creation screens, favorites, or functioning conversation endpoints/screens. The Browse and Chats tabs are placeholders.

**Migration implications:**

1. **Do not discard the existing product work.** Introduce the unified Listing model through an explicit compatibility/migration strategy; map existing products into `type = product`, backfill new fields as needed, and plan any old-route sunset.
2. **Preserve auth and existing test coverage.** Authentication and token storage have already received substantial hardening. Extend only where a new feature creates a concrete need.
3. **Evolve cursor semantics.** Existing product pagination is chronological; geographically filtered/product-and-service discovery needs query-bound cursors and carefully defined sort behavior.
4. **Extend required-index management.** New listing, geo, favorites, chat, and outbox-supporting server indexes must be represented in the existing index provisioning/verification path.
5. **Avoid premature rewrites.** Retain React Navigation and Redux auth unless there is a measured limitation. SQLite should be introduced for the marketplace rather than replacing functioning authentication infrastructure.
6. **Treat local work as newer if applicable.** Before performing a migration, compare against the actual working tree and preserve any uncommitted changes.

---

## 4. Canonical domain and interaction rules

### 4.1 Shared Listing model

A published listing is one of exactly two discriminated types: `product` or `service`. Prefer a common Listing aggregate with type-specific validated details; the concrete MongoDB implementation (single collection plus discriminated schema, or equivalent) is an architectural decision to confirm before migration.

**Common server-owned fields:** `id`, `ownerId`, `type`, `status`, `moderationStatus`, `createdAt`, `publishedAt`, `updatedAt`, `revision`, visibility and idempotency metadata.  
**Common content fields:** title, description, curated category, cover media, ordered media references, public geographic metadata.  
**Client operation fields:** `clientId` for locally created drafts/requests; stable operation IDs for retryable writes. These are not a substitute for server IDs or authorization.

| Concern          | Product                                                     | Service                                                                                |
| ---------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Core subject     | A particular physical item                                  | Repeatable work, expertise, or a service business                                      |
| Price            | Currency + integer minor units; explicit free-item decision | `fixed`, `hourly`, `starting_at`, `quote`; amount only when appropriate                |
| Distinct fields  | Condition, item availability, price history                 | Specialty, provider/business name, delivery mode, service radius, availability summary |
| Location meaning | Approximate location of item                                | General provider area plus geographic coverage; not necessarily exact base address     |
| Lifecycle        | Draft/pending → active → reserved/sold → archived           | Draft/pending → active ↔ paused → archived                                             |
| Contact CTA      | **Message Seller**                                          | **Contact Provider / Request Quote**                                                   |

**Status separation:** Local `draft` and `pending_sync` are not necessarily public server statuses. Keep public listing lifecycle, moderation/visibility, and local synchronization state distinct. Only the backend can confer public `active` or `sold` status.

**Price and dates:** Product price history is append-only/server-generated for relevant price changes, with currency and precision consistent. A discount display must refer to actual previously published price; never fabricate a reduction from an unverified client claim. All public time labels clearly distinguish _listed_, _updated_, and _price changed_.

### 4.2 Location model and privacy contract

- **Market selection:** Searcher's chosen area center, readable label, source (`manual`, `device`, `map`), radius, and saved preferences. The preference is local; raw precise history is not needed.
- **Product public location:** Generalized, intentionally lower-precision point plus area label and precision metadata. Private address/location, if ever needed, is separately stored and never part of a public DTO.
- **Service coverage:** Generalized base point and bounded radius for V1, plus `at_customer`, `at_provider`, or `both`. Explicitly state whether provider-address display is consented or replaced by an area label.
- **Meetup:** Optional, explicitly chosen public place distinct from product and provider locations. Do not assume a map marker denotes a residence.
- **GeoJSON coordinate order:** `[longitude, latitude]`; validate boundaries, requested search radius, and location metadata on the backend.

### 4.3 Conversation model

- A P0 conversation is associated with a **listing**, exactly one buyer, and that listing's seller/provider. One buyer–owner thread per listing is the default for V1; create/get must be idempotent. A seller cannot open a buyer conversation with themselves.
- Messages are immutable text records once server-accepted, with server ID, client message ID, author, created timestamp, and deterministic ordering. Message deletion/moderation is an explicit later operation, not silent mutation.
- The device distinguishes `queued_local`, `sending`, `sent_server`, and `failed` states. Only server persistence merits a sent/accepted state; neither server acceptance nor a push acknowledgment proves the recipient read the message.
- A listing becoming sold, paused, or archived does not automatically erase authorized conversation history. Blocking/moderation may restrict new sends while preserving lawful/history access as policy permits.
- Conversation participants and the server's moderation logic are the only authorized readers. Never expose thread discovery to arbitrary users.

### 4.4 Core user journeys

1. **Buyer:** Select location → choose All/Products/Services → browse indexed nearby results → view detail → favorite/share → send inquiry → receive response.
2. **Product seller:** Register/verify → compose a product offline → add local photos → select approximate item area → publish when connected → edit/status change → respond to buyer.
3. **Service provider:** Register/verify → define service offering, pricing model, general base area, and coverage radius → publish → receive quote inquiries → pause/reactivate offering.
4. **Offline recovery:** Browse cached local results → prepare or edit drafts → queue supported writes and messages → restart or reconnect → synchronize without duplicates → reconcile server state and conflicts.
5. **Cost exhaustion:** Provider or app quota approaches limit → warning and metric → expensive operation is refused once the limit is reached → local state remains intact → user receives actionable feedback.

---

## 5. Ordered implementation map

The sequence is ordered by **technical dependency** and progressive end-to-end value. A feature is not complete merely because its backend or UI component exists; it is complete when its acceptance criteria pass.

| Order | ID      | Priority | Feature                                                 | Prerequisites                 | Primary milestone                 |
| ----: | ------- | -------- | ------------------------------------------------------- | ----------------------------- | --------------------------------- |
|     1 | F00     | P0       | Baseline stabilization and engineering gates            | Existing repository           | Safe baseline                     |
|     2 | F01     | P0       | Global quotas, budget enforcement, operational controls | F00                           | No unbounded billable usage paths |
|     3 | F02     | P0       | Unified Product/Service listing domain and migration    | F00–F01                       | Stable shared contracts           |
|     4 | F03     | P0       | Market location selection and location privacy          | F02                           | Saved search-area context         |
|     5 | F04     | P0       | Geographic discovery APIs and pagination                | F02–F03                       | Correct nearby results            |
|     6 | F05     | P0       | SQLite offline foundation and sync contracts            | F00, F02                      | Durable local data and operations |
|     7 | F06     | P0       | Local-first feed, filtering, and browsing               | F03–F05                       | Usable nearby marketplace feed    |
|     8 | F07     | P0       | Listing details and public seller/provider profiles     | F02, F05–F06                  | Buyer can evaluate listings       |
|     9 | F08     | P0       | Photo media lifecycle and controlled storage            | F01–F02                       | Secure image attachment pipeline  |
|    10 | F09     | P0       | Product creation and offline publication                | F05, F07–F08                  | End-to-end product sale listing   |
|    11 | F10     | P0       | Service creation and service-area management            | F04–F05, F08–F09              | End-to-end service advertisement  |
|    12 | F11     | P0       | My Listings, status changes, edits, and conflicts       | F09–F10                       | Seller-controlled lifecycle       |
|    13 | F12     | P0       | Favorites, Saved listings, and account sync             | F05–F07                       | Durable buyer collections         |
|    14 | F13     | P0       | Authorized conversations and message backend            | F02, F07, F01                 | Durable two-way server chat       |
|    15 | F14     | P0       | Chat screens, offline outbox, incoming sync             | F05, F13                      | Working buyer–seller conversation |
|    16 | F15     | P0       | Unread awareness and new-message notifications          | F13–F14, F01                  | Recipient can notice replies      |
|    17 | F16     | P0       | Trust, reporting, blocking, moderation essentials       | F02, F13–F15                  | Safe public contact and content   |
|    18 | F17     | P0       | Native sharing and deep-link navigation                 | F07, F13                      | Reachable, correctly gated links  |
|    19 | F18     | P0       | End-to-end release hardening and deployment             | All P0                        | Public-launch acceptance          |
|    20 | F19–F23 | P1       | Maps, video, search, richer chat, business tools        | Relevant P0 features          | Expansion without core rewrites   |
|    21 | F24–F26 | P2       | Pro subscriptions, credits, boosted placement           | Stable P0, cost/abuse metrics | Future monetization               |

**Parallelism:** F13 backend chat can begin while F09–F11 listing UIs are being built once the Listing contract is stable; F12 can proceed alongside publication. F16 must have a design early, but its final integration occurs after chat and listings. Do not let parallel efforts create incompatible DTOs or duplicate local storage layers.

---

## 6. P0: Core launch features, in implementation order

### F00 — Stabilize existing foundation and quality gates

**Goal:** Make current behavior a dependable foundation without unnecessarily rebuilding authentication, navigation, product CRUD, or CI.

**Dependencies:** Existing codebase. **Deliverables:** documented baseline, agreed API conventions, green verification pipeline, migration safety net.

**Functional requirements**

- Verify registration, email verification and resend, login, refresh/recovery, logout, protected routes, app session restore, and user profile projection end to end.
- Preserve current product CRUD and pagination while future listing contracts are introduced; identify and repair observable correctness/security defects before relying on these paths.
- Define an API response/error envelope, request identifiers, and a consistent policy for authentication failures and retryable requests.
- Confirm reproducible local setup, required environment variables, index verification, database migration workflow, and separate dev/test/prod configuration.
- Establish repeatable backend integration tests and mobile behavior tests, with CI checks on each change.

**Non-functional requirements and considerations**

- Security: secret hygiene, least privilege, redacted logs, stable proxy/client IP configuration, production HTTPS.
- Maintainability: minimal overlap with existing authentication components; no speculative dependency or navigation rewrite.
- Reliability: test network retry, concurrent refresh, resends, token expiry, and app restart; ensure production index provisioning has a rollback procedure.
- Compatibility: existing authenticated users and product records must not become unusable through later migrations.

**Acceptance criteria**

- [ ] Defined repository verification commands pass in CI and on a clean development environment.
- [ ] Authentication/session critical paths have passing negative, concurrency, and restart tests.
- [ ] Required MongoDB indexes are provisioned/verified without destructive silent replacement.
- [ ] Remaining baseline defects and migration risks have explicit disposition; no open critical security issue is accepted implicitly.

### F01 — Resource quotas, abuse limits, and operational cost boundaries

**Goal:** Ensure future marketplace features cannot create unrestricted billable traffic or storage usage before monetization exists.

**Dependencies:** F00. **Deliverables:** centralized policy, atomic quota primitives, global budgets, feature shutoffs, monitoring.

**Functional requirements**

- Configure quota policies by operation class: authentication, feed reads, search, uploads, active listings, favorites, chat sends, geocoding, outbound emails, and external notifications.
- Track per-user, per-IP, and global allowances where relevant. Distinguish **burst rate**, **rolling/day allowance**, **concurrent resource count**, and **stored-byte balance**.
- Return meaningful 429/limit responses with a retry hint when appropriate. Distinguish an exhausted user allotment from a feature disabled by the platform.
- Add atomic reservation/reconciliation mechanisms for limited resources (e.g., pending uploads or new listing slots) so parallel requests cannot exceed capacity.
- Introduce remote/configurable feature switches and global stop conditions for registrations, new listings, uploads, expensive location calls, and messaging.
- Capture metrics and warnings before global thresholds, with operator-visible reasons for quota rejections.

**Initial policy proposals — configurable, not final pricing/entitlements**

| Resource                   | Proposed starter limit                                                          | Enforcement                                                        |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Active product listings    | 10/account                                                                      | Atomic server-side count/reservation                               |
| Active service listings    | 3/account                                                                       | Atomic server-side count/reservation                               |
| New published listings     | 2/account/day                                                                   | Account quota and idempotent publication                           |
| Images                     | 5/listing; compressed client target ≤1 MB each                                  | Client compression and server/object validation                    |
| Video                      | Disabled P0                                                                     | Feature flag and no authorized video uploads                       |
| Favorites                  | 100/account                                                                     | Unique key + capped active set                                     |
| General authenticated API  | Starting policy around 60 requests/minute/account, endpoint-adjusted            | Shared distributed limiter; separate chat budget                   |
| Location provider requests | Up to 10/account/day for **paid** lookup calls                                  | Cache and adapter-level spend cap                                  |
| Verification email         | Existing auth limits plus global send budget                                    | Per-account/IP/global policies                                     |
| Messages                   | Starting policy around 30 new messages/account/day, with a separate burst limit | Must not block message reading or reasonable replies unnecessarily |

**Non-functional requirements and considerations**

- Cost: verify every hosting, media, database, geocoding, mail, and push plan for true hard stops. Avoid direct client access to billable provider credentials.
- Concurrency: multiple backend instances and simultaneous uploads must not bypass counters. Counters' TTL deletion is cleanup, not an exact enforcement primitive.
- Resilience: failure to check a critical quota must not permit an unbounded expensive action; allow harmless cached/local operations to continue.
- UX: queued offline operations remain visible if quota exhaustion prevents synchronization; permanent-limit errors must not enter infinite retry loops.
- Observability: log safe quota dimensions and capacity remaining; avoid storing precise location or private payloads in metrics.

**Acceptance criteria**

- [ ] Concurrent requests cannot exceed a limited listing slot, credit-like unit, upload budget, or email/send quota.
- [ ] Exceeding a limit produces a stable API code and understandable mobile feedback.
- [ ] Emergency switches block new costly operations without corrupting existing data or already-published content.
- [ ] Provider limits, expected billable dimensions, alert channels, and fallback behavior are documented and tested.
- [ ] A failed external integration cannot trigger unlimited retries or uploads.

### F02 — Unified Listing domain, validation, and backward-compatible migration

**Goal:** Replace product-only assumptions with a common marketplace Listing concept while preserving existing data and behavior.

**Dependencies:** F00–F01. **Deliverables:** discriminated domain schema, server model, APIs, ownership rules, explicit migration.

**Functional requirements**

- Define `Listing(type: product | service)` with common identity, owner, title, description, category, ordered images, public location, timestamps, revision, moderation state, and lifecycle state.
- Define product details: integer price minor units/currency, condition, price history, general item location, optional public meetup, availability/reservation/sold state.
- Define service details: pricing model (`fixed`, `hourly`, `starting_at`, `quote`), conditional amount, provider label, delivery mode, bounded service radius, and availability summary.
- Maintain server-assigned owner, timestamps, publication and status transitions, and audit-safe updates; reject attempts to mutate server-controlled fields.
- Create explicit response schemas for listing summaries, listing details, create/update requests, and distinct public/owner views.
- Introduce listing APIs (proposed base `/api/v1/listings`) and a compatibility path for existing `/products`; migrate/backfill old product data without silent deletion.
- Define category taxonomy, condition/pricing enumerations, and rules for required photos/prices before publication. Server drafts and client drafts may have different validation requirements.

**Non-functional requirements and considerations**

- Data integrity: clear unique IDs, revision semantics, lifecycle transitions, and preservation of price history.
- Scalability: common indexes for owner, lifecycle, type, publish date, category; partial/index design informed by actual queries.
- Migration: test old-data transformation, re-running migration, indexing, error recovery, and old API consumers.
- Extensibility: common features must operate on both listing types without `if product` branches dispersed across every subsystem.
- Avoid imposing `sold`, physical condition, or exact item pickup location on services.

**Acceptance criteria**

- [ ] Invalid type-field combinations and unauthorized owner/status edits are rejected.
- [ ] Migrated product records remain readable and retain ownership/identity.
- [ ] Product and service summary/detail schemas round-trip through real backend persistence.
- [ ] Updates honor revision checks; concurrent stale writes are detected, not silently overwritten.
- [ ] Existing product API behavior has an explicit tested compatibility or retirement decision.

### F03 — Marketplace area selection, permission handling, and location privacy

**Goal:** Give users a stable, understandable marketplace area without requiring device-location permission.

**Dependencies:** F02. **Deliverables:** location preference model, manual picker, one-time GPS action, privacy-safe representation.

**Functional requirements**

- Let a user select city/ZIP/area manually and explicitly choose **Use My Current Location**. Optional map-pin selection can be introduced later without changing the model.
- Request foreground location permission contextually; handle denied, revoked, approximate-only, unavailable, and timed-out positions.
- Display selected area prominently; let users change area and search radius (initial proposals: 5, 10, 25, 50 miles).
- Persist area, source, center, and radius across restarts; never silently replace a manual selection with device GPS.
- Normalize an area's public display label and center coordinates. Define what happens if a ZIP resolves to multiple places or geocoding is unavailable.
- Keep device position, chosen search center, seller's listing area, and public meetup point separate in models and APIs.

**Non-functional requirements and considerations**

- Privacy: explicit consent, no background tracking, no unnecessary precise-location history, safe log redaction.
- Cost: manual location lookup and geocoding must be cached/bounded; never send paid lookups for every keystroke without throttling.
- Offline: previously selected area can be reused or changed among known saved areas without networking.
- UX: clear states when GPS is unavailable; manual area fallback must always exist.

**Acceptance criteria**

- [ ] Denying location permission does not block browsing via manual selection.
- [ ] Manual selection persists through restart, session restore, and reconnect; device updates do not override it.
- [ ] Selected search center/radius are valid and used consistently in downstream requests.
- [ ] Sensitive device coordinates are not included in public listing/profile DTOs or telemetry.

### F04 — Geographic listing search and service-coverage matching

**Goal:** Return locally relevant, paginated products and services with correct geographic semantics.

**Dependencies:** F02–F03. **Deliverables:** indexed geospatial queries, search contracts, pagination, service matching rules.

**Functional requirements**

- Query active, publicly visible products whose **generalized item location** falls within the user's search area/radius.
- Query active services whose **coverage includes the buyer's selected location**. Define separate, explicit behavior if a later search mode uses _intersection with a searched region_.
- Support `all`, `product`, and `service` feed modes, category/condition/pricing filters, radius, and deterministic sorting (newest, relevant proximity where meaningful).
- Return bounded summary data including public area, approximate distance or service area, thumbnail, pricing summary, and cursor metadata.
- Use stable, scoped pagination across type, geographic center/radius, category, sorting, and visibility; reject mismatched or malformed cursors.
- Handle zero results and radius expansion explicitly. Never quietly widen the user's chosen distance.
- Exclude sold, paused, archived, moderated, or otherwise nonpublic listings according to a documented status policy.

**Non-functional requirements and considerations**

- Index design: MongoDB GeoJSON `2dsphere` indexing for points; **service-radius coverage queries may require bounded candidate selection and post-filtering** rather than naïvely applying `$near` to provider base points.
- Scalability: geographic filters, count limits, index plans, and cursor integrity verified with realistic skewed geographic datasets. Avoid cross-collection fan-outs and N+1 profiles.
- Privacy: distance precision matches generalized location accuracy; never leak private coordinates through sort or detailed response.
- Consistency: tie-break on stable IDs, handle newly inserted listings between pages, and bind cursor to actual request context.
- Cost: no unconstrained geocoding or third-party map call in the critical query path.

**Acceptance criteria**

- [ ] Items just inside/outside radius boundaries are correctly included/excluded.
- [ ] A service can be discoverable when its base is outside the buyer's product radius but its declared coverage includes the buyer.
- [ ] Incompatible cursors and unreasonable radii fail safely.
- [ ] Pagination has no unintended duplicates or gaps under fixed snapshot data; index plans avoid full-collection scans for common queries.
- [ ] Public response location cannot disclose a private residence.

### F05 — SQLite persistence, local-first repositories, and durable operation queue

**Goal:** Make offline behavior a deliberate system property before implementing dependent marketplace screens.

**Dependencies:** F00, F02; align with F04 query contract. **Deliverables:** local schema/migrations, repository APIs, cache policy, outbox and sync core.

**Functional requirements**

- Store listing summaries/details, public profile summaries, query-result membership/coverage, selected area, account favorites, owned drafts, media references, conversations/messages, and synchronization checkpoints in versioned SQLite tables as needed.
- Define repository read/observe methods that supply locally persisted state to screens; network responses update SQLite transactionally.
- Implement query-scoped feed caching keyed by market center/area, radius, type, filters, and sort; distinguish stale/incomplete results and deletion/eviction.
- Implement an outbox record with operation ID, account, target/clientId, payload, dependency IDs, state, retry count, next retry, last error, and creation time.
- Provide startup/foreground/reconnect synchronization, exponential retry with jitter, idempotent replay, and operation ordering. Model permanent errors and conflicts separately from transient failures.
- Handle auth expiry, account switching, sign-out, crash after remote success, duplicate server responses, out-of-order updates, schema migration, and storage exhaustion.
- Define scoped inbound sync/cursors for account-owned entities (favorites, own listings, inbox/messages) and invalidation for deleted data. Do not globally download all public marketplace listings.

**Non-functional requirements and considerations**

- Durability: local edit/queue persistence must complete before showing that a user action was safely saved.
- Data isolation: separate per-user records and outgoing operations; logout must not display another account's cached private data.
- Idempotency: server and client cooperate on stable operation IDs; a network timeout after a server success must not create a second resource.
- Performance: bounded storage, index-backed local queries, transactional cache updates; prefetch only within sensible limits.
- Media lifetime: pending upload files are durable; cached thumbnails are evictable, with predictable limits.
- Operational simplicity: support foreground-driven sync; background sync is opportunistic, never relied upon for correctness.

**Acceptance criteria**

- [ ] Cached detail/feed can be viewed with networking disabled after process restart.
- [ ] A queued operation survives process death and can be safely retried after reconnection, without duplicating server records.
- [ ] A stale server revision produces a recoverable conflict rather than silent local data loss.
- [ ] Different user accounts cannot access each other's private cache or outbox.
- [ ] Changing location offline never presents old-area results as a complete new-area feed.
- [ ] Local schema migrations are tested against at least one populated earlier-version database.

### F06 — Nearby feed, discovery controls, and cached browsing

**Goal:** Make the home screen a usable location-aware marketplace for both listing types.

**Dependencies:** F03–F05. **Deliverables:** All/Products/Services feed, summary cards, paging UX, local-first rendering.

**Functional requirements**

- Replace the placeholder Browse screen with a location header, radius control, and `All / Products / Services` selection.
- Display product cards with cover thumbnail, title, price, general area/approximate distance, date listed, short description, and favorite affordance.
- Display service cards with cover, service title, provider/business label, service area, price model summary, category, short description, and favorite affordance.
- Provide coherent states for initial load, empty search, partial cached results, offline, transient error, and quota-limited refresh.
- Support cursor pagination, pull-to-refresh, incremental loading, preserved scroll position, and explicit expansion of geographic search radius.
- Persist received summaries in SQLite. Render cached records first, refresh when online, and mark potentially outdated data rather than claiming live availability.
- Add initial filters (type, category, product condition, price/pricing model where supported) and sorting options that have matching server semantics.

**Non-functional requirements and considerations**

- Performance: virtualized list rendering, stable keys, bounded pagination, efficient image recycling, lightweight DTOs, and no per-card geocoding calls.
- Correctness: different query contexts maintain distinct cache membership; changing filters or radius resets the server continuation cursor.
- UX: do not mix placeholders into real listing counts; show stale/last-updated hints when relevant; accessible controls and useful empty messages.
- Resilience: use cached summaries during network failure, but do not promise that all nearby listings are available offline.
- Reuse: product and service cards should share primitives without forcing incorrect identical presentation.

**Acceptance criteria**

- [ ] A user can browse separate Product, Service, and combined feeds using a chosen location.
- [ ] Returning to a previously viewed area offline shows available cached results with an explicit freshness limitation.
- [ ] Pagination, sorting, and filters return the same scope as the active UI state; list rows do not duplicate because of unstable keys.
- [ ] Long lists scroll smoothly on agreed low-end reference devices and do not load full-resolution media unnecessarily.

### F07 — Listing details and public seller/provider profiles

**Goal:** Give buyers enough verified information to evaluate a listing and identify its owner, without exposing private account data.

**Dependencies:** F02, F05–F06. **Deliverables:** typed detail screens, public profile DTOs, navigation paths.

**Functional requirements**

- Load product and service details by stable listing ID; persist details in SQLite for offline revisits.
- Product details show title, full description, ordered photo gallery, price/currency, condition, category, availability, listed/updated dates, approximate area, and server-derived reduction history when present.
- Service details show scope/description, category, provider/business name, portfolio photos, pricing model, availability summary, delivery mode, and geographic service area.
- Show a clickable public owner profile: display name, optional public image, member-since date, optional business description, and active listings; only expose explicitly public fields.
- Provide actions for save, share, report, and contact. Contact opens the relevant listing-specific conversation after F13–F14 are delivered; do not ship a fake functional button beforehand.
- Handle removed, moderated, expired, sold, paused, and temporarily unavailable content with correct status messaging; owner view may retain management information not visible to other users.
- Present cached content with an explicit freshness indicator when availability or price might have changed.

**Non-functional requirements and considerations**

- Privacy: public profile endpoints must never return email, token/session state, private home location, or private moderation details.
- Performance: paginate a provider's other listings and avoid one request per media or owner field.
- Accessibility: media descriptions/labels, clear CTA wording, useful empty/failure states.
- Consistency: details reflect server-owned price history, revision, published and modified timestamps.

**Acceptance criteria**

- [ ] Both listing types render all applicable fields without leaking irrelevant fields (e.g., product condition on a service).
- [ ] A previously opened detail remains readable offline with a stale-data indication.
- [ ] Public profile responses expose only allowlisted fields; tests assert forbidden properties are absent.
- [ ] Deleted/moderated/archived listings have a defined and tested behavior for old links and cached views.

### F08 — Photo selection, optimization, secure upload, and storage lifecycle

**Goal:** Support image-backed listings without creating uncontrolled storage or bandwidth expense.

**Dependencies:** F01–F02, aligned with F05. **Deliverables:** local media pipeline, storage adapter, authorized upload and finalization.

**Functional requirements**

- Allow selecting up to **five** images per listing, reordering them, picking a cover, removing/replacing media, and previewing before publication.
- Copy selected images to persistent app-owned storage for drafts; avoid depending on expiring photo-picker URIs.
- Apply orientation handling, reasonable compression, and thumbnail generation with a documented quality/size trade-off.
- Obtain short-lived, scoped upload authorization from backend; upload directly to object storage only after authenticated quota reservation.
- Finalize/attach an uploaded object only after backend verifies ownership, type, size, permitted listing association, and storage existence.
- Preserve local media through network interruption and restart; queue/retry appropriately, track progress, and clean orphaned or abandoned uploads.
- Serve appropriately sized thumbnail/display variants; ensure public fetch paths cannot grant unauthorized upload or write access.

**Non-functional requirements and considerations**

- Cost: per-image, per-listing, per-account, and total storage quotas; request/byte/egress budget where provider supports it; no unlimited public asset-generation endpoint.
- Security: check actual content type/signature and decodeability rather than trusting filenames or MIME headers; strip EXIF/GPS metadata; handle malicious media and invalid references safely.
- Data integrity: a failed upload cannot publish a listing referencing nonexistent objects; retry must not duplicate attachments or count bytes twice.
- Performance: upload work must not block the main UI; favor thumbnails for feeds, bounded local caches and content-aware cleanup.
- Provider choice remains open until hard-spend safeguards and access policies are verified. **Video remains disabled for P0**.

**Acceptance criteria**

- [ ] Five photos, cover reorder, local restart, and eventual successful publication work end to end.
- [ ] Wrong type, oversized file, forged object reference, and unauthorized upload/attach attempts are rejected.
- [ ] Upload interruption and retry do not create duplicate media references or leak indefinite storage reservations.
- [ ] Public image variants do not include GPS/EXIF coordinates, and normal cache eviction does not remove unsynced draft media.
- [ ] A global upload shutdown prevents new billable uploads while preserving local drafts.

### F09 — Product listing creation, offline drafts, and publication

**Goal:** Let users publish real physical products, starting offline if necessary.

**Dependencies:** F05, F07–F08, F02, F03. **Deliverables:** product form, local drafts, publication workflow, server mutation.

**Functional requirements**

- Implement **Sell a Product** entry point with required title, description, category, condition, price/currency (unless explicitly designated Free), and general public location.
- Support image selection/reordering, cover preview, validation help, and save/continue draft with no network connection.
- Default proposed item area from the selected marketplace location while permitting each listing to use a different area. Show exactly what location information will become public.
- Separate local draft save from publish. Publish queues an operation whose dependencies include valid uploaded media and an available listing slot.
- Generate a client UUID and idempotency key; map to the eventual server listing ID. Show `pending`, `uploading`, `publishing`, `active`, `failed`, and `needs action` states.
- Enforce server-side validation, ownership, media maximums, quotas, lifecycle transitions, and price precision. Server confirmation is required before public discoverability.
- Preserve inputs on validation error or permanent upload failure; allow canceling an unsent publication with safe cleanup.

**Non-functional requirements and considerations**

- Reliability: no lost drafts during backgrounding, app restart, transient errors, or server timeout after commit.
- Validation: clear distinction between incomplete local drafts and publish-ready records; never require all fields just to save a draft.
- Consistency: server price is canonical; `publishedAt` is server-assigned; no client-controlled seller ID.
- Cost: publication and media reservations atomically respect account/global limits; retries must not create additional published items.
- Accessibility: usable keyboard/navigation, field-specific validation, obvious save/publish actions.

**Acceptance criteria**

- [ ] Create a complete product draft while offline, terminate the app, reopen it, and recover all text and images.
- [ ] Publish on reconnection; the listing becomes visible in nearby search **exactly once**.
- [ ] A failed validation, exhausted quota, interrupted upload, or auth expiry leaves recoverable local state with actionable feedback.
- [ ] A second account cannot edit or publish a draft/listing belonging to the first account.

### F10 — Service advertising, coverage, pricing, and pause/reactivation

**Goal:** Provide a genuine local services marketplace rather than treating services as products with different labels.

**Dependencies:** F02–F05, F08–F09. **Deliverables:** service form, service coverage validation, publication and detail integration.

**Functional requirements**

- Implement **Offer a Service** creation flow with title, description, curated service category, optional specialty, provider/business display label, general location, and portfolio images.
- Support pricing modes: `fixed`, `hourly`, `starting_at`, and `request_quote`; require an amount only for modes needing one, and clearly distinguish rate units/currency.
- Define service delivery (`at_customer`, `at_provider`, `both`) and a bounded initial coverage radius around a generalized area; show the coverage users will see.
- Support provider availability as a simple description or coarse schedule without building a booking/calendar engine.
- Save service drafts offline; publish with the same durable upload, idempotency, and quota semantics as products.
- Permit service `active`, `paused`, and `archived` transitions. Do not present `sold` or physical-item condition for services.
- Display matching services when the buyer's location is inside provider coverage, even when the provider's base point is outside a buyer's ordinary product-search radius.

**Non-functional requirements and considerations**

- Geo correctness: do not claim exact arrival time/travel distance solely from straight-line radius; be explicit about coverage approximations.
- Privacy: a home-based provider's base point must not disclose their residence; optional public business address requires consent.
- Data model: shared listing machinery, type-specific validation, and reusable media/offline infrastructure.
- Abuse: prohibited or regulated service categories must have published rules; avoid representing certifications/licensing as verified without actual verification.
- Scope: service listing is an advertisement/inquiry entry, **not an appointment, payment, or quote-calculation system**.

**Acceptance criteria**

- [ ] All pricing models validate and render correctly, including quote-only without a numeric price.
- [ ] Service coverage boundary and matching rules pass indexed backend integration tests.
- [ ] Offline creation/retry publishes one service with no lost portfolio photos.
- [ ] Paused services disappear from public search but remain manageable by their owner.
- [ ] No private provider address appears in public DTOs.

### F11 — My Listings, editing, status management, and conflict handling

**Goal:** Give sellers durable control of their advertised products and services across devices and network states.

**Dependencies:** F09–F10, F05. **Deliverables:** My Listings screens, edit paths, status transitions, conflict UX.

**Functional requirements**

- Provide one **My Listings** destination with filters for Product/Service, local drafts, pending publication, active, paused/reserved/sold, and archived.
- Allow owners to edit title, description, category, appropriate price fields, photo order, general item location, and service coverage/availability where applicable.
- Support status changes: product reserve, unreserve, mark sold, archive; service pause, reactivate, archive. Define which changes may be reversed and which require a new listing.
- Queue allowed edits and status changes offline with revision preconditions, preserve original server state, and show pending status.
- On revision conflicts, preserve local edits separately and offer explicit resolution (discard/reapply/manual review); never silently overwrite another device's changes.
- Ensure status changes invalidate relevant feeds, detail caches, favorites displays, and chat action availability.
- Keep server-recorded product price history when editing prices and avoid contradictory price or currency rules.

**Non-functional requirements and considerations**

- Concurrency: atomic conditional updates include authenticated owner ID and expected revision.
- Integrity: queued updates must not allow invalid transitions (e.g., selling an archived or deleted record).
- Privacy: sellers may see extra management fields, but no client should infer that they can write them by copying DTOs.
- Reliability: preserve unsynced local edits through restart and failure; avoid reordering incompatible operations.
- Cost: status updates and publishing enforce quota/state limits consistently across concurrent devices.

**Acceptance criteria**

- [ ] Owner can manage both listing types; a non-owner's edit/archive attempts fail.
- [ ] A changed listing syncs across two devices and search results eventually reflect its correct status.
- [ ] A forced simultaneous-edit conflict retains the offline edit for recovery, instead of losing either change silently.
- [ ] Product price reductions are derived from authenticated server-side price changes.

### F12 — Favorites, Saved listings, and basic account synchronization

**Goal:** Let buyers remember products and services with immediate offline feedback and reliable cross-device reconciliation.

**Dependencies:** F05–F07, F01. **Deliverables:** favorites collection, saved screen, idempotent toggles, sync.

**Functional requirements**

- Add favorite/unfavorite to cards and detail screens for both listing types, with an accessible and consistent visual state.
- Provide a **Saved** screen containing paginated saved listings, optionally filtered by Product/Service and showing current availability.
- Persist account-scoped favorite state in SQLite and apply optimistic updates when offline or online.
- Coalesce repeated offline toggles to the user's final desired state instead of replaying every tap.
- Maintain a server-enforced unique `(userId, listingId)` relationship; writes are idempotent.
- Reconcile removals, deleted listings, paused/sold status, expired sessions, and account changes without losing useful cached context.

**Non-functional requirements and considerations**

- Strong ownership/privacy: one user must not read another's private favorites.
- Concurrency: out-of-order server responses must not reverse a newer local intent.
- Scale: paginated saved data and indexed uniqueness, no unbounded fan-out to fetch listing details.
- Cost: favorite quotas should be enforced at state transition, not per network retry.

**Acceptance criteria**

- [ ] Favorites persist across app restarts and synchronize across two devices.
- [ ] Rapid on/off toggles while offline produce the expected final server state, without duplicates.
- [ ] User/account switching does not reveal another user's saved collection.
- [ ] Saving an unavailable listing follows a documented UX and stale-cache policy.

### F13 — Secure conversation backend and listing-linked inquiries

**Goal:** Support persistent, authorized two-way text communication between a buyer and the owner of a product or service listing.

**Dependencies:** F02, F07, F01; aligned with F05 sync contracts. **Deliverables:** conversations/messages domain, persistence, APIs, authorization, indexes, anti-spam rules.

**Functional requirements**

- Define conversation identity by listing, buyer, and seller/provider; creating a thread repeatedly returns the same authorized conversation. Prevent users from opening threads with themselves.
- Provide authenticated endpoints (illustrative, subject to API contract review):
  - `POST /listings/:id/conversations` — create or retrieve thread with an optional initial inquiry.
  - `GET /conversations` — paginated participant inbox with unread summary.
  - `GET /conversations/:id/messages` — paginated, deterministically ordered history.
  - `POST /conversations/:id/messages` — idempotent text send.
  - `POST /conversations/:id/read` — advance this participant's read position.
- Allow product buyer messages and service quote inquiries through the **same reliable text conversation domain**. A quote request is initially a message, not a separate booking workflow.
- Persist message author, participant IDs, listing ID, server timestamps, message ID, client message ID, and moderation metadata. Enforce message length and valid content.
- Return stable acknowledgments. Duplicate sends with the same actor/conversation/client ID must return the original accepted message, not create another.
- Define behavior for archived, sold, paused, removed, or moderated listings; users may retain historical threads, while initiating new contact or new sends is subject to explicit policy.
- Support blocking and conversation access policy hooks; messages cannot be read by unrelated users.
- Enforce message/burst and global cost quotas without blocking basic thread read/pagination unnecessarily.

**Non-functional requirements and considerations**

- Authorization: verify that the caller is a participant on **every** inbox, history, send, and read-position operation; do not trust user-supplied participant IDs.
- Integrity: unique conversation key, unique client-message key within appropriate sender/thread scope, durable acceptance, deterministic ordering (`createdAt` plus server tie-break or sequence).
- Scalability: participant/last-activity inbox index, conversation/message chronological index, bounded page size, bounded text length; avoid loading full thread histories.
- Reliability: independent clients may retry after a lost HTTP response; no duplicated message and no incorrect read advancement.
- Privacy: do not log chat body, expose messages in push payloads by default, or include message text in public listing APIs.
- Abuse: rate limits, blocked-user policy, report linkage, retention/deletion rules, and clear handling of conversations around moderated listings.

**Acceptance criteria**

- [ ] Two separate users can start a listing-linked conversation and exchange replies that persist across server restart.
- [ ] Repeated create/send attempts with the same idempotency keys never duplicate threads or messages.
- [ ] A third user cannot read, alter, mark read, or send within another pair's conversation.
- [ ] Message ordering/pagination remains stable for equal timestamps, concurrent sends, and long threads.
- [ ] Rate-limit, block, invalid listing, and archived/moderated cases return documented error codes and states.

### F14 — Chat inbox, conversation UI, offline sending, and inbound synchronization

**Goal:** Make communication usable in the mobile app, including durable composition during network loss.

**Dependencies:** F05, F13, F07. **Deliverables:** inbox, thread screen, message outbox, read/sync behavior, listing contact CTAs.

**Functional requirements**

- Replace the placeholder Chats screen with an account-scoped inbox showing participant, relevant listing, latest message preview, time, and unread indicator.
- Open a conversation from **Message Seller** or **Contact Provider / Request Quote** on details. A service inquiry may prefill context but remains an ordinary editable message.
- Implement message list with bounded history pages, chronological ordering, compose/reply, send status, and retry/error interactions.
- Persist cached thread history and outgoing messages in SQLite. Compose offline; append to durable outbox and display `queued` until confirmed.
- On reconnection/foreground, send with the original client message IDs; reconcile server acknowledgments and inbound updates without duplicates, lost text, or wrong-thread attachment.
- Refresh incoming messages while the app is active via bounded polling, refresh-on-foreground, or an affordable realtime transport. Do not rely on push delivery as the message database.
- Maintain per-participant unread state; mark messages read only when the user actually opens/consumes the relevant conversation, not merely when a push arrives.
- Include the associated listing and other participant in the thread header; handle listing status changes and removed listing previews gracefully.
- Preserve unsent message drafts when offline quota, auth expiry, or messaging shutdown occurs; distinguish retryable and nonretryable outcomes.

**Non-functional requirements and considerations**

- Correctness: at-least-once client retry + server idempotency produces effectively once-only visible messages; handle fetch-before-ack, ack-before-fetch, and duplicate incoming pages.
- Performance/cost: bounded, focus-aware polling and pagination; no whole-inbox rapid polling from every tab; battery-conscious refresh.
- Accessibility: keyboard avoidance, clear send status and errors, readable text and touch targets.
- Privacy/account isolation: don't show prior-account threads after logout or account change; message bodies never appear in diagnostic logs.
- Network correctness: distinguish `sent to server` from `delivered to device` or `read`; don't promise unsupported delivery guarantees.

**Acceptance criteria**

- [ ] Buyer sends a product or service inquiry; owner receives it and replies within the app; history persists after both users restart.
- [ ] Compose/send offline, force-kill, relaunch, and reconnect results in exactly one server message for each unique local send.
- [ ] Inbox unread indicators reflect incoming messages and update on verified thread access.
- [ ] Participant isolation and logout cache separation are covered by mobile/backend integration tests.
- [ ] Message failure states are visible and recoverable without clearing the user's typed message.

### F15 — New-message awareness and push notification integration

**Goal:** Make replies discoverable in a practical local marketplace without introducing runaway background traffic or notification expenses.

**Dependencies:** F13–F14, F01. **Deliverables:** foreground updates, unread badges, lifecycle-safe push integration if affordable, notification settings.

**Functional requirements**

- Update inbox/unread counts while active and after returning to the foreground, without requiring a full app relaunch.
- Support a new-message notification mechanism for backgrounded users using an approved provider within a **verified enforceable spending policy**. If push cannot meet budget constraints, treat the delivery method as an explicit launch decision with a documented fallback; do not silently remove new-message awareness.
- Register/remove device push tokens securely and associate them only with the authenticated account; revoke or disassociate tokens on logout where practical.
- Generate alerts only after a message is durably accepted, not after a local offline queue operation.
- Suppress self-notifications, minimize duplicate sends, and respect device/platform permission and user preferences.
- Tapping a notification opens the appropriate authenticated conversation when allowed; handle logged-out, blocked, deleted, or inaccessible threads safely.
- Keep message previews out of push content by default; offer privacy-preserving notification copy.

**Non-functional requirements and considerations**

- Cost: delivery attempts are bounded and deduplicated; observe provider quota/abuse thresholds; no unbounded message-triggered email fallback.
- Reliability: push is an advisory wake-up/alert, not the source of messages; refreshing the inbox reconciles missed alerts.
- Privacy: use minimal payload IDs and safe summaries; no secrets or exact user location in notifications.
- UX: denied notification permission must not block chat; explain how unread status remains available in the app.

**Acceptance criteria**

- [ ] Foreground users see fresh messages/unread changes without manual relaunch.
- [ ] With permission and supported transport, a backgrounded recipient gets an alert and can open the right conversation.
- [ ] Duplicate server triggers do not create unbounded alert volume, and rejected/blocked sends do not notify.
- [ ] Missing permission, invalid device token, or provider outage does not lose the underlying message.
- [ ] Provider/cost policy is verified and documented before notifications are enabled publicly.

### F16 — Reporting, blocking, moderation, and marketplace safety

**Goal:** Prevent the minimum common abuse patterns that become possible once anyone can post listings and contact others.

**Dependencies:** F02, F13–F15; model safety rules early. **Deliverables:** reporting, blocking, restricted content policy, moderation state, operator workflow.

**Functional requirements**

- Provide a **Report listing**, **Report conversation/user**, and **Block user** capability with reasonable reason categories and safe free-text limits.
- Define prohibited product/service categories, spam/duplicate content rules, and policy for regulated services, misleading claims, and impersonation.
- Apply block policy across messaging and applicable profile interactions; clarify whether prior conversation history remains visible.
- Introduce `moderationStatus` separate from normal listing status so hidden/removed items cannot be revived through ordinary owner edits.
- Maintain a minimal server-side review queue or operator workflow to inspect reports, hide content, and document decisions. Automated detection may be added later, but a functional manual path is needed.
- Give users a safe explanation when their listing/contact is unavailable, without exposing another user's private report information.
- Enforce per-user/IP creation and message quotas and basic repeated-content abuse checks through existing cost/abuse controls.

**Non-functional requirements and considerations**

- Authorization: reports may be submitted by an authorized viewer; moderation actions restricted to operator/admin roles or trusted control path.
- Privacy: report content, reporter identity, and moderation notes are nonpublic; message evidence access is strictly scoped.
- Durability: moderation/blocked state survives restart and is enforced by every relevant backend read/write, not merely hidden client-side.
- Operations: establish escalation/removal policy, retention limits, and account support/review access without complex admin infrastructure.
- Safety: public meetup UX should recommend public places; do not promise identity or professional-license verification unless implemented.

**Acceptance criteria**

- [ ] Reporting a listing/message creates a reviewable record without leaking reporter information.
- [ ] Blocked users cannot send new messages contrary to the documented block policy.
- [ ] Moderated listings disappear from public discovery and cannot be reactivated by the owner without permitted review.
- [ ] Forbidden content and abuse-rate cases have repeatable API and UI behavior.

### F17 — Native sharing, stable links, and access-aware navigation

**Goal:** Allow product and service listings to be shared reliably outside the app without exposing private account or location data.

**Dependencies:** F07, F13; coordinate with app navigation. **Deliverables:** stable URLs, native share sheet, authenticated routing/fallback behavior.

**Functional requirements**

- Produce canonical public listing URLs for both Products and Services, using immutable server listing IDs or stable slugs with collision-safe resolution.
- Use the platform-native share sheet with appropriate title/summary and public link; never put a private address, bearer token, or raw GPS coordinates in a shared URL.
- Resolve a shared link to the correct listing detail if the app is installed and available; provide an appropriate web/app-install fallback when it is not.
- If a user taps a contact or saved action from a shared link, require authentication and return to the intended destination after login when permitted.
- Handle removed, archived, or moderated listings gracefully, with no broken navigation loops or private-data disclosure.

**Non-functional requirements and considerations**

- Stability: published links remain consistently resolvable across later schema changes; link format should not encode mutable title/category data as identity.
- Security: URL parameters are untrusted inputs and never directly confer authorization.
- Operations: document link hosting and fallback approach under cost restrictions; verify real-device behavior on both platforms.

**Acceptance criteria**

- [ ] Sharing and opening a Product or Service link lands on the corresponding detail or an accurate unavailable state.
- [ ] No private location, secret, or authentication credential appears in links or share previews.
- [ ] Login transitions and missing-app fallback are verified on supported devices.

### F18 — Integration verification, release operations, and P0 launch acceptance

**Goal:** Make the whole marketplace safe and reliable enough to operate publicly, rather than treating feature-complete screens as launch-ready.

**Dependencies:** All P0 features. **Deliverables:** deployable backend/mobile releases, tested operations, privacy and cost gates, launch checklist.

**Functional requirements**

- Provision and verify production-ready environments, required database indexes/migrations, secrets, HTTPS, image storage policies, and any allowed external provider integrations.
- Test all critical end-to-end journeys on supported Android and iOS devices with two or more independent accounts and different geographic areas.
- Verify user registration and session recovery, listing publish/edit/status, geographic discovery, favorites, seller profiles, and listing-specific two-way messaging.
- Exercise airplane mode, intermittent connectivity, process death, backend restart, duplicate replay, failed uploads, expired sessions, stale data, account switching, and quota exhaustion.
- Enable useful crash/error monitoring and operational health metrics; document alert triggers, budget limits, provider ceilings, backup/restore, moderation response, and emergency feature disablement.
- Complete app store build/signing, platform permissions and privacy disclosures, basic accessibility review, realistic marketplace seed data, and first-use/empty-state UX.
- Define minimal data-retention/deletion policies for inactive accounts, expired drafts, chat history, stale caches, stored media, reports, and moderation data.

**Non-functional requirements and considerations**

- Availability: verify documented restart/redeploy behavior; local drafts must remain safe during backend outage.
- Scalability: repeat index plans and bounded query tests with realistic geographic and chat histories; explicitly model the growth threshold for current free infrastructure.
- Security: test cross-user authorization for every private resource, upload impersonation, IDOR, rate-limit bypass, exposed location, logging redaction, and injection/unsafe content paths.
- Cost: exercise emergency caps under concurrent usage; document where a service can still bill above free allowance and remove/replace it or explicitly accept that risk.
- Quality: CI green, integration tests deterministic, no untriaged critical defects, rollback plan for schema/API changes, accessible core flows.

**Acceptance criteria — launch blockers**

- [ ] A buyer selects an area, finds a nearby product, views details, messages the owner, and receives a reply; the conversation persists across both devices and cannot be read by a third account.
- [ ] The same flow works for a service, including correct service-coverage matching and quote-style inquiry.
- [ ] A seller creates an image-backed draft offline, restarts, reconnects, publishes once, and manages the result without losing content.
- [ ] Offline favorites and chat sends synchronize without duplicates; conflicting edits fail safely and preserve work.
- [ ] Precise private locations and user secrets are absent from public responses, logs, media, and shared links.
- [ ] Global quotas, endpoint rate limits, upload caps, and operation-specific emergency switches have demonstrated enforcement.
- [ ] Core CI checks, E2E smoke tests, security checks, device validation, and documented provider/rollback procedures pass.

---

## 7. P1: Post-launch enhancements

P1 features are explicitly **not launch dependencies**. They must reuse P0 schemas/authorization/quotas instead of creating disconnected side systems.

### F19 — Interactive maps and public meetup discovery

**Dependencies:** F03–F07, F08 where images are shown.  
**Functional:** Optional List/Map browsing; approximate product markers; service-coverage visualization; a seller-selected public meetup point displayed separately from the private item location; map-to-detail navigation.  
**Non-functional:** Licensed/paid map tile policy, request and cache quotas, accessible non-map alternative, marker clustering at scale, privacy-safe coordinate generalization, correct offline fallback without assuming offline tiles.  
**Acceptance:** Map/list selections agree about visible listing scope; map does not expose private coordinates; meeting-place choices require explicit seller consent; provider limits are enforceable.

### F20 — Optional listing video

**Dependencies:** F08, F01, F09–F10.  
**Functional:** Up to one short video per eligible listing, ordered gallery integration, playback controls, optional cover frame, resumable or retryable upload, safe replacement/removal.  
**Non-functional:** Strict duration/bytes/codec policies, validation/transcoding and thumbnail cost analysis, upload quotas, streaming bandwidth, autoplay/battery restrictions, retention/orphan cleanup, abuse scanning where appropriate.  
**Acceptance:** Invalid or oversized videos cannot consume uncontrolled resources; interrupted upload is recoverable; video playback failure doesn't break image-backed listing details.

### F21 — Extended marketplace search and service coverage

**Dependencies:** F04, F06.  
**Functional:** Text search, richer price/category/condition filters, saved searches if warranted, selected ZIP/city service coverage, refined relevance and sorting.  
**Non-functional:** Indexed search strategy and measured costs, query normalization, cursor compatibility, spam/keyword abuse resistance, no exposure of exact address through fine-grained filters.  
**Acceptance:** Search result correctness and stability are tested on geographically clustered data; text search has defined relevance and zero-result behavior; paid search services require explicit budget controls.

### F22 — Richer messaging features

**Dependencies:** F13–F16.  
**Functional:** Optional read receipts, typing indicators, attachments, conversation search, stronger push preferences, and appropriate UX for quote discussions.  
**Non-functional:** Presence/typing signal throttling, no permanent assumption of online status, attachment virus/type/size checks, notification privacy, retention and moderation cost.  
**Acceptance:** Optional signals cannot change server message authority or cause unbounded realtime traffic; attachment access remains participant-scoped; baseline text chat continues working when enhancements fail.

### F23 — Expanded provider identity and portfolio

**Dependencies:** F07, F10, F16.  
**Functional:** Provider description, logo, additional portfolio categories, service specialization, public business information where explicitly shared, and optional business-specific stats.  
**Non-functional:** No false verified-license/certification claims, privacy and address consent, media budgets, authorized updates, abuse protections.  
**Acceptance:** Extended business profiles do not disclose private account fields; optional provider data cannot be mistaken for verified credentials; service listings remain browsable without complete business profiles.

---

## 8. P2: Monetization

Monetization is **designed for compatibility, not activated for P0**. Pricing, eligibility, credit expiry, refund policy, and platform billing rules must be decided from actual usage and current store policies before accepting payment.

### F24 — Pro subscription accounts and feature entitlements

**Dependencies:** F01, F02, F09–F11, stable identity/auth.  
**Functional:** Free/Pro entitlement state; configurable elevated caps for listings/media/tools; purchase, renewal, cancellation, expiry, payment failure, and restore; a Pro account may still purchase boosts. Keep browsing, basic selling, and core chat free.  
**Non-functional:** Server-verified purchase state, idempotent billing webhooks/events, reconciliation with store provider, no client-assigned Pro status, capped Pro resources, careful handling of downgrade above free quotas, compliance with current Apple/Google requirements.  
**Acceptance:** Invalid/unverified receipts grant no benefits; cancellations/renewals reconcile correctly; multiple devices see the same entitlements; downgrades do not silently delete customer listings.

### F25 — Credit purchases, wallet, and immutable ledger

**Dependencies:** F24's billing abstraction and F01 quotas; could be implemented independently of Pro entitlement rollout.  
**Functional:** One-time digital credit purchases, balance display, purchase restoration/reconciliation, promo grants distinct from purchased credits, deduction, reversal/refund, and history. Credits are only for platform promotional features, not payments for physical goods/services.  
**Non-functional:** Immutable ledger, unique event identifiers, transactional/idempotent spending, reconciliation jobs, fraud/chargeback handling, refund/expiry legal and store-policy review, precise accounting units, no offline credit spends.  
**Acceptance:** Concurrent spends cannot overdraw a balance; duplicate webhooks or client retries cannot grant/deduct twice; invalid purchase proofs do not increase credit balance; refunds/revocations have deterministic effects.

### F26 — Geographic, time-limited sponsored listing boosts

**Dependencies:** F04, F06, F24–F25, F16.  
**Functional:** Eligible owners activate boosts using credits; configure bounded duration and relevant geography; promoted placements clearly marked **Sponsored**; expiration and cancellation/pausing rules; basic impressions/clicks analytics. Free and Pro accounts may both buy boost credits.  
**Non-functional:** Preserve organic search relevance, cap sponsored density, prevent out-of-region/in-category promotion, enforce listing eligibility and seller authorization, atomic credit deduction + boost activation, fraud-resistant metrics, disclosure and app-store/ad rules. Do not claim guaranteed views or sales.  
**Acceptance:** Paid boost expires precisely according to server time; sold/archived/moderated listings are not promoted; duplicate activation cannot spend twice; sponsored labels are prominent and understandable; geographic targeting respects the user's filters.

**Monetization boundary:** In-app payments for real-world products/services, service reservations, escrow, shipping labels, seller payouts, tax reporting, and dispute arbitration are separate future product lines, **not implied by Pro or boosts**.

---

## 9. Cross-feature verification and release gates

### 9.1 Feature-level completion standard

A feature is considered **complete** only if all applicable items hold:

1. **Behavior:** The stated functional requirements operate end to end; dependencies and invalid states behave as specified.
2. **Contract:** Backend request/response schemas, persistence fields, ownership rules, and client mapping are explicit and validated.
3. **Offline correctness:** Local data, pending writes, retries, and conflicts follow the feature's documented offline contract.
4. **Security/privacy:** Unauthorized cross-account and resource access is tested; sensitive coordinates/content/secrets are absent from public outputs.
5. **Cost:** New externally billable or unbounded operations have quotas, monitoring, and a verified shutoff/approved alternative.
6. **Scale:** Collection queries are indexed and paginated; UI uses bounded data and appropriate caching; performance is measured under representative data.
7. **Quality:** Relevant unit/integration/mobile tests, negative cases, review, lint, type checks, and build/export checks pass; no critical defect is left undocumented.
8. **Operations:** New environment variables, migrations, indexes, feature switches, failure/recovery procedures, and retention rules are documented.

### 9.2 Minimum test matrix

| Area           | Happy path                                        | Critical negative / resilience cases                                                      |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Identity       | Login, verification, restore, logout              | Replayed token, expired session, cross-user access, provider outage, brute-force limits   |
| Location       | Manual and current area, radius change            | Denied permission, invalid coordinates, privacy disclosure, unavailable geocoder          |
| Product search | Nearby results, stable cursor, filters            | Boundary radius, sold/archived suppression, cursor scope mismatch, large collection       |
| Service search | Coverage includes buyer, category filters         | Provider outside simple radius but serves buyer; coverage edge and mismatched mode        |
| Offline feed   | Previously synced content visible                 | New area offline, stale status, missing media, cache migration and eviction               |
| Publishing     | Offline draft → upload → server-confirmed listing | Restart, timeout after commit, quota refusal, duplicate request, invalid media, ownership |
| Listing edits  | Edit/status, price history                        | Concurrent edit conflict, sold/paused state, stale offline operation, deleted resource    |
| Favorites      | Save, unsave, sync                                | Rapid toggle, concurrent devices, duplicate keys, account switch                          |
| Chat           | Inquiry, reply, inbox, unread                     | Duplicate send, network timeout, restart, unauthorized third party, block, long history   |
| Notifications  | Foreground refresh, background alert              | Denial, duplicate event, stale/deleted thread, invalid token, provider outage             |
| Cost/safety    | Limits, reporting, moderation                     | Parallel over-quota writes, attack bursts, kill switch, moderation bypass                 |

### 9.3 Integration scenarios required before public launch

- **Product workflow:** Seller A publishes a product with photo(s) and generalized area → Buyer B nearby finds it → B opens details → B sends a message → A receives/replies → both retain history after restart; User C cannot read it.
- **Service workflow:** Provider A publishes a quote-based service whose coverage reaches Buyer B → B discovers the service even when A's base is outside B's ordinary product radius → B inquires → conversation works.
- **Offline workflow:** A prepares an image-backed draft offline, changes location, force-kills/reopens, attempts publish, reconnects, and ends with exactly one server listing; offline favorite and queued chat sends reconcile.
- **Conflict workflow:** A edits the same listing on two devices while one is offline; stale update produces a recoverable conflict, not lost work.
- **Safety/cost workflow:** A malicious or misconfigured client sends concurrent sign-up, upload, listing, and message requests; quotas and global switches stop costly operations without corrupting valid data.
- **Privacy workflow:** Public listing cards/details, profiles, share URLs, logs, image metadata, chat notifications, and error outputs are inspected for private coordinates, emails, tokens, and secrets.

### 9.4 Operational readiness checklist

- [ ] Production and staging settings are separated; secrets and environment configuration are documented.
- [ ] Provider accounts, billing modes, effective hard caps, email/geo/media/push cost policies, and stop conditions are confirmed.
- [ ] Required database indexes and reversible migrations are verified before opening user traffic.
- [ ] CI is green; device-level integration, smoke tests, load/abuse tests, and negative authorization tests are documented.
- [ ] Backups/restores, emergency shutdown, rollback, moderation review, and basic incident response have owners and procedures.
- [ ] Data retention/deletion and privacy-policy disclosures align with actual behavior.
- [ ] Core buyer–seller communication is operational; unread/new-message awareness is not misleading.
- [ ] No fake active action is displayed for a feature that has not been completed.

---

## 10. Open product and architecture decisions

The following are intentionally not assumed to be final. Resolve each **before** implementing the feature it materially affects; update the relevant feature section after the decision.

| Decision                       | Current proposal / issue                                                                                                                                                                        | Needed by |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Initial marketplace geography  | Launch with a concentrated local region; decide supported cities and maximum service coverage radius                                                                                            | F03–F04   |
| Anonymous discovery            | Prefer public read-only browsing with strict anonymous/IP limits, authentication required for save/publish/chat; current app routes are auth-centric, so implementation cost needs confirmation | F04–F06   |
| Public coordinate precision    | Pick consistent generalized-area methodology and truthful distance labeling; ensure server cannot reverse-expose private GPS                                                                    | F02–F04   |
| Service matching               | Buyer selected center inside service radius for V1; search-region intersection is a different query mode                                                                                        | F04       |
| Product photo and price rules  | Decide if at least one photo is required to publish, whether zero-price items are allowed, and allowable currency/amount ranges                                                                 | F02/F09   |
| Service pricing/availability   | Decide rate unit constraints and whether free-text availability is sufficient for P0                                                                                                            | F02/F10   |
| Exact listing lifecycle        | Define recoverable state transitions and hard vs soft deletion policy, including sold/paused/restored                                                                                           | F02/F11   |
| Feed/API migration             | Keep `/products` as a compatibility facade, migrate clients, and choose retirement conditions; ensure no data loss                                                                              | F02       |
| Offline sync scope             | Per-user checkpoints, tombstone retention, public cache TTL, account sign-out retention, and conflict resolution UX                                                                             | F05       |
| Media storage                  | Provider, access model, thumbnail processing, per-user/global byte limits, upload expiration and cleanup                                                                                        | F01/F08   |
| Chat delivery transport        | Bounded foreground polling vs realtime connection; choose based on measured cost, responsiveness, and operational complexity                                                                    | F13/F14   |
| Background message alert       | Select push transport with compliant privacy, genuine spending constraints, and defined fallback if unavailable                                                                                 | F15       |
| Reporting/moderation           | Allowed categories, response process, report retention, blocking behavior, abuse thresholds                                                                                                     | F16       |
| URL/deep-link hosting          | Durable link domain, app-install fallback, cost, mobile platform association requirements                                                                                                       | F17       |
| Release performance budgets    | Pilot workload, device baseline, cache limits, p95 targets and alert thresholds                                                                                                                 | F18       |
| Subscription and credit policy | Product pricing, included credits, purchase/expiration/refund rules, store billing compliance                                                                                                   | F24–F26   |

---

## 11. Change control and documentation conventions

- Keep **this document focused on intended product and system behavior**, not temporary task lists or implementation transcripts.
- Preserve feature IDs (**F00–F26**) so design decisions, tests, and changes remain traceable if sections move or become more detailed.
- Update scope, dependencies, functional/non-functional requirements, and acceptance criteria together when a feature changes. Never mark a partially implemented backend as a completed user-facing feature.
- Record a significant architecture decision with its rationale and rejected alternatives in a separate ADR under `docs/architecture/`; link the ADR from the feature section. Do not overload the main plan with implementation-specific code snippets.
- Maintain versioned API contracts, migrations, indexes, environment settings, operational runbooks, and test evidence alongside the implementing modules.
- Treat **P0** as the minimum viable transactional marketplace, not the minimum number of screens. Product discovery, service discovery, publication, contact, offline resilience, privacy, and cost protection are all required.
- Reassess requirements when real usage reveals new constraints. Favor small changes that preserve compatibility and data integrity over broad rewrites.

---

**End of master specification.**
