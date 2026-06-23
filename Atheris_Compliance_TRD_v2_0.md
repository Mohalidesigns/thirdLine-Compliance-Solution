# TECHNICAL REQUIREMENTS DOCUMENT
## ATHERIS COMPLIANCE MANAGEMENT SOLUTION
### Technical Specification, Architecture and Build Reference for Nigerian and African Financial Institutions

| Field | Value |
|---|---|
| Product Code | ATHERIS-CMS-3.0 |
| Document Title | Technical Requirements Document — Atheris Compliance Management Solution |
| Version | 2.0 |
| Status | Engineering Review Draft |
| Date | 19 May 2026 |
| Prepared by | Mohammed Ali / Engineering Review |
| Classification | Internal — Confidential |
| Companion Document | Atheris BRD v2.0 (14 May 2026) — this TRD is binding only when read alongside the BRD |

---

## 1. Document Control

### 1.1 Version History

| Version | Date | Author | Change Summary | Approver |
|---|---|---|---|---|
| 0.1 | 2026-05-13 | M. Ali | TRD outline | — |
| **1.0** | **2026-05-14** | **M. Ali** | **First complete draft — architecture, stack, data, APIs, module designs (M01–M30), security, NFR implementation, DR, observability, DevOps, test strategy, migration plan, appendices.** | **Pending Head Engineering, CISO, CCO, DPO, Internal Audit, Implementation Partner Lead** |
| **1.1** | **2026-05-19** | **Engineering Review** | **Architecture addendum reflecting design session decisions: (1) Distributed SaaS model — central platform + tenant-isolated environments replaces single-institution deployment assumption; (2) Kafka replaced by PostgreSQL job_queue + Spring @Scheduled cron processors for MVP — upgrade path documented; (3) Horizon scanner fully specified — JSoup (HtmlScraperStrategy) + Playwright (PlaywrightHeadlessStrategy, replaces Selenium, ADR-007 updated); streaming PDF download (InputStream + DigestInputStream + S3 multipart); Resilience4j retry; provenance snapshots; anomaly detection; two-mode monitoring vs backfill; (4) Webhook delivery — obligation.received / obligation.applicability_updated / obligation.superseded, HMAC-SHA256 signing, exponential backoff retry, idempotent receivers; (5) Schema-per-tenant PostgreSQL isolation — TenantContextHolder (ThreadLocal), TenantSchemaFilter (SET search_path), TenantProvisioningService (Flyway per-schema); (6) JWT + refresh token auth — 15-min access token, 30-day rotating refresh token, SHA256 hash stored; (7) Invite token flow — 128-char cryptographic token, hash stored in invite_tokens, 72h expiry, immediate login on accept; (8) RBAC: PLATFORM_ADMIN (central), TENANT_ADMIN / CCO / ANALYST / AUDITOR / VIEWER (tenant).** | **Engineering Review** |
| **2.0** | **2026-05-19** | **Engineering Review** | **Consolidated final version aligned to BRD v3.0. All 10 implementation documents merged into Atheris_Technical_Implementation.md (seven sections). TRD updated: (1) Two-product model formalised — Product 1 Intelligence API (standalone REST + webhooks for institutions with existing GRC), Product 2 Full Platform; (2) Tenant onboarding wizard (4-step) with per-regulator subscription overrides added as new module; (3) Regulator subscription-driven applicability routing — 6-condition shouldDeliverToTenant() filter; (4) Immutability principle documented — classify once, serve to all; PDF text and AI output shared across all tenants immutably; (5) RegulatorRecommendationService — pre-selects regulators based on licence type during onboarding; (6) tenant_regulator_preferences table for per-regulator notification and document-type overrides; (7) PlaywrightBrowserPool singleton — one Chromium process, lightweight per-scrape contexts; (8) Historical backfill mode — resumable via backfill_jobs table, current_page preserved on failure; (9) Document status: central platform fully designed, tenant workflow modules (obligation classification, controls, testing, findings, returns, dashboard, board pack) deferred to next session.** | **Engineering Review** |

### 1.2 Owners and Approvers

| Role | Function | Responsibility |
|---|---|---|
| Document Owner | Head of Engineering | Maintains the TRD; sole authority to approve content changes |
| Technical Sponsor | Chief Information Officer | Architecture sign-off, technology choices |
| Security Approver | CISO | Approves §13 (Security Architecture), §15 (Resilience), §16 (Observability/Audit), §20 (Platform Compliance), all NFR-Sec controls |
| Privacy Approver | Data Protection Officer | Approves §13 (Identity/PII handling), §19 (Migration), §20 (NDPA-of-platform), retention policies |
| Compliance Reviewer | Chief Compliance Officer | Confirms TRD honours every BRD functional rule and acceptance criterion |
| Integration Approver | Head of Integration & APIs | Approves §11 (Integration Architecture) and §12.5 (API Catalogue) |
| Operations Approver | Head of Production / SRE | Approves §16 (Observability), §17 (DevOps/CI-CD), §18 (Ops Runbooks) |
| Independent Reviewer | Chief Internal Auditor | Reviews for auditability and segregation-of-duties |
| Build Lead | Engineering Manager(s) | Receives TRD as build reference |
| Implementation Partner | Systems Integrator Lead | Build/configure/deploy |

### 1.3 Conventions

- Functional Requirements (`FR<m>.<n>`), Acceptance Criteria (`AC<m>.<n>`) and NFRs (`NFR<n>`) reference the BRD and are not re-stated here unless a technical interpretation is added.
- Technical Requirements introduced in this TRD use `TR<n>` (cross-cutting) or `TR-M<m>.<n>` (module-specific).
- Architecture decisions are recorded as `ADR-<n>` with status (Accepted / Proposed / Superseded). All `ADR-*` in this document are Accepted unless stated otherwise.
- Open items use `[ASSUMPTION]` or `[NEEDS DECISION]`.
- All times are West Africa Time (WAT, UTC+1) unless otherwise stated.

---

## 2. Introduction and Scope

### 2.1 Purpose

This Technical Requirements Document translates the Atheris BRD v2.0 into a build specification: it defines the architecture, technology stack, data model, APIs, security model, NFR implementation, resilience, observability, DevOps, test strategy, operations and migration plan. It is the authoritative reference for the engineering team and the implementation partner.

### 2.2 In Scope (Technical)

- The cloud-native, Nigeria-resident, active-active platform that implements modules M01–M30 of the BRD.
- All NFRs (`NFR1`–`NFR46`) of the BRD: performance budgets, availability, scalability, security, data residency, auditability, accessibility.
- All integrations enumerated in BRD §12.
- The Day-1 migration of the canonical Drafts (352 obligations, 12 CRMP themes, 236 Compliance Monitoring Plan rows, 187 Returns Register rows, 417 Sanctions Grid rows, 43 regulator entries, 29 areas of focus, 13 instrument types).

### 2.3 Out of Scope (Technical)

- The core banking system itself, fraud-scoring engine, treasury market-risk engine, tax-computation engine, CRM and ESG-data-collection sensors. Atheris integrates with each.
- Customer-facing channels (Atheris is internal + read-only regulator portal in Phase 2).
- Bespoke hardware procurement (commodity cloud unless §5 says otherwise).

### 2.4 Companion Documents

- Atheris BRD v2.0 (14 May 2026) — functional source of truth.
- Compliance Management Toolkits DRAFT (working file) — Day-1 data source.

---

## 3. Architectural Principles and Constraints

### 3.1 Architectural Principles

1. **Nigeria-first.** Production data resides in Nigeria; cross-border copies only where NDPA safeguards are documented (NFR41–43).
2. **Cloud-native, container-first.** All runtime components are containers orchestrated by Kubernetes; no VM-bound application servers.
3. **Service decomposition by bounded context, not by feature flag.** Each BRD module belongs to one bounded context; multiple modules may share a context where coupling is high (see §4.2).
4. **Asynchronous by default for cross-context flows.** Cross-context communication uses Kafka events; synchronous REST is reserved for within-context calls and external integrations.
5. **Configuration over code.** Reference data (regulators, item types, areas of focus, risk matrices, return templates), workflow rules and report layouts are administrable (NFR46).
6. **Maker–checker by design.** Every state-changing operation that the BRD requires under four-eyes is enforced at the service layer, not the UI.
7. **Immutable audit by default.** Every state change emits a domain event to the audit stream; the event store is append-only and hash-chained (M19).
8. **Stateless services; stateful stores.** Services do not retain session state; HTTP sessions are short, JWT-backed, and TLS-pinned.
9. **Least privilege everywhere.** Pod identities, database roles, API scopes, network policies; no shared admin accounts.
10. **Polyglot persistence where justified.** Relational by default; document/search for the regulatory library; columnar for analytics; object store for evidence; HSM-backed key store for crypto.
11. **Defence in depth.** OWASP ASVS Level 2; CBN Risk-Based Cybersecurity Framework controls; CIS Benchmarks for the underlying infra.
12. **Evidence-by-construction.** Every privileged action is logged in a form acceptable to CBN and NDPC examiners (M19).

### 3.2 Constraints

| ID | Constraint | Source |
|---|---|---|
| C1 | Data must reside in Nigeria for production | NFR41; CBN data-localisation guidance |
| C2 | Encryption keys must be held in a FIPS 140-2 Level 2+ HSM located in Nigeria | NFR43 |
| C3 | Real-time sanctions screening latency budget p95 ≤500ms | NFR1; AC7.1 |
| C4 | Customer onboarding (BVN + NIN + CAC + sanctions) round-trip p95 ≤3 seconds | NFR2; AC6.1 |
| C5 | AML alert latency p99 ≤30 seconds from posting | NFR3 |
| C6 | Universe full-text search p95 ≤2 seconds across 50,000 obligations | NFR4; AC1.3 |
| C7 | Availability ≥99.9% business hours / ≥99.5% 24×7 | NFR10 |
| C8 | RPO ≤15 minutes; RTO ≤4 hours | NFR11 |
| C9 | Audit trail immutable; ≥5-year retention; longer where source obligation demands | NFR31–32; M19 |
| C10 | Maker-checker for every state-changing operation in scope | BRD §14 RBAC; BRD modules throughout |
| C11 | Tipping-off prevention on STR contents | M09 FR9.6; AC9.3 |
| C12 | Goal: ≥98% of returns submitted on or before due date | AC10.1 |
| C13 | Customer PII pseudonymised in non-production environments | NFR19 |
| C14 | Backwards-compatible APIs ≥18 months; 90-day deprecation notice | NFR44 |
| C15 | Quarterly release cycle with hotfix capability | NFR45 |

### 3.3 Architecture Decision Records (Headline)

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Primary stack is Java 21 + Spring Boot 3.x (Spring Framework 6.x) on Kubernetes | Accepted |
| ADR-002 | Primary cloud is a Nigerian hyperscaler region (initial choice AWS af-south-1 — Cape Town with in-Nigeria edge / on-shore replicas, [NEEDS DECISION] pending AWS Nigeria local zone GA or Azure Nigeria GA), active-active across two AZs, DR to a second Nigerian region or on-shore Tier-III data centre | Accepted, region selection pending |
| ADR-003 | Relational persistence is PostgreSQL 16 (managed); document/search is OpenSearch 2.x; analytics is ClickHouse; cache is Redis 7; messaging is Apache Kafka 3.x (managed via MSK / Confluent) | Accepted |
| ADR-004 | Object storage for evidence and PDFs is S3-compatible with Object Lock (WORM); HSM is AWS CloudHSM (Nigerian region) or a Nigerian-hosted Thales/Utimaco HSM | Accepted |
| ADR-005 | Identity is OpenID Connect / OAuth 2.1 via Keycloak (self-hosted) federated to bank Azure AD / Okta; service-to-service is SPIFFE/SPIRE-issued workload identities + mTLS | Accepted |
| ADR-006 | Service mesh is Istio (mTLS, authz, traffic policy, observability) | Accepted |
| ADR-007 | API gateway is Kong (north-south) for partners/regulator-portal; service mesh handles east-west | Accepted |
| ADR-008 | Frontend is React 18 + TypeScript + Vite, with a design system based on Material UI 5 customised; back-office only (no public consumer UI) | Accepted |
| ADR-009 | Workflow engine for state machines (CRMP review cycles, returns workflow, breach 72-hour timer, fit-and-proper, complaints SLA) is Camunda 8 (Zeebe) | Accepted |
| ADR-010 | Rule engine for AML scenarios and Universe horizon-scanner triage is Drools (KIE) within the AML service; alternative ML scoring is a Python (FastAPI) sidecar service consuming the same event stream | Accepted |
| ADR-011 | The audit-event ledger uses a hash-chained append-only Postgres table backed by S3 Object Lock for the daily Merkle root snapshot; no blockchain | Accepted |
| ADR-012 | The platform is multi-tenant-ready (logical isolation per institution) but the Phase-1 deployment is single-tenant | Accepted |
| ADR-013 | Document AI for PDF extraction and OCR of scanned regulator publications is AWS Textract with a fallback to Tesseract for sovereignty-restricted documents | Accepted |
| ADR-014 | The Compliance Monitoring scheduler is Spring Batch with Spring Cloud Data Flow / Quartz for cron-style schedules; long-running flows run in Camunda | Accepted |
| ADR-015 | Streaming analytics and CCM queries against connected systems use a dedicated read replica per source plus Kafka Connect; no direct prod-to-prod chatty calls | Accepted |

---

## 4. Logical Architecture

### 4.1 Macro View

The platform is composed of fifteen logical bounded contexts (BCs), one orchestration plane, one event backbone and one cross-cutting evidence/audit plane. Each BC maps to one or more BRD modules. Communication across BCs is asynchronous over Kafka; within a BC services use synchronous gRPC or HTTP.

```
                       ┌────────────────────────────────────────────────────┐
                       │  Regulator-Portal (RO, Phase-2) / Partner Gateway  │
                       └─────────────────────────▲──────────────────────────┘
                                                 │
                                          ┌──────┴───────┐
                                          │  Kong API GW │ (north-south)
                                          └──────▲───────┘
                                                 │
   ┌────────────┬────────────┬────────────┬─────┴──────┬────────────┬────────────┐
   │  Library   │  CRMP &    │  Returns   │ Financial  │ Customer   │ Conduct &  │
   │  & Horizon │  Controls  │  & Calendar│ Crime      │ Lifecycle  │ Governance │
   │  (M01–M03) │  (M04–M05) │  (M10,M17) │ (M07–M09)  │ (M06)      │ (M11,M13,  │
   │            │            │            │            │            │  M22,M24,  │
   │            │            │            │            │            │  M25)      │
   └────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
   ┌────────────┬────────────┬────────────┬────────────┬────────────┬────────────┐
   │ Data Prot. │ Tax & FATCA│ ESG &      │ Capital    │ Account &  │ Sanctions  │
   │ (M12,M16   │ /CRS       │ Sustain.   │ Market &   │ Cash Mgmt  │ KB         │
   │  data sec) │ (M20,M21)  │ (M26)      │ Open Bank. │ (M29,M30)  │ (M28)      │
   │            │            │            │ (M23,M27)  │            │            │
   └────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
   ┌────────────┬────────────┬────────────────────────────────────────────────┐
   │ Training & │ Vendor     │ Dashboards & Board Pack (M18)                  │
   │ Attestation│ & TPRM     │                                                 │
   │ (M15)      │ (M14)      │                                                 │
   └────────────┴────────────┴────────────────────────────────────────────────┘
                              │
                  ┌───────────┴────────────┐
                  │   Kafka Event Backbone │
                  └───────────┬────────────┘
                              │
   ┌────────────┬─────────────┴─────────────┬────────────┬────────────────────┐
   │  Identity  │   Audit & Evidence Vault  │ Workflow   │  Observability     │
   │  (Keycloak │   (M19, append-only +     │ (Camunda 8)│  (OTel, Loki,      │
   │  + SPIRE)  │    S3 Object Lock)        │            │   Prom, Tempo)     │
   └────────────┴───────────────────────────┴────────────┴────────────────────┘
```

### 4.2 Bounded Contexts and Module Mapping

| BC ID | Bounded Context | BRD Modules | Primary Tables Owned | Primary Events Emitted |
|---|---|---|---|---|
| BC1 | Regulatory Library & Horizon | M01, M03 | `instrument`, `obligation`, `area_of_focus`, `instrument_type`, `regulator` | `instrument.published`, `obligation.created`, `horizon.detected` |
| BC2 | Policy & Procedure | M02 | `policy`, `policy_version`, `policy_ack` | `policy.published`, `policy.acknowledged` |
| BC3 | CRMP & Controls | M03 (joins), M04, M05 | `crmp_theme`, `crmp_row`, `control`, `control_test`, `monitoring_activity`, `kci_kri`, `issue` | `crmp.updated`, `control.test_completed`, `monitoring.overdue`, `issue.opened` |
| BC4 | Returns & Calendar | M10, M17 | `return_definition`, `return_run`, `return_evidence`, `calendar_item` | `return.due`, `return.submitted`, `return.acknowledged`, `return.overdue` |
| BC5 | Financial Crime | M07, M08, M09 | `screening_list`, `screening_hit`, `txn`, `alert`, `case`, `str`, `ctr`, `cdr` | `txn.ingested`, `screening.hit`, `alert.raised`, `str.submitted`, `goAML.acknowledged` |
| BC6 | Customer Lifecycle | M06 | `customer`, `customer_identifier`, `psc`, `customer_risk`, `kyc_event` | `customer.onboarded`, `customer.risk_changed`, `customer.dormant` |
| BC7 | Conduct & Governance | M11, M13, M22, M24, M25 | `complaint`, `whistle`, `gifts_register`, `rpt`, `board_committee`, `coi`, `insider_event` | `complaint.opened`, `whistle.received`, `gift.logged`, `rpt.disclosed` |
| BC8 | Data Protection & Incident | M12, M16 | `ropa`, `dpia`, `dsr`, `breach`, `incident` | `breach.detected`, `dsr.opened`, `incident.escalated` |
| BC9 | Tax / FATCA / CRS | M20, M21 | `tax_calendar`, `tax_return`, `fatca_classification`, `crs_filing` | `tax.return_due`, `crs.filed` |
| BC10 | ESG & Sustainability | M26 | `es_assessment`, `ghg_inventory`, `climate_disclosure` | `es_assessment.completed`, `ghg.captured` |
| BC11 | Capital Market & Open Banking | M23, M27 | `insider_list`, `disclosure`, `tpp_consent`, `open_banking_event` | `disclosure.filed`, `consent.granted`, `consent.revoked` |
| BC12 | Account & Cash Mgmt | M29, M30 | `dormant_record`, `dud_cheque`, `counterfeit_event`, `cash_event` | `account.dormant`, `cheque.dishonoured`, `counterfeit.captured` |
| BC13 | Sanctions & Penalties KB | M28 | `sanction_line`, `penalty_exposure` | `sanction.linked`, `penalty.exposure_calculated` |
| BC14 | Training & Attestation | M15 | `training_module`, `enrolment`, `completion`, `certification` | `training.enrolled`, `attestation.completed` |
| BC15 | Vendor / TPRM | M14 | `vendor`, `vendor_assessment`, `vendor_certificate` | `vendor.onboarded`, `vendor.cert_expiring` |
| Cross | Dashboards & Board Pack | M18 | `kpi_snapshot`, `board_pack` | (consumes) |
| Cross | Audit & Evidence | M19 | `audit_event`, `evidence_item`, `merkle_root` | `audit.event_appended` (internal) |
| Cross | Identity | (RBAC §14) | `user`, `role`, `assignment`, `access_recert` | `identity.role_changed`, `access.recertified` |

### 4.3 Service Inventory (Indicative — Mapped to BCs)

| Service | BC | Responsibility |
|---|---|---|
| `library-service` | BC1 | Instrument CRUD; obligation decomposition; Universe search via OpenSearch |
| `horizon-service` | BC1 | Daily scrape + RSS + change-management workflow start |
| `policy-service` | BC2 | Policy lifecycle, acknowledgement, watermarked PDF export |
| `crmp-service` | BC3 | CRMP rows, inherent/residual scoring, action plans |
| `controls-service` | BC3 | Control library, test scheduling, sampling calculator |
| `monitoring-service` | BC3 | Compliance Monitoring Plan execution; CCM queries |
| `kci-service` | BC3 | KCI/KRI aggregations |
| `returns-service` | BC4 | Returns Register, scheduling, auto-draft, submission |
| `calendar-service` | BC4 | Aggregated due-date view; ICS export |
| `screening-service` | BC5 | Real-time + batch sanctions/PEP screening |
| `aml-service` | BC5 | Transaction monitoring rule engine (Drools) + behavioural service (Python sidecar) |
| `case-service` | BC5 | AML case management, STR/CTR workbench |
| `nfiu-service` | BC5 | goAML XML generation and submission |
| `kyc-service` | BC6 | Customer onboarding, CDD/EDD/ODD, risk scoring |
| `identity-verify-service` | BC6 | BVN/NIN/CAC/TIN/NIS connectors |
| `complaints-service` | BC7 | Complaints management aligned to CBN Consumer Protection |
| `whistle-service` | BC7 | Anonymous reporter intake and case handling |
| `governance-service` | BC7 | Board composition, fit-and-proper, RPT, AGM, CG attestations |
| `conduct-service` | BC7 | Gifts register, COI, declaration of assets, attestations |
| `abac-service` | BC7 | EFCC/ICPC workflows, freezing-orders |
| `dpo-service` | BC8 | RoPA, DPIA, DSR ticketing, breach 72-hour timer |
| `incident-service` | BC8 | Incident classification, regulator-timer escalation |
| `tax-service` | BC9 | VAT/WHT/EMTL/CIT/Stamp Duty/TET schedules |
| `fatca-crs-service` | BC9 | Indicia, classification, IDES/CRS XML |
| `esg-service` | BC10 | E&S assessment, GHG, NSBP / NCCC disclosures |
| `capmkt-service` | BC11 | Insider list, disclosure, half-year/annual filings |
| `openbank-service` | BC11 | Consent register, TPP onboarding, API logs |
| `account-mgmt-service` | BC12 | Dormant lifecycle, dishonoured cheques, e-Dividend |
| `cash-mgmt-service` | BC12 | Clean Note, counterfeit, cash disbursement, ATM KCIs |
| `sanctions-kb-service` | BC13 | Sanctions Grid query, exposure calculation |
| `training-service` | BC14 | LMS connector, enrolment, attestations |
| `vendor-service` | BC15 | Vendor lifecycle, assessments, certificate expiry |
| `dashboard-service` | Cross | Materialised KPI views; board-pack assembler |
| `audit-service` | Cross | Append-only audit event log; Merkle-root snapshotter |
| `evidence-service` | Cross | S3 Object-Lock evidence storage, hash references |
| `workflow-service` | Cross | Camunda 8 Zeebe orchestration |
| `identity-service` | Cross | Keycloak + SPIRE; access recertification |
| `notification-service` | Cross | Email, SMS, push; templates with maker-checker |
| `audit-replay-service` | Cross | Read-only replay of any event window for examiners |

### 4.4 Data Ownership Rules

- A bounded context **owns** its tables and is the only writer.
- Cross-BC reads happen via **events**, **read models** materialised in the consumer BC, or **service APIs** (never direct DB).
- The `audit_event` table is append-only with no foreign keys; readers join in the analytics warehouse.
- Reference data (regulators, instrument types, areas of focus) is owned by BC1 and replicated to consumers via a **`reference.*`** Kafka topic with versioning.

---

## 5. Physical / Deployment Architecture

### 5.1 Region Strategy

| Layer | Primary | Secondary | Notes |
|---|---|---|---|
| Cloud | AWS af-south-1 (Cape Town) or AWS NG local zone when GA | AWS eu-west-1 with NDPA-compliant cross-border safeguards, OR a second Nigerian region when GA | [NEEDS DECISION] final region pinning awaits CBN approval letter and AWS NG GA |
| In-Nigeria edge | AWS Local Zone or Nigerian Tier-III DC (MainOne / Rack Centre / Open Access) for HSM and DR copies | — | C1, C2 — mandatory in-Nigeria HSM and primary data copy |
| Compute | Amazon EKS (Kubernetes 1.30+) | EKS in DR region | Active-active across two AZs in primary; warm DR in secondary |
| Database | Amazon Aurora PostgreSQL 16 (Multi-AZ) | Cross-region read replica + S3 PITR backups | Encryption with HSM-resident CMK |
| Cache | Amazon ElastiCache Redis (cluster mode) | Cross-region replica | TLS-in-transit, in-VPC only |
| Stream | Amazon MSK (Kafka 3.x) | Cross-region MirrorMaker 2 stream | Idempotent producers; tiered storage for retention |
| Search | Amazon OpenSearch Service 2.x | Snapshot replication | Index per BC; warm tier for archives |
| Object | Amazon S3 with Object Lock (Compliance) | Cross-region S3 replication into NDPA-bound bucket | Evidence vault, regulator PDFs, exports |
| Workflow | Camunda 8 SM (self-hosted on EKS) | DR cluster | Persistent volume snapshots |
| HSM | AWS CloudHSM (Nigerian region) or Thales/Utimaco appliance in Tier-III NG DC | Cross-AZ HSM cluster | FIPS 140-2 L3 if appliance |
| Identity | Keycloak HA on EKS, backed by Aurora Postgres | DR Keycloak | Federated to bank Azure AD/Okta |

### 5.2 Topology

```
       ┌────────────────────────── PRIMARY REGION (NG, active-active) ──────────────────────────┐
       │                                                                                          │
       │   ┌──────── AZ-1 ─────────┐                            ┌──────── AZ-2 ─────────┐         │
       │   │ EKS data plane         │  ←── service-mesh mTLS ──→ │ EKS data plane         │         │
       │   │ Aurora writer          │  ←─── streaming binlog ──→ │ Aurora replica         │         │
       │   │ Redis primary          │                            │ Redis replica          │         │
       │   │ MSK broker set         │  ←──── intra-cluster ────→ │ MSK broker set         │         │
       │   │ OpenSearch master+data │                            │ OpenSearch data+master │         │
       │   └────────────────────────┘                            └────────────────────────┘         │
       │                          ┌────────────────────────────┐                                  │
       │                          │   CloudHSM cluster (NG)    │                                  │
       │                          └────────────────────────────┘                                  │
       │                          ┌────────────────────────────┐                                  │
       │                          │   S3 Evidence + Universe   │ (Object Lock, Compliance mode)   │
       │                          └────────────────────────────┘                                  │
       └────────────────────────────────────────────────┬─────────────────────────────────────────┘
                                                        │
                       Async replication (DR; RPO 15m)  │
                                                        ▼
       ┌─────────────────────── SECONDARY REGION (warm DR) ───────────────────────┐
       │  EKS (scaled-in), Aurora read replica, Redis replica, OpenSearch snapshot │
       │  S3 cross-region replication, MSK MirrorMaker 2                            │
       └────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Network

- **VPC layout (primary region):** 3 tiers — Public (north-south LB + Kong API GW + bastion), App (private subnets, EKS data plane, service mesh), Data (Aurora, MSK, OpenSearch, Redis, HSM — no IGW).
- **Egress:** all outbound via a NAT egress with FQDN allowlist; SWIFT and NIBSS traffic via dedicated VPN/Direct Connect peering.
- **mTLS:** every pod has a SPIFFE ID; Istio enforces mTLS for east-west; Kong + ALB terminates TLS for north-south.
- **CIDR plan:** primary region 10.20.0.0/16; DR region 10.21.0.0/16; bank corporate peering CIDR negotiated.
- **Security groups:** least-privileged; one per role; Aurora is reachable only from app subnet via 5432.

### 5.4 Availability Zones and Failover

- Two AZs active-active for compute and stateless services.
- Aurora primary in AZ-1, synchronous replica in AZ-2; failover automatic via Aurora endpoint.
- Kafka brokers spread 3 AZs (min.isr=2; replication.factor=3).
- OpenSearch master and data nodes across 3 AZs.
- Cross-region DR is warm: Aurora read replica, Kafka MirrorMaker 2, S3 CRR, OpenSearch snapshot restore.
- RPO 15 min; RTO ≤4 hours (single-button DR runbook §18.4).

### 5.5 Capacity (Indicative Starting Point)

| Tier | Resource | Day-1 Sizing | Notes |
|---|---|---|---|
| EKS | Node groups: m6i.2xlarge × 9 across 3 AZs | 36 vCPU / 144 GiB headroom | Horizontal scaling per HPA |
| Aurora | db.r6g.4xlarge writer + 2 readers | 16 vCPU / 128 GiB | Auto-scaling readers up to 10 |
| MSK | 3 × kafka.m5.2xlarge (NG AZs) | 60 MB/s sustained | Tiered storage for long retention |
| OpenSearch | 3 master m6g.large + 6 data r6g.xlarge | 150 GB hot, 1 TB warm | Snapshot daily to S3 |
| Redis | cache.r7g.large × 3 nodes | 13 GB memory | Cluster mode, encrypted |
| HSM | 2 × hsm1.medium (CloudHSM) | — | FIPS 140-2 L3 |
| Camunda | 3 brokers on EKS | — | Persistent volumes |

[ASSUMPTION] Real sizing will be re-tuned in Phase-0 capacity testing (§17.4).

---

## 6. Technology Stack

### 6.1 Stack Bill of Materials

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| JVM | Eclipse Temurin Java | 21 LTS | LTS, virtual threads for IO-heavy services (screening, returns) |
| Framework | Spring Boot | 3.3.x | Production default, mature security |
| Reactive option | Spring WebFlux + Project Reactor | 3.3.x | For high-fanout AML alerting and screening services |
| Build | Gradle (Kotlin DSL) | 8.x | Multi-module monorepo |
| Containers | Distroless / Chainguard images | latest LTS | Smaller attack surface |
| Orchestration | Kubernetes (EKS) | 1.30+ | Mature managed control plane |
| Service mesh | Istio | 1.22+ | mTLS, authz, traffic |
| API gateway | Kong Gateway | 3.7+ | North-south, partner/regulator APIs |
| Workflow | Camunda 8 (Zeebe) | 8.5+ | Long-running state machines |
| Rule engine | Drools / KIE | 9.x | AML scenarios; horizon-scanner classification |
| ML/analytics sidecar | Python + FastAPI | 3.12 + 0.115 | AML behavioural / FP-reduction models |
| RDBMS | PostgreSQL (Aurora) | 16 | Strong ACID + JSONB + native partitioning |
| Search | OpenSearch | 2.13+ | Universe search; alert workbench |
| Cache | Redis | 7.2+ | Sessions, hot reference data, rate limits |
| Stream | Kafka (MSK) | 3.7+ | Backbone for all cross-BC events |
| Object | S3 | n/a | Evidence Vault, regulator PDFs, exports |
| Workflow inbox | Postgres + Liquibase | — | Atomic outbox pattern for events |
| Observability — metrics | Prometheus + Thanos | 2.52 / 0.35 | Long-term metrics |
| Observability — logs | Loki + Promtail / Vector | 3.x | Compliance-grade log retention |
| Observability — traces | Tempo + OpenTelemetry | 2.5 / 1.x | Trace every privileged action |
| Dashboards | Grafana | 11.x | SRE dashboards; CCO has separate UI |
| SIEM ingestion | AWS Security Hub + Wazuh | — | Optional bank SOC integration |
| Identity | Keycloak | 25+ | OIDC + OAuth 2.1 |
| Workload identity | SPIFFE / SPIRE | 1.10+ | Short-lived workload certs |
| Secrets | HashiCorp Vault | 1.16+ | Secrets, transit, certs |
| HSM | AWS CloudHSM | — | FIPS 140-2 L3 keys |
| Doc AI / OCR | AWS Textract + Tesseract fallback | — | M01 horizon scanner |
| Frontend | React + TypeScript + Vite | 18 / 5 / 5.x | Back-office UI |
| Design system | Material UI (MUI) | 5.x | Componentised, accessible (WCAG AA) |
| State mgmt | TanStack Query + Zustand | — | Server state + ephemeral UI state |
| Charts | ECharts | 5.x | Compliance Risk Profile dashboards |
| Testing | JUnit 5, Mockito, Testcontainers, RestAssured, k6, Playwright | latest | Unit/integration/perf/e2e |
| CI/CD | GitHub Actions / GitLab CI + ArgoCD | latest | GitOps deployment |
| IaC | Terraform + Helm | 1.7+ / 3.x | Cloud + cluster |
| Container registry | ECR with image scanning | — | OS + dependency CVE gating |
| SBOM / supply chain | Syft + Grype + Sigstore Cosign | latest | Signed image attestations |
| Linting / security | SonarQube, Snyk, OWASP Dependency-Check, Trivy | latest | SAST/DAST/SCA |
| Code quality gate | SonarQube ≥ A; coverage ≥ 80% | — | Block merge below threshold |

### 6.2 Forbidden / Restricted Technologies

- No Log4j 1.x; no Log4j 2.x < 2.17.2.
- No Spring versions with active CVEs > High at deploy time.
- No `jackson-databind` versions with known RCEs.
- No use of `localStorage` for tokens (cookie-secured, sameSite=Strict, HttpOnly).
- No embedded H2 in production paths.
- No copying of customer PII into developer laptops or non-prod environments without DPO sign-off and pseudonymisation (NFR19).

### 6.3 Spring Module Conventions

- Maven/Gradle convention: each service is a separate Spring Boot 3 app with `actuator`, `security`, `oauth2-resource-server`, `data-jpa`, `data-redis`, `kafka`, `validation`, `webflux`/`web`, `micrometer-otel`.
- Each service exposes `/actuator/health` (LB), `/actuator/info`, `/actuator/prometheus`, and a per-service `/v1/` API surface.
- All controllers return ProblemDetail (RFC 9457) for errors.
- Liquibase per service for schema migrations; no `ddl-auto=update` in prod.

---

## 7. Data Architecture and Storage

### 7.1 Polyglot Persistence Choices

| Concern | Store | Why |
|---|---|---|
| Transactional master data (instruments, obligations, CRMP rows, customers, controls, vendors, policies, returns, complaints, breaches, cases) | PostgreSQL 16 (Aurora) | ACID, JSONB, partitioning, mature operationally |
| Full-text Universe search and CRMP search | OpenSearch 2.x | Boolean / faceted / OCR-text search; per-BC index |
| Hot reference data, session, rate-limit counters | Redis 7 (ElastiCache) | Sub-ms; encrypted in transit |
| Event backbone | Kafka 3.x (MSK) | At-least-once delivery; tiered retention |
| Analytics warehouse (Compliance Risk Profile, board pack, KCI/KRI rollups) | ClickHouse on EKS (or Redshift Serverless) | Columnar, fast aggregations across millions of audit/event rows |
| Evidence Vault (signed PDFs, attachments, exports, audit packs) | S3 with Object Lock (Compliance mode) | WORM-class; cross-region replication |
| Document corpus (regulator PDFs, policies, training materials) | S3 + OpenSearch index of OCR text | Cheap blob + fast retrieval |
| Encryption keys, signing keys, mTLS CA | CloudHSM / Vault Transit | FIPS 140-2 L3 |

### 7.2 Multi-Tenant and Partitioning Strategy

Per `ADR-012`, the platform is multi-tenant-ready but Phase-1 is single-tenant. Every table carries a `tenant_id` UUID with default for the bank. PII tables are partitioned by `tenant_id` and (where high-volume) by month.

- `txn` and `alert`: range-partitioned by `event_date` (monthly) and list-partitioned by `tenant_id`.
- `audit_event`: range-partitioned by month; never updated.
- `customer`: hash-partitioned by `customer_id` for write-scaling.

### 7.3 Logical Data Model (Selected Entities and Relationships)

The conceptual entities from BRD §11.1 (E1–E36) become the persistent tables below. Foreign keys, indexes and constraints are summarised; full DDL is in Appendix B.

**Library context (BC1):**
- `regulator` (id, code, name, jurisdiction)
- `instrument_type` (id, name) seeded with the 13 Drafts types
- `instrument_status` (id, name) seeded with Current / Outdated / Exposure Draft
- `area_of_focus` (id, name) seeded with the 29 Drafts areas
- `nature_of_item` (id, name) seeded with Core / Topical / Secondary / Others
- `risk_rating` (id, name) seeded with High / Medium / Low
- `instrument` (id, source_title, objectives, date_issue, date_commence, date_repeal, regulator_id, instrument_type_id, nature_id, status_id, applicability, comment_on_status, link_url, risk_rating_id, risk_rating_explain, commercial_bank_relevance, commercial_bank_compliance_context, parent_id, full_text_uri, ocr_indexed_at)
- `instrument_theme_link` (instrument_id, theme_id) — linking instruments to CRMP themes (12 themes)
- `obligation` (id, instrument_id, section_ref, plain_statement, frequency, raci_responsible, raci_accountable, raci_consulted, raci_informed, lob, inherent_likelihood, inherent_impact, residual_likelihood, residual_impact, status)
- `obligation_policy_link`, `obligation_control_link`, `obligation_return_link`, `obligation_training_link`

**CRMP context (BC3):**
- `crmp_theme` (id, name) seeded with the 12 themes
- `crmp_row` (id, theme_id, sn, instrument_id, section_ref, title, description, plain_language, risk_description, inherent_l, inherent_i, responsibility, control_text, residual_l, residual_i, additional_control, due_date, final_responsibility)
- `control` (id, name, description, type, nature, frequency, owner_role, tester_role, method, threshold, last_tested, next_due, status, evidence_uri, effectiveness_measure)
- `monitoring_activity` (id, theme_id, activity_id_human, regulatory_requirement, compliance_area, risk_level, compliance_control_id, monitoring_activity_text, frequency, responsible_officer_role, due_date, status, control_effectiveness_measure)
- `kci_kri` (id, name, target_value, threshold, window, formula, last_value, last_calculated)
- `control_test_run` (id, control_id, sample_size, sampled_at, outcome, evidence_uri, tested_by)
- `issue` (id, control_id, severity, opened_at, owner, due_date, status, evidence_uri)

**Returns context (BC4):**
- `return_definition` (id, instrument_id, type_of_return, legal_basis, description, frequency, channel, file_format, regulator_id, responsible_unit, approval_matrix_json)
- `return_run` (id, return_def_id, period_start, period_end, due_date, status, drafted_at, submitted_at, ack_at, ack_ref)
- `return_evidence` (id, return_run_id, evidence_uri, hash)

**Financial Crime (BC5):**
- `screening_list` (id, source, version_tag, fetched_at)
- `screening_list_entry` (id, list_id, type, full_name, aliases, dob, country, score)
- `screening_request` (id, requester, subject_type, subject_id, payload_json, requested_at, latency_ms)
- `screening_hit` (id, request_id, list_entry_id, score, decision, decided_by, decided_at)
- `txn` (id, source_system, posted_at, customer_id, account_id, channel, amount, currency, counterparty, partition month)
- `alert` (id, scenario_id, txn_id, customer_id, severity, opened_at, status, assigned_to)
- `case` (id, type, opened_at, owner, status)
- `case_alert_link`
- `str` (id, case_id, draft_xml_uri, submitted_xml_uri, submitted_at, ack_ref, status)
- `ctr` (id, period_start, period_end, generated_at, submitted_at, ack_ref)
- `cdr` (id, customer_id, declared_at, amount, currency, channel)

**Customer Lifecycle (BC6):**
- `customer` (id, type, full_name, dob, kyc_tier, risk_score, risk_band, onboarded_at, status, dormant_at)
- `customer_identifier` (customer_id, type, value, verified_at, verifier_response_hash)
- `psc` (customer_id, holder_id, percent_held, role)
- `kyc_event` (id, customer_id, type, payload_json, occurred_at)

**Conduct & Governance (BC7):** see §10 module designs.

**Data Protection & Incident (BC8):** `ropa`, `dpia`, `dsr`, `breach`, `incident` per §10.

**Tax / FATCA / CRS (BC9):** see §10.

**ESG (BC10):** `es_assessment`, `ghg_inventory`, `climate_disclosure`.

**Capital Market & Open Banking (BC11):** `insider_list`, `disclosure`, `tpp_consent`, `open_banking_event`.

**Account & Cash (BC12):** `dormant_record`, `dud_cheque`, `counterfeit_event`, `cash_event`.

**Sanctions KB (BC13):**
- `sanction_line` (id, instrument_id, section_ref, offence_text, sanction_text, implication_text, responsible_party_role, source_row_hash)
- `penalty_exposure_view` (materialised) — per theme / regulator / LOB exposure.

**Training (BC14):** `training_module`, `enrolment`, `completion`, `certification`.

**Vendor (BC15):** `vendor`, `vendor_assessment`, `vendor_certificate`, `vendor_dpa_clause`.

**Cross-cutting:**
- `audit_event` (id, occurred_at, actor_id, actor_role, action, subject_type, subject_id, before_json, after_json, ip, session_id, prev_hash, this_hash) — hash-chained.
- `evidence_item` (id, kind, uri, sha256, sealed_at, retention_until, legal_hold_until)
- `merkle_root` (id, period, root_hash, signed_at, signed_by_kms_key_id)
- `user`, `role`, `assignment`, `access_recert_run` — identity tables.

### 7.4 Retention and Legal Hold

Implemented per BRD §11.3 retention table:

| Data Class | Default Retention | Mechanism |
|---|---|---|
| KYC + transactions + STRs | 5 years post relationship end | Aurora archive partition + S3 cold tier; legal-hold flag blocks purge |
| Tax records | 6 years | Aurora archive + S3 |
| Customer personal data | Purpose-bound under NDPA; periodic disposal job | DPO-approved disposal workflow |
| Board / RPT | Permanent (or CAMA min) | Aurora + S3, Object Lock |
| Capital market disclosures | 6+ years | S3 Object Lock |
| Audit trail / Evidence | 5 years min; longer if source obligation demands | S3 Object Lock + Aurora ledger |
| Whistle reports | 5+ years; reporter-identity sensitivity | Encrypted column + role-restricted |
| Sanctions screening records | 5+ years | Aurora + S3 |

A nightly **`retention-broker`** job evaluates each row's class, computes `retention_until`, and queues disposal candidates to a DPO approval workflow.

### 7.5 Reference Data Distribution

- BC1 owns the 6 reference tables (regulator, instrument_type, area_of_focus, nature_of_item, risk_rating, instrument_status) and the 12 `crmp_theme` entries.
- Updates publish a `reference.updated` event on Kafka; consumers materialise local views.
- A bootstrap migration seeds the Day-1 values from the canonical Drafts (43 regulators, 13 item types, 29 areas, 4 nature values, 3 risk ratings, 3 statuses, 12 CRMP themes). See §19.

### 7.6 Encryption

- **At rest:** Aurora storage encryption with HSM-resident CMK; S3 SSE-KMS with the same CMK family; OpenSearch encryption with KMS; Kafka encrypted at rest in MSK.
- **Field-level for PII:** `customer.full_name`, `customer.dob`, identifier values, whistle `reporter_identity_blob` use envelope encryption with `pgcrypto` (AES-256-GCM) and HSM-wrapped DEKs.
- **In transit:** TLS 1.3 everywhere; cipher suites restricted to ECDHE-ECDSA-AES-GCM and ECDHE-RSA-AES-GCM.

---

## 8. Data Model Details and Sample DDL

Sample DDL for two representative tables. Full DDL is in Appendix B.

### 8.1 `instrument` table

```sql
CREATE TABLE instrument (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  source_title        TEXT NOT NULL,
  objectives          TEXT,
  date_issue          DATE,
  date_commence       DATE,
  date_repeal         DATE,
  regulator_id        INT  NOT NULL REFERENCES regulator(id),
  instrument_type_id  INT  NOT NULL REFERENCES instrument_type(id),
  nature_id           INT  NOT NULL REFERENCES nature_of_item(id),
  status_id           INT  NOT NULL REFERENCES instrument_status(id),
  area_of_focus_id    INT  REFERENCES area_of_focus(id),
  sanctions_summary   TEXT,
  applicability       TEXT CHECK (applicability IN ('Yes','No','Partially')),
  comment_on_status   TEXT,
  link_url            TEXT,
  risk_rating_id      INT  REFERENCES risk_rating(id),
  risk_rating_explain TEXT,
  commercial_bank_relevance TEXT,
  commercial_bank_compliance_context TEXT,
  parent_id           BIGINT REFERENCES instrument(id),
  full_text_uri       TEXT,         -- S3 URI to the source PDF
  ocr_indexed_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NOT NULL,
  updated_by          UUID NOT NULL,
  CHECK (date_issue IS NULL OR date_commence IS NULL OR date_commence >= date_issue)
);

CREATE INDEX idx_instrument_regulator ON instrument(regulator_id);
CREATE INDEX idx_instrument_status    ON instrument(status_id);
CREATE INDEX idx_instrument_dates     ON instrument(date_commence DESC, date_issue DESC);
CREATE INDEX idx_instrument_tenant    ON instrument(tenant_id);
```

### 8.2 `audit_event` table (hash-chained)

```sql
CREATE TABLE audit_event (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id      UUID NOT NULL,
  actor_role    TEXT NOT NULL,
  action        TEXT NOT NULL,
  subject_type  TEXT NOT NULL,
  subject_id    TEXT NOT NULL,
  before_json   JSONB,
  after_json    JSONB,
  ip            INET,
  session_id    TEXT,
  prev_hash     BYTEA NOT NULL,
  this_hash     BYTEA NOT NULL,
  CONSTRAINT audit_event_no_update CHECK (false) NO INHERIT
) PARTITION BY RANGE (occurred_at);

-- Trigger blocks UPDATE/DELETE; insertion enforces this_hash = SHA256(prev_hash || canonicalise(row)).
```

The audit-event chain is sealed daily into a Merkle root (`merkle_root`) signed by an HSM-resident key. Examiners can replay any window and prove no tampering occurred.

### 8.3 Indexing Strategy

- Btree on all foreign keys, status/type lookups, and `due_date` columns used by calendars.
- GIN on `obligation.plain_statement` (`pg_trgm`) for in-table fuzzy match; OpenSearch is the primary search.
- Partial indexes on `customer.status='active'`, `alert.status='open'`, `return_run.status IN ('overdue','due')`.
- Covering indexes on dashboard read-paths to avoid heap fetches.

### 8.4 Data Quality and Validation

- Liquibase migrations carry CHECK constraints for every enum-like field.
- JSON Schema validation at the API boundary (Spring `@Valid` + `jakarta.validation` + custom validators for BVN/NIN format).
- Reference-integrity is enforced at the database; cascade rules are explicit (no `ON DELETE CASCADE` except in dependent join tables).
- A nightly **`data-quality`** job emits `dq.*` events for: orphaned rows, stale reference IDs, instruments without an obligation, controls without a policy, returns missing acknowledgements past SLA.

---

## 9. API Architecture

### 9.1 API Styles

- **Sync external/partner APIs (north-south):** REST/JSON over HTTPS through Kong. OpenAPI 3.1 contracts published. mTLS or OAuth 2.1 client-credentials.
- **Sync internal (east-west):** REST/JSON via Istio (mTLS by default). Some hot paths use gRPC.
- **Async (cross-BC):** Kafka events. Schema-registered with Avro or JSON Schema, version-pinned.
- **File-based (regulator):** SFTP for legacy regulator portals; XML envelopes (goAML, FATCA, CRS, eFASS where prescribed).

### 9.2 Versioning, Compatibility and Deprecation

- URI versioning: `/v1/...`. Major version bump on breaking change.
- Backwards compatibility for ≥18 months (`NFR44`). Sunset endpoints carry `Deprecation`, `Sunset` and `Link` headers.
- 90-day deprecation notice via release notes and the API gateway dashboard.

### 9.3 Auth and Authorization

- **External callers:** OAuth 2.1 client-credentials with audience-scoped JWTs. mTLS for high-value integrations (SWIFT, eFASS).
- **Internal callers:** SPIFFE workload identity + mTLS.
- **Human users:** OIDC code-flow with PKCE; refresh tokens rotated; SSO to bank IdP.
- **AuthZ:** RBAC at the service layer using ABAC overrides (LOB, region). Implemented with Spring Security method-security; policy decisions cached in Redis.

### 9.4 Headline API Catalogue

Indicative; full per-module catalogue is in §10.

| API | Method | Path | Module | Notes |
|---|---|---|---|---|
| Universe search | GET | `/v1/universe?q=&type=&regulator=&risk=` | M01 | Read-through to OpenSearch |
| Create instrument | POST | `/v1/universe/instruments` | M01 | Maker; checker via workflow |
| Bulk import instruments | POST | `/v1/universe/imports` | M01 | Multipart XLSX; async job ID returned |
| Get obligation | GET | `/v1/obligations/{id}` | M03 | — |
| Real-time screening | POST | `/v1/screening/realtime` | M07 | p95 ≤500ms |
| AML alert ingest | POST | `/v1/aml/alerts` | M08 | From external AML engine |
| Draft STR | POST | `/v1/str/draft` | M09 | Tipping-off controls |
| Submit STR | POST | `/v1/str/{id}/submit` | M09 | goAML XML |
| Auto-draft return | POST | `/v1/returns/{defId}/run` | M10 | Idempotent |
| Submit return | POST | `/v1/returns/runs/{id}/submit` | M10 | Maker–checker |
| Log complaint | POST | `/v1/complaints` | M11 | Auto-acks |
| Submit DSR | POST | `/v1/dsr` | M12 | 30-day SLA timer starts |
| Log breach | POST | `/v1/breach` | M12 | 72-hour NDPC timer starts |
| Query Sanctions KB | GET | `/v1/sanctions?source=&section=&offence=` | M28 | — |
| Read dashboard KPI | GET | `/v1/dashboard/kpi/risk-profile` | M18 | Materialised view |
| Generate Board Pack | POST | `/v1/board-pack` | M18 | Async, returns job ID |
| Append audit | (internal) | — | M19 | Service-to-service only |

### 9.5 Kafka Topics (Headline)

| Topic | Owner BC | Partitions | Retention | Notes |
|---|---|---|---|---|
| `instrument.published` | BC1 | 6 | 90d | New / updated universe entries |
| `obligation.mapped` | BC1 | 6 | 90d | — |
| `policy.published` | BC2 | 3 | 90d | — |
| `crmp.updated` | BC3 | 6 | 90d | — |
| `monitoring.due`, `monitoring.overdue` | BC3 | 6 | 90d | — |
| `return.due`, `return.submitted`, `return.acknowledged`, `return.overdue` | BC4 | 6 | 365d | Long retention for audit |
| `txn.ingested` | BC5 | 24 | 30d | High volume — tiered storage |
| `screening.hit` | BC5 | 12 | 365d | — |
| `alert.raised`, `case.opened`, `str.submitted` | BC5 | 12 | 365d | — |
| `customer.onboarded`, `customer.risk_changed`, `customer.dormant` | BC6 | 6 | 365d | — |
| `complaint.opened` | BC7 | 3 | 365d | — |
| `whistle.received` | BC7 | 1 | Forever | Restricted access |
| `gift.logged`, `rpt.disclosed` | BC7 | 3 | 365d | — |
| `breach.detected`, `dsr.opened`, `incident.escalated` | BC8 | 3 | 365d | — |
| `tax.return_due`, `crs.filed` | BC9 | 3 | 365d | — |
| `disclosure.filed`, `consent.granted`, `consent.revoked` | BC11 | 3 | 365d | — |
| `account.dormant`, `cheque.dishonoured`, `counterfeit.captured` | BC12 | 3 | 365d | — |
| `sanction.linked` | BC13 | 3 | 365d | — |
| `training.enrolled`, `attestation.completed` | BC14 | 3 | 365d | — |
| `vendor.cert_expiring` | BC15 | 1 | 365d | — |
| `audit.event_appended` | Cross | 12 | 5y (tiered) | Backbone of M19 |
| `reference.updated` | BC1 | 1 | Forever | Compact topic |

### 9.6 Error Model

All sync APIs return RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, plus `traceId`. Validation errors enumerate field-level issues. Idempotency-Key header is honoured on all POSTs that change state.

### 9.7 Idempotency, Replay and Ordering

- All mutating commands carry an `Idempotency-Key`; the broker stores the last response for 24h.
- Kafka producers are idempotent; consumers use deduplication keyed on `(aggregateId, version)`.
- Per-aggregate ordering is preserved by partitioning on aggregate ID (e.g., `customer_id`, `case_id`).

---

## 10. Module-by-Module Technical Design (M01–M30)

Each module below carries: services, persistence, key endpoints, key events, workflow elements, and technical risks. Functional behaviour is in the BRD; here we specify how it is built.

### 10.1 M01 — Regulatory Library & Horizon Scanning

- **Services:** `library-service`, `horizon-service`.
- **Persistence:** Aurora (`instrument`, `obligation`, reference tables); OpenSearch index `universe_v1`; S3 bucket `atheris-regulator-pdfs`.
- **Endpoints:** `POST/GET/PATCH /v1/universe/instruments`, `POST /v1/universe/imports` (XLSX), `GET /v1/universe?q=` (OpenSearch).
- **Events:** publishes `instrument.published`, `obligation.mapped`, `horizon.detected`; subscribes to `reference.updated`.
- **Horizon scanner:** Spring Scheduler runs daily; per-regulator strategy classes implement an `HorizonSource` interface. Each source: fetch index page, diff against last run, download new PDFs, run Textract (with Tesseract fallback for sovereignty-restricted), index to OpenSearch, raise `horizon.detected` event.
- **Workflow:** Camunda process `RegulatoryChange` with states Triage → ImpactAssessment → ImplementationPlan → SignOff → Closed; UI surfaces task lists.
- **TR-M1.1:** Bulk import job is async, returns 202 + Location of job; processes 1,000 rows ≤5 min using Spring Batch + Kafka fan-out.
- **TR-M1.2:** Full-text search must return p95 ≤2s over 50,000 obligations; OpenSearch index uses `n-gram` (size 3) and `phonetic` analysers; multi-field query with field boosts.
- **Risks:** Regulator PDFs vary in quality; OCR confidence is logged and low-confidence flags Triage.

### 10.2 M02 — Policy & Procedure Management

- **Services:** `policy-service`.
- **Persistence:** Aurora (`policy`, `policy_version`, `policy_ack`); S3 (`atheris-policies` with versioned, immutable objects).
- **Endpoints:** `POST /v1/policies`, `POST /v1/policies/{id}/versions`, `POST /v1/policies/{id}/acknowledge`, `GET /v1/policies/{id}/versions/{v}/pdf` (signed URL).
- **Watermarked PDF:** rendered by a `pdf-render` worker (LibreOffice headless) with policy version, owner, watermark text, and embedded signature.
- **Workflow:** `PolicyApproval` BPMN with maker/checker/approver. Annual review timer (60/30/7 days) implemented as a Camunda timer boundary.
- **Acks:** SCIM-synced user list from Keycloak; ack tracked per user, per LOB.

### 10.3 M03 — Obligations Register & Control Mapping

- **Services:** part of `library-service`.
- **Persistence:** `obligation`, `obligation_policy_link`, `obligation_control_link`, `obligation_return_link`.
- **Heat map:** materialised view aggregating residual risk by LOB × CRMP theme; refreshed every 15 minutes.
- **TR-M3.1:** Mandatory unmapped-obligation surfacing on the CCO dashboard (SQL view `vw_unmapped_obligations`).

### 10.4 M04 — RCSA / BRA

- **Services:** `crmp-service`.
- **Persistence:** `crmp_row`, `bra_assessment`, `risk_appetite_threshold`.
- **Engine:** Risk scoring is a deterministic Java service; supports both 5×5 and 3×3 matrices (configurable per institution).
- **Workflow:** `BRACycle` BPMN — Plan → Data Capture → Workshops → Score → Sign-off → Closed; 30-day SLA.
- **Risk appetite:** dashboards consume the `kci_kri` outputs; breaches publish `risk.appetite_breached`.

### 10.5 M05 — Controls Testing and Continuous Monitoring

- **Services:** `controls-service`, `monitoring-service`, `kci-service`.
- **Persistence:** `control`, `control_test_run`, `monitoring_activity`, `kci_kri`, `issue`.
- **Continuous Controls Monitoring:** **`ccm-runner`** is a Spring Batch process triggered by Quartz that reads read-only replicas of source systems and publishes results to `kci_kri`. Each CCM rule is a small Java strategy plus a SQL/Datastore-specific query.
- **Sampling:** `SampleSizeCalculator` implements AICPA/ISA 530 sample-size formulas; samples are stored with `random_seed` for reproducibility.
- **Escalation:** overdue → `monitoring.overdue` event → notification + Camunda escalation tree.
- **TR-M5.1:** Control failure-to-issue latency ≤1h (AC5.1) — achieved by `monitoring-service` writing to `issue` synchronously on failure detection.

### 10.6 M06 — KYC & CDD/EDD/ODD

- **Services:** `kyc-service`, `identity-verify-service`.
- **Connectors:** `nibss-bvn-connector`, `nimc-nin-connector`, `cac-connector`, `firs-tin-connector`, `nis-passport-connector`, `frsc-licence-connector`, `inec-pvc-connector` — each one a separate adapter (Hexagonal port/adapter pattern).
- **Identity-verify orchestration:** asynchronous fan-out via Kafka with a circuit breaker (Resilience4j) on each external call; aggregate result returned to the caller via WebFlux `Mono.zip` for sub-3s p95.
- **PSC register:** `psc` table; CAMA 2020 threshold 5% configurable.
- **Risk-score model:** rule-based JSON scorecard; pluggable to a future ML scorer; output stored on `customer.risk_score` + `risk_band`.
- **Tipping-off safeguard:** even at this stage, sanctions hits route to MLRO; the front-line user sees only "Pending compliance review" with no list/match detail.

### 10.7 M07 — Sanctions, PEP and Adverse-Media Screening

- **Services:** `screening-service`.
- **Persistence:** Aurora (`screening_list`, `screening_list_entry`, `screening_request`, `screening_hit`); Redis (hot list cache); OpenSearch (alias workbench).
- **Algorithms:** exact, Levenshtein, Jaro-Winkler, Soundex, Metaphone (English) + modified phonetics for Yoruba/Hausa/Igbo (custom analyser).
- **Latency:** Redis-cached hot lists + WebFlux non-blocking pipeline → p95 ≤500ms.
- **List refresh:** vendor-specific connectors (Dow Jones, Refinitiv, LexisNexis, Accuity, NIBSS, NFIU). On refresh, `screening-service` rebuilds the in-memory index and emits `screening.list_refreshed`; batch re-screen of customer base kicks off.
- **TFS 24-hour reporting:** `tfs-reporter` subscribes to `screening.hit` filtered by NSC/UN/TPPA designations and creates a `case` with a 24h SLA timer.

### 10.8 M08 — AML Transaction Monitoring

- **Services:** `aml-service` (Drools), `aml-ml-service` (Python sidecar for FP reduction).
- **Persistence:** Aurora (`alert`, `scenario`, `tuning_change`); Kafka `txn.ingested`.
- **Rule library:** Nigerian typologies coded as Drools rules; versioned with maker-checker.
- **Behavioural baseline:** Python service streams `txn.ingested` to compute per-customer baselines using rolling windows in Redis; deviation thresholds produce alerts.
- **Tuning workbench:** historical replay (`audit-replay-service`) to evaluate tuning changes against prior windows.

### 10.9 M09 — STR/CTR/CDR/SAR — NFIU goAML

- **Services:** `nfiu-service`.
- **goAML XML:** schema-validated using JAXB / XSD; pre-submission validator returns line-numbered errors.
- **Submission:** HTTPS to goAML endpoint or SFTP per NFIU spec; acknowledgement parsed and stored.
- **Tipping-off:** `str` table access requires the `MLRO` or `DepCCO` role and is logged in `audit_event` with reason captured.
- **CTR thresholds:** ₦5m / ₦10m aggregator runs nightly using `audit-replay-service` over `txn.ingested`.

### 10.10 M10 — Regulatory Returns Automation

- **Services:** `returns-service`, `calendar-service`.
- **Persistence:** `return_definition`, `return_run`, `return_evidence`.
- **Auto-draft:** each `ReturnDefinition` carries a `DraftStrategy` interface; per-return strategies pull data from owning BCs via stable read APIs and produce the regulator's expected payload (XML, XLSX, JSON or PDF).
- **Submission:** strategy pattern per regulator portal (NFIU goAML, FIRS TaxPro Max, CBN eFASS where API available; SFTP / manual upload with ack-capture otherwise).
- **Day-1 load:** 187 returns from the Drafts Returns Register (§19.4).

### 10.11 M11 — Consumer Protection and Complaints

- **Services:** `complaints-service`.
- **Persistence:** Aurora; SLA timer in Camunda.
- **CCMS integration:** import/export adapter conforming to CBN CCMS schema.

### 10.12 M12 — Data Protection (NDPA)

- **Services:** `dpo-service`.
- **Persistence:** `ropa`, `dpia`, `dsr`, `breach`, `consent`.
- **72-hour breach timer:** Camunda timer activated on `breach.detected`; auto-drafts the NDPC notification XML; routes for DPO sign-off; submits to the NDPC portal.
- **DSR:** Customer-portal-side intake (out of scope here) emits an event; ticket auto-created; identity verification via existing BVN/NIN connectors; fulfilment within 30 days.
- **Cross-border transfer register:** `dpa_transfer` table tracks country, basis (BCR/SCC/certification), safeguards.

### 10.13 M13 — Whistleblowing

- **Services:** `whistle-service`.
- **Persistence:** restricted-access `whistle` table; PII columns encrypted with a separate HSM key (operator-segregated).
- **Reporter protection:** reporter identity never joined to HR records by the system; if a name is provided, it lives in an encrypted blob accessible only to the Ethics Officer + BAC chair.
- **Intake channels:** web form (Atheris), email gateway, SMS connector (NCC-compliant short code via a partner), hotline (3rd-party voice transcription routed back).

### 10.14 M14 — Vendor / TPRM

- **Services:** `vendor-service`.
- **Persistence:** `vendor`, `vendor_assessment`, `vendor_certificate`, `vendor_dpa_clause`.
- **Certificate expiry:** Quartz job 60d/30d/7d before expiry → `vendor.cert_expiring`.
- **Sanctions screening of vendors:** `screening-service` periodic batch.

### 10.15 M15 — Training, Attestation, Certification

- **Services:** `training-service`.
- **Persistence:** Aurora (`training_module`, `enrolment`, `completion`, `certification`).
- **LMS integration:** SCORM / xAPI inbound; HRIS-driven joiner triggers enrolment in role-mandatory modules; expiry timers via Camunda.

### 10.16 M16 — Incident, Breach, Operational Risk

- **Services:** `incident-service`.
- **Persistence:** `incident`, `loss_event` (Basel categories).
- **Regulator timers:** CBN cyber 4-hour internal / 24-hour external; NDPC 72h; SEC for capital-market events. Timers in Camunda.

### 10.17 M17 — Compliance Calendar

- **Services:** `calendar-service`.
- **Persistence:** `calendar_item` is a read-model union of due-dates from all BCs, populated by event subscriptions on `*.due` topics.
- **ICS export:** signed URL endpoint produces per-user ICS feeds.

### 10.18 M18 — Dashboards, Board Pack, Regulator Portal

- **Services:** `dashboard-service`.
- **Persistence:** ClickHouse for high-cardinality aggregates; Aurora for KPI snapshots.
- **Board-pack pipeline:** `board-pack-worker` reads KPI snapshots, renders a PPTX/PDF using Apache POI + LibreOffice headless; sign-off triggers an immutable `evidence_item`.
- **Regulator portal (Phase 2):** separate Kong consumer with read-only scopes; data slices exclude customer PII; sessions are watermarked and time-boxed.

### 10.19 M19 — Audit Trail and Evidence Vault

- **Services:** `audit-service`, `evidence-service`, `audit-replay-service`.
- **Persistence:** Aurora (`audit_event`, hash-chained, partitioned monthly); S3 Object Lock for daily Merkle-root snapshots and evidence packs.
- **Hash chain:** on insert, trigger computes `this_hash = SHA-256(prev_hash || canonical_row_bytes)`. Daily a worker computes the period's Merkle root, signs it with an HSM key, and seals to S3 with Object Lock retention = the longest applicable retention.
- **Replay:** any event window can be re-emitted to a read-only Kafka topic for examiners or for internal forensics.

### 10.20 M20 — FATCA & CRS

- **Services:** `fatca-crs-service`.
- **Persistence:** `fatca_classification`, `crs_filing`, `indicia_review`.
- **Reports:** FATCA IDES XML and CRS XML; submission via IDES (TLS+S/MIME) and via FIRS for CRS.

### 10.21 M21 — Tax Compliance Cockpit

- **Services:** `tax-service`.
- **Persistence:** `tax_calendar`, `tax_return`, `wht_receipt`.
- **TaxPro Max integration:** REST/SOAP adapter; signed payloads; ack capture.

### 10.22 M22 — Conduct Surveillance

- **Services:** `conduct-service` (declarations, gifts, COI), `surveillance-ingest-service` (consumes alerts from market-abuse engine).
- **Persistence:** `gift_record`, `coi_declaration`, `asset_declaration`, `surveillance_alert`.

### 10.23 M23 — Open Banking

- **Services:** `openbank-service`.
- **Persistence:** `tpp_consent`, `tpp`, `open_banking_event`.
- **Consent revocation:** revocation propagates via `consent.revoked` to integration points; effective in minutes (AC23.1).

### 10.24 M24 — ABAC

- **Services:** `abac-service`.
- **Persistence:** `gift_register`, `facilitation_payment_register`, `donation_register`, `third_party_dd`.
- **EFCC freezing-order workflow (WF-07):** intake → core-banking freeze API call → MLRO/Legal review → response composition → audit packet. Latency target ≤30 minutes from intake to freeze (AC24.3).

### 10.25 M25 — Corporate Governance

- **Services:** `governance-service`.
- **Persistence:** `board_member`, `board_committee`, `committee_meeting`, `rpt`, `fit_and_proper_case`, `aga_filing`.
- **Fit-and-proper workflow:** Camunda BPMN includes CBN no-objection touchpoints; status visible on Yetunde's persona dashboard.

### 10.26 M26 — ESG & Sustainable Banking

- **Services:** `esg-service`.
- **Persistence:** `es_assessment`, `ghg_inventory`, `nsbp_disclosure`, `climate_disclosure`.
- **GHG inventory:** schema designed for Scope 1/2/3; periodic import from facilities and the credit book.

### 10.27 M27 — Capital Market Compliance

- **Services:** `capmkt-service`.
- **Persistence:** `insider_list`, `insider_window`, `disclosure_filing`.
- **Insider-trading controls:** when a window is closed, trading instructions tied to listed-on-NGX securities for insiders are blocked at the upstream trading system via API hook.

### 10.28 M28 — Sanctions & Penalties Knowledge Base

- **Services:** `sanctions-kb-service`.
- **Persistence:** `sanction_line`, `penalty_exposure_view`.
- **Exposure calculation:** view aggregates penalty amounts by theme/regulator/LOB; surfaces in dashboards (M18).
- **Day-1 load:** 417 lines from the Drafts (§19.5).

### 10.29 M29 — Account Management

- **Services:** `account-mgmt-service`.
- **Persistence:** `dormant_record`, `dud_cheque`, `e_dividend_mandate`, `bank_charge`.
- **Dormant scheduler:** nightly job classifies accounts per CBN guidelines; produces `account.dormant` events; downstream blocks debits.

### 10.30 M30 — Cash Management

- **Services:** `cash-mgmt-service`.
- **Persistence:** `counterfeit_event`, `cash_event`, `atm_kci`.
- **ATM KCIs:** daily uptime/availability KCIs ingested from the bank's ATM-monitoring solution (CCM connector).

---

## 11. Integration Architecture

### 11.1 Internal Bank Systems

| System | Direction | Pattern | Auth | Notes |
|---|---|---|---|---|
| Core banking (Finacle / T24 / Flexcube / BaNCS / Temenos) | bi-directional | REST + Kafka (events from CDC) | mTLS + OAuth | Customer, txn, freezing-order |
| Card switch (Interswitch / NIBSS) | inbound | Kafka stream | mTLS | Card txn for AML |
| Internet / mobile banking | inbound | Kafka | mTLS | Txn + consent capture |
| AML engine (Actimize / Oracle FCCM / SAS) | bi-directional | REST + Kafka | mTLS | Alert ingest; rule sync |
| Sanctions vendor (Dow Jones / Refinitiv / LexisNexis / Accuity) | inbound | REST + SFTP | API key over mTLS | List refresh |
| HRIS | inbound | SCIM 2.0 | OAuth | Joiner/mover/leaver |
| Active Directory / Azure AD / Okta | inbound | OIDC / SAML | OIDC | SSO + groups |
| GL | inbound | nightly batch | SFTP/API | Tax reconciliation |
| TMS | inbound | REST | OAuth | FX positions, treasury |
| CX system | inbound | REST | OAuth | Complaint feed |
| Tax engine | bi-directional | REST | OAuth | VAT/WHT/EMTL/CIT |
| Email / collab | outbound | SMTP / Graph | OAuth | Notifications |
| DMS | bi-directional | REST/S3 | mTLS | Policy & evidence |
| BCP / DR orchestration | bi-directional | REST | mTLS | Resilience tests |

### 11.2 External Regulator and Industry Systems

| System | Direction | Format | Auth | Notes |
|---|---|---|---|---|
| NIBSS BVN | outbound | REST | mTLS + API key | BVN validation |
| NIBSS Watch-list | inbound | Daily file | SFTP | List refresh |
| NIBSS ICAD | outbound | REST | mTLS | Cross-bank profile |
| NIMC NIN | outbound | REST | mTLS + API key | NIN validation |
| CAC Search / PSC | outbound | REST | OAuth | Corporate lookup |
| FIRS TIN | outbound | REST | mTLS | TIN validation |
| FIRS TaxPro Max | outbound | REST | OAuth | Tax returns |
| NIS Passport | outbound | REST | mTLS | Passport validation |
| FRSC Licence | outbound | REST | mTLS | Driver's licence |
| INEC PVC | outbound | REST | mTLS | Voter card |
| NFIU goAML | outbound | XML | HTTPS + cert | STR/CTR |
| CBN eFASS / FinA / RBS | outbound | XML/XLSX | HTTPS + cert | Returns |
| NDIC | outbound | XLSX | SFTP | Premium |
| SEC e-portal | outbound | PDF/XLSX | HTTPS | Capital-market returns |
| PenCom RBS | outbound | XLSX | HTTPS | Pension returns |
| NDPC | outbound | Web form + API | OAuth | Breach + DSR aggregate |
| SCUML | outbound | XML | HTTPS | DNFBP reports |
| FATCA IDES | outbound | XML over S/MIME | mTLS | FATCA reports |
| OECD CRS (via FIRS) | outbound | XML | HTTPS | CRS reports |
| SWIFT Alliance | bi-directional | MT/MX | mTLS | Payment screening |
| NIBSS NIP / RTGS | bi-directional | ISO 20022 / proprietary | mTLS | Local payment screening |

### 11.3 Integration Patterns

- **Hexagonal / Ports-and-Adapters:** every external system has a `port` interface and a `<system>-adapter` module; tests use Testcontainers for fakes.
- **Circuit breakers:** Resilience4j with bulkheads; default fail-fast at 50% error rate within 30s.
- **Outbox pattern:** writes to `*-outbox` table inside the local transaction; Debezium streams to Kafka.
- **Idempotent consumers:** every consumer deduplicates on `(aggregateId, eventVersion)`.
- **Dead-letter queues:** every consumer has a DLQ with replay tooling.

### 11.4 Failure Modes and Degraded Operation

| Dependency | Failure | Atheris Behaviour |
|---|---|---|
| NIBSS BVN unavailable | Onboarding cannot validate BVN | Tier-1 only allowed; queued retry; flagged for manual close-out |
| NFIU goAML unavailable | STR cannot submit | Hold in `submitted_pending` state; SLA timer pauses with audit; re-submit when up |
| Sanctions vendor list refresh fails | List stale | Continue with last good list; surface staleness on dashboards; SLA breach event |
| CBN eFASS down | Return submission fails | Hold in `submitted_pending`; manual upload as fallback; audit |
| AML engine down | No new alerts ingested | Surfaced on MLRO dashboard; backlog SLA timer starts |
| Core banking down | KYC and CCM affected | Read-only fallback; queued onboarding |

---

## 12. API Catalogue (Indicative — Per Module Endpoints)

### 12.1 Naming Conventions

- Base path: `https://api.atheris.{bank-domain}/v1/`
- Resource-oriented; verbs reserved for action endpoints (e.g., `/submit`, `/acknowledge`).
- Pagination via cursor: `?cursor=&limit=`; default limit 50, max 500.
- All responses include `traceId` from OpenTelemetry context.

### 12.2 Worked OpenAPI Example — Real-time Screening (M07)

```yaml
openapi: 3.1.0
info:
  title: Atheris Real-time Screening API
  version: 1.0.0
paths:
  /v1/screening/realtime:
    post:
      summary: Screen a name + DOB + country against all enabled lists
      security:
        - oauth2: [screening:write]
      parameters:
        - in: header
          name: Idempotency-Key
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [fullName, subjectType]
              properties:
                fullName:    { type: string, maxLength: 200 }
                dob:         { type: string, format: date }
                country:     { type: string, minLength: 2, maxLength: 2 }
                subjectType: { type: string, enum: [customer, counterparty, employee, payment_party] }
                referenceId: { type: string }
      responses:
        '200':
          description: Screening result
          content:
            application/json:
              schema:
                type: object
                properties:
                  requestId: { type: string, format: uuid }
                  decision:  { type: string, enum: [clear, hit, indeterminate] }
                  hits:
                    type: array
                    items:
                      type: object
                      properties:
                        listSource: { type: string }
                        score:      { type: number }
                        listEntryRef: { type: string }
                  latencyMs: { type: integer }
        '400': { $ref: '#/components/responses/Problem' }
        '401': { $ref: '#/components/responses/Problem' }
        '429': { $ref: '#/components/responses/Problem' }
        '503': { $ref: '#/components/responses/Problem' }
components:
  responses:
    Problem:
      description: RFC 9457
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
  schemas:
    Problem:
      type: object
      properties:
        type:    { type: string, format: uri }
        title:   { type: string }
        status:  { type: integer }
        detail:  { type: string }
        instance:{ type: string, format: uri }
        traceId: { type: string }
```

### 12.3 Per-Module Endpoint Index (Selected)

| Module | Endpoints |
|---|---|
| M01 | `POST /v1/universe/instruments`, `GET /v1/universe?q=&type=&regulator=&risk=&area=&status=`, `POST /v1/universe/imports`, `POST /v1/universe/instruments/{id}/triage` |
| M02 | `POST /v1/policies`, `POST /v1/policies/{id}/versions`, `POST /v1/policies/{id}/acknowledge`, `GET /v1/policies/{id}/versions/{v}/pdf` |
| M03 | `GET /v1/obligations`, `POST /v1/obligations/{id}/map-control`, `POST /v1/obligations/{id}/map-policy`, `POST /v1/obligations/{id}/map-return` |
| M04 | `POST /v1/bra/cycles`, `POST /v1/bra/cycles/{id}/sign-off`, `GET /v1/risk-appetite/breaches` |
| M05 | `POST /v1/controls`, `POST /v1/control-tests`, `POST /v1/monitoring/runs`, `GET /v1/kci-kri` |
| M06 | `POST /v1/customers`, `POST /v1/customers/{id}/edd`, `POST /v1/customers/{id}/review`, `POST /v1/customers/{id}/exit` |
| M07 | `POST /v1/screening/realtime`, `POST /v1/screening/batch`, `GET /v1/screening/hits` |
| M08 | `POST /v1/aml/alerts`, `POST /v1/aml/cases`, `POST /v1/aml/tuning` |
| M09 | `POST /v1/str/draft`, `POST /v1/str/{id}/submit`, `POST /v1/ctr/runs`, `POST /v1/cdr` |
| M10 | `POST /v1/returns/{defId}/run`, `POST /v1/returns/runs/{id}/submit`, `POST /v1/returns/runs/{id}/ack` |
| M11 | `POST /v1/complaints`, `POST /v1/complaints/{id}/resolve`, `POST /v1/complaints/{id}/escalate` |
| M12 | `POST /v1/dsr`, `POST /v1/breach`, `POST /v1/ropa`, `POST /v1/dpia` |
| M13 | `POST /v1/whistle`, `POST /v1/whistle/{id}/triage` |
| M14 | `POST /v1/vendors`, `POST /v1/vendors/{id}/assess`, `POST /v1/vendors/{id}/certs` |
| M15 | `POST /v1/training/enrolments`, `POST /v1/training/completions`, `POST /v1/attestations` |
| M16 | `POST /v1/incidents`, `POST /v1/incidents/{id}/escalate`, `POST /v1/incidents/{id}/close` |
| M17 | `GET /v1/calendar?from=&to=&owner=`, `GET /v1/calendar/ics?token=` |
| M18 | `GET /v1/dashboard/kpi/risk-profile`, `GET /v1/dashboard/kpi/crmp-heat`, `POST /v1/board-pack` |
| M19 | `GET /v1/audit/events?from=&to=` (Internal Audit only); `POST /v1/evidence` |
| M20 | `POST /v1/fatca/classify`, `POST /v1/crs/filings` |
| M21 | `POST /v1/tax/runs`, `POST /v1/tax/runs/{id}/submit` |
| M22 | `POST /v1/conduct/declarations`, `POST /v1/gifts`, `POST /v1/coi` |
| M23 | `POST /v1/open-banking/consents`, `POST /v1/open-banking/tpps` |
| M24 | `POST /v1/abac/gifts`, `POST /v1/abac/freeze-orders` |
| M25 | `POST /v1/governance/board-members`, `POST /v1/governance/fit-and-proper`, `POST /v1/governance/rpts` |
| M26 | `POST /v1/esg/es-assessments`, `POST /v1/esg/ghg`, `POST /v1/esg/disclosures` |
| M27 | `POST /v1/capmkt/insider-list`, `POST /v1/capmkt/disclosures` |
| M28 | `GET /v1/sanctions?source=&section=&offence=&party=` |
| M29 | `POST /v1/accounts/dormant-classify`, `POST /v1/cheques/dud` |
| M30 | `POST /v1/cash/counterfeit`, `POST /v1/cash/disbursement-incidents` |

---

## 13. Security Architecture

### 13.1 Principles

- **Zero-trust:** no network is trusted; every call is authenticated and authorised.
- **Least privilege:** roles, scopes, and database grants are role-narrow.
- **Segregation of duties:** maker, checker, approver are distinct identities.
- **Defence in depth:** WAF, mTLS, app-layer authz, DB row-level security, field-level encryption, audit log.
- **No security through obscurity:** every control is documented and audited.

### 13.2 Identity and Access Management

- **Human users:** OIDC SSO to bank IdP (Azure AD / Okta) via Keycloak. MFA required (TOTP / FIDO2 / push). Session 30 minutes idle / 8 hours absolute.
- **Service accounts:** SPIFFE / SPIRE workload identities; mTLS via Istio.
- **External callers:** OAuth 2.1 client-credentials; mTLS for regulators/partners.
- **Authorisation:** RBAC with attributes (LOB, region) via Spring Security; permissions per BRD §14.3 matrix.
- **Privileged Access Management:** all admin actions go through Vault-broker JIT elevation; commands recorded; ≤30 min sessions.
- **Access recertification:** quarterly review; stale accounts expire automatically; integrates with HRIS leaver events.

### 13.3 Network Security

- **WAF:** AWS WAF at the ALB with OWASP Core Rule Set; custom rules for known bad actors and JSON-RPC fuzzing.
- **Egress allowlist:** outbound restricted to NIBSS, NIMC, CAC, FIRS, NFIU, SWIFT, regulator portals, vendor APIs by FQDN.
- **Pod security:** PodSecurity Admission `restricted`; no `hostNetwork`, no `hostPID`, read-only rootfs, drop all caps + add only required.
- **Network policies:** Calico/Cilium network policies per service; default deny.

### 13.4 Encryption

- **TLS:** TLS 1.3 internal; TLS 1.2 minimum for legacy regulator endpoints. Cipher allowlist enforced.
- **At rest:** Aurora storage encryption (KMS-CMK in CloudHSM); S3 SSE-KMS; MSK encryption-at-rest; OpenSearch encryption.
- **Field-level:** PII (`full_name`, `dob`, identifiers, whistle blob, STR drafts) AES-256-GCM with envelope DEKs in HSM-wrapped CMKs. Decryption is per-call, audited.
- **Key rotation:** annual for CMKs; on-demand for compromise; backward-compatible decryption via key version IDs.

### 13.5 Secrets Management

- HashiCorp Vault for application secrets, DB credentials, third-party API keys.
- Short-lived dynamic credentials for DB access.
- Vault Transit for application-level signing operations where HSM access is too coarse.

### 13.6 OWASP ASVS Level 2 Coverage

The build conforms to ASVS L2 controls. Key chapters:

- V2 Authentication: OIDC + MFA + password policy + bot/abuse mitigation at IdP.
- V3 Session: short cookie sessions; SameSite=Strict; HttpOnly; CSRF token for state-changing browser flows.
- V4 Access Control: server-side; tested via authorization unit tests on every endpoint.
- V5 Validation: Bean Validation; allowlist input; no string-concat SQL.
- V7 Error Handling: ProblemDetail; no stack traces to clients; structured logs server-side.
- V8 Data Protection: field-level encryption; no PII in logs; redaction filter on the logging appender.
- V9 Communications: TLS 1.3; HSTS preload.
- V10 Malicious Code: SCA (Snyk/OWASP DC) + SBOM (Syft); image signing (Cosign).
- V12 File and Resources: signed URLs; antivirus/CDR scan for uploads (Bitdefender + ClamAV).
- V14 Configuration: 12-factor configuration; secrets in Vault; no commit of `.env`.

### 13.7 Anti-Tipping-Off and STR Confidentiality (M09)

- `str` and `case_str_link` tables have row-level security: only `mlro`, `dep_cco`, `dpo` (for breach-link cases) roles can SELECT.
- Read access logged as a privileged event in `audit_event` with reason capture.
- Notifications related to STRs go to a separate, role-restricted channel; no broadcast.

### 13.8 Cyber-Resilience Programme (For the Platform)

- **CBN Risk-Based Cybersecurity Framework** annual self-assessment of the platform; results submitted to CBN as part of the bank's cyber-resilience cycle. `NFR30`.
- **Cybercrime Act 2015 (as amended)** incident-reporting obligations recognised in `incident-service` workflows. `NFR24`.
- **Pen-test:** annual external pen-test by a CBN-recognised firm; quarterly internal red-team exercises.
- **Threat modelling:** STRIDE per service at design; living document.

---

## 14. NFR Implementation

### 14.1 Performance Budgets

| NFR | Target | Implementation |
|---|---|---|
| NFR1 Screening p95 ≤500ms | Hot list in Redis; Bloom filter pre-screen; WebFlux non-blocking; index lookups < 5ms | Tested with k6 |
| NFR2 Onboarding p95 ≤3s | Parallel calls (`Mono.zip`) to BVN+NIN+CAC+screening; per-call budget 800ms with circuit-breaker | k6 with synthetic BVN/NIN mocks |
| NFR3 AML alert ≤30s p99 | Kafka pipe; Drools rules evaluated in <100ms per txn; alert write async with idempotent producers | k6 + stream replay |
| NFR4 Search p95 ≤2s | OpenSearch with warm shards; query templates with bounded depth | k6 |
| NFR5 Dashboard refresh ≤5m | Materialised views + Debezium CDC; cache invalidation on event | Synthetic observe |
| NFR6 Bulk import 1k rows ≤5m | Spring Batch + Kafka fan-out + idempotent writes | Load test |
| NFR7 Board pack ≤60s | Pre-aggregated KPI snapshots + parallel renderers | Stopwatch test |
| NFR8 Returns auto-draft ≤2m | Per-return strategy with pre-warmed read models | k6 |
| NFR9 Evidence pack ≤4h | Async assembly job; signed S3 packaging | Stopwatch test |

### 14.2 Scalability

- Each service horizontally scales via HPA (CPU, memory, custom metrics).
- Aurora reader auto-scaling; reader endpoint for read-mostly routes.
- Kafka partitions sized for 24 partitions on `txn.ingested` to support 1B txn/yr (`NFR15`).
- OpenSearch warm tier kicks in beyond 90 days.

### 14.3 Reliability and Resilience

- See §15.

### 14.4 Security NFRs

- See §13.

### 14.5 Auditability

- All audit events go through `audit-service` synchronous write before the calling service returns success; loss of the audit write is treated as failure of the user action.

### 14.6 Localisation

- All UIs are i18n-ready (`react-i18next`); first release ships en-NG; Hausa/Yoruba/Igbo locale packs for selected customer-facing artefacts as Phase 2.
- All dates stored as UTC; rendered in WAT.
- Currency module supports NGN primary plus a configurable list.

### 14.7 Accessibility

- WCAG 2.1 AA compliance verified with axe-core and Pa11y in CI.

### 14.8 Data Residency

- Production region pinned via Terraform with policy guards (AWS SCPs deny cross-region writes for prod accounts except the DR replicas).
- S3 buckets carry replication rules pointing to the NDPA-bound DR bucket only.
- Cross-border vendor support sessions are evidence-only; no production data leaves NG without DPO sign-off.

---

## 15. Resilience and Disaster Recovery

### 15.1 Failure Domains and Targets

- **Pod failure:** automatic restart; HPA scales out; no user impact.
- **AZ failure:** active-active; LBs re-route; no data loss.
- **Region failure:** DR failover; RPO ≤15m, RTO ≤4h.
- **Vendor dependency failure:** circuit-breakers + queued retries; degraded but explicit.

### 15.2 Backup and Restore

- Aurora PITR (35 days) + daily snapshots cross-region.
- S3 versioned + cross-region replicated; Object Lock prevents deletion.
- Kafka MirrorMaker 2 replicates topics to DR cluster.
- OpenSearch nightly snapshot to S3; restore drill quarterly.

### 15.3 DR Runbook (Outline)

1. Declare DR (Head of SRE + CCO + CIO).
2. Promote Aurora reader in DR; DNS cut-over via Route 53 weighted routing.
3. Scale up EKS in DR; ArgoCD deploys current versions.
4. Replay Kafka backlog from MirrorMaker 2 cursor.
5. Validate critical workflows (screening, return submission, audit append).
6. Notify regulators that require notification per CBN Cybersecurity Framework.

### 15.4 DR Test Cadence

- Tabletop quarterly.
- Live failover annually.
- Backup restore drill quarterly.

---

## 16. Observability

### 16.1 Three Pillars

- **Metrics:** Prometheus / Thanos; OpenTelemetry SDK in every service; standard Spring Boot Actuator + custom business metrics (e.g., `atheris_returns_submitted_total`, `atheris_screening_latency_ms`).
- **Logs:** structured JSON via Logback; Loki for storage; redaction filter prevents PII leaks. Logs retained 90 days hot + 5 years cold (Object Lock).
- **Traces:** OpenTelemetry + Tempo; sample rate 5% in production, 100% in non-prod; trace IDs propagated via W3C Trace Context.

### 16.2 SLOs (Service Level Objectives)

| Service | SLO | Window |
|---|---|---|
| Screening real-time | 99.9% success, p95 ≤500ms | 30d rolling |
| KYC onboarding | 99.5% success, p95 ≤3s | 30d rolling |
| Universe search | 99.9% success, p95 ≤2s | 30d rolling |
| Returns submission | 99% on-or-before-due, success ≥99% | per quarter |
| STR submission | 99% within 24h of detection | per month |
| Dashboard | 99% refresh ≤5m | 30d rolling |
| Platform availability | 99.9% business hours, 99.5% 24×7 | per month |

### 16.3 Alerting

- Burn-rate alerts on SLOs (multi-window 1h/6h).
- Critical alerts: PagerDuty to on-call SRE; secondary to CCO/CISO.
- Business alerts: overdue returns, overdue STR, sanction list staleness > 24h, breach 72h timer < 24h remaining.

### 16.4 Dashboards (Grafana)

- Platform Health (P0).
- SLO Burn Rates.
- Per-service golden signals (latency, traffic, errors, saturation).
- AML pipeline (txn ingest → rule eval → alert raise).
- Returns calendar status.
- Audit-event ledger growth and gaps.

### 16.5 Audit vs. Operational Logs

Operational logs are for SRE; audit events live in `audit_event` and S3 sealed packages, governed by M19 retention and tamper-evidence. The two streams never share storage.

---

## 17. DevOps and CI/CD

### 17.1 Repositories

- Monorepo with per-service modules under `services/`, frontend under `web/`, infrastructure under `infra/`.
- Trunk-based development; short-lived feature branches; squash merges.
- Conventional Commits; semantic versioning per service.

### 17.2 Build Pipeline (per service)

1. `lint` (Spotless / ESLint)
2. `unit-test` (JUnit 5 / Mockito; coverage ≥80% gate)
3. `sast` (SonarQube; quality gate A)
4. `sca` (Snyk + OWASP DC; block High/Critical)
5. `secret-scan` (Gitleaks)
6. `build` (Gradle / Vite)
7. `package` (distroless container; reproducible build)
8. `image-scan` (Trivy; block High/Critical)
9. `sign` (Cosign + SBOM Syft)
10. `integration-test` (Testcontainers; Postgres, Kafka, Redis, WireMock)
11. `contract-test` (Pact between consumer/producer)
12. `deploy-dev` (ArgoCD)
13. `e2e-test` (Playwright + k6 smoke)
14. Manual approval → `deploy-staging` → `deploy-prod`

### 17.3 Environments

| Env | Purpose | Data | Access |
|---|---|---|---|
| `dev` | Developer sandboxes | Synthetic | Developers + QA |
| `test` | Automated integration | Synthetic | CI |
| `staging` | UAT, perf tests, DR drills | Pseudonymised prod subset (DPO-approved) | Eng + UAT + SRE |
| `prod` | Live | Real | SRE + on-call + Internal Audit (RO) |
| `dr` | Warm DR | Replicated | SRE only |

### 17.4 Performance Test Plan

- k6 load profiles per critical path: screening, onboarding, AML pipeline, returns submission, dashboard.
- Soak tests (24h) per quarter.
- Chaos engineering (Litmus or Gremlin) monthly: pod kill, AZ kill, dependency latency injection.
- Day-0 performance baseline established in Phase-0; thereafter regression budget ≤5% degradation per release.

### 17.5 Release Management

- Quarterly major release; monthly minor; weekly patch; hotfix on demand (NFR45).
- Blue/green for stateless services; canary (5% → 25% → 100%) for screening and AML.
- Release notes published; APIs follow §9.2 deprecation rules.

### 17.6 GitOps

- ArgoCD reconciles cluster state from `infra/` repo.
- Drift detection alerts SRE on unauthorised changes.

---

## 18. Operations and Runbook Outlines

### 18.1 On-Call Model

- 24×7 SRE rotation with primary + secondary; tied into PagerDuty.
- Business-hours rota for CCO/MLRO/DPO escalation paths.

### 18.2 Runbooks (Headline)

- **R-001 Service down:** SLO degradation playbook.
- **R-002 Aurora primary failover:** validation steps post-failover.
- **R-003 Kafka broker loss:** rebalancing and consumer lag investigation.
- **R-004 Sanctions list stale:** vendor failover, manual upload.
- **R-005 goAML submission failure:** retry, contact NFIU helpdesk, log breach if persistent.
- **R-006 CBN cyber-incident:** triage, 4-hour internal report, 24-hour CBN notification.
- **R-007 NDPC breach trigger:** 72-hour timer protocol.
- **R-008 EFCC freezing-order intake:** core-banking freeze API + escalation.
- **R-009 Regulator examination support:** evidence-pack on demand.
- **R-010 DR failover:** stepwise per §15.3.

### 18.3 Capacity Management

- Monthly capacity review by SRE + product.
- Annual capacity plan signed by CIO.
- Auto-scaling thresholds documented and version-controlled.

### 18.4 Change Management

- All prod changes via merge requests with mandatory reviewers.
- Standard / Normal / Emergency change classes; standard changes pre-approved.
- Window: maintenance windows weekly Sun 02:00–05:00 WAT; emergency changes any time with post-change review.

---

## 19. Data Migration and Day-1 Load

### 19.1 Approach

A single **`day1-loader`** Spring Batch application reads the canonical Drafts XLSM (`Compliance Management Toolkits DRAFT.xlsm`) and produces a staged Aurora load with referential integrity. The loader is idempotent (re-runnable) and emits a `migration-report.xlsx` enumerating each source row, target table, target ID, and validation status.

### 19.2 Order of Operations

1. **Reference taxonomies** — load `regulator` (43 rows), `instrument_type` (13), `area_of_focus` (29), `nature_of_item` (4), `instrument_status` (3 + Exposure Draft), `risk_rating` (3), `crmp_theme` (12).
2. **Instruments** — load 352 rows from `Compliance Universe` into `instrument` with FK lookups by name; mismatches go to `migration_exceptions`.
3. **CRMP rows per theme** — read 12 theme sheets (Conduct Risk, Corporate Governance, Data Protection, Financial Reporting, Capital Market, ESG, Cybersecurity, Consumer Protection, ABAC, AMLCFT, Actmgt, Cash Mgt) plus master `CRMP` sheet (1,227 rows). De-duplicate against the master where overlap is detected.
4. **Monitoring activities** — load 236 rows from `Compliance Monitoring Plan` into `monitoring_activity`.
5. **Returns** — load 187 rows from `Returns and Remittance` into `return_definition`.
6. **Sanctions** — load 417 rows from `Sanctions and Penalties` into `sanction_line`.
7. **Linkages** — build `obligation_*_link` tables from sheet relationships (Universe ↔ CRMP, CRMP ↔ Sanction lines via instrument).
8. **Index rebuild** — OpenSearch index of `instrument` and `obligation` populated from Aurora.

### 19.3 Validation Rules at Load Time

- `instrument.source_title` non-null.
- `regulator_id` resolvable; if not, exception row created with proposed match.
- `instrument_type_id` resolvable.
- `applicability ∈ {Yes, No, Partially}`.
- `risk_rating_id` resolvable; if mapping is blank, default to "Not assessed" placeholder + flag for triage.
- Dates parse; `date_commence ≥ date_issue` if both present.
- Sanctions `responsible_party_role` mapped to a real role; otherwise placeholder + flag.

### 19.4 Day-1 Counts (Targets per the Drafts)

| Artefact | Count | Drafts Sheet | Target Table |
|---|---|---|---|
| Regulators | 43 | Regulators | `regulator` |
| Instrument types | 13 | Regulatory Item Types | `instrument_type` |
| Areas of focus | 29 | Area of Focus | `area_of_focus` |
| Statuses | 3 (+ Exposure Draft) | Status | `instrument_status` |
| Risk ratings | 3 | Risk Rating | `risk_rating` |
| Nature values | 4 | Sheet4 + Definitions | `nature_of_item` |
| CRMP themes | 12 | Definitions § CRMP Categories | `crmp_theme` |
| Instruments | 352 | Compliance Universe | `instrument` |
| CRMP rows (per theme) | ≥1,227 cumulative | CRMP + 12 theme sheets | `crmp_row` |
| Monitoring activities | 236 | Compliance Monitoring Plan | `monitoring_activity` |
| Returns | 187 | Returns and Remittance | `return_definition` |
| Sanctions | 417 | Sanctions and Penalties | `sanction_line` |

### 19.5 Post-Load Day-1 Tasks

- CCO walks the `migration-report.xlsx`; resolves exceptions in a guided UI.
- Library and CRMP heat-map renders.
- A "Day-1 BRD acceptance pack" PDF auto-generated showing every loaded count vs target.
- Sanctions KB exposure dashboard renders.

### 19.6 Subsequent Migrations

- Customer migration from core banking: separate `customer-loader` ingests via REST/streaming with PSC built from CAC where present; performed per Phase-3 cut-over (see BRD §F).
- Historical alerts / STR import optional and out of scope unless the bank requests.

### 19.7 Idempotency and Re-Runs

- Each source row carries a synthetic `source_row_hash`; the loader skips rows whose hash already exists in the target with a `staged_unchanged` status.

---

## 20. Compliance of the Platform Itself

The platform must comply with the same regimes its users use it to comply with. The table summarises which platform controls satisfy which obligation classes.

| Obligation Class | Platform Controls |
|---|---|
| CBN Risk-Based Cybersecurity Framework | §13 Security Architecture; §16 Observability; §17 SDLC; annual self-assessment §13.8 |
| NDPA 2023 / NDPR 2019 / GAID 2025 | §14.8 Data residency; §13.4 Encryption; field-level PII encryption; access logs; DPO sign-off on non-prod use; M12 lifecycle |
| Cybercrime Act 2015 (Amended) | §13 + R-006 (CBN cyber-incident runbook) |
| ISO 27001 | §13 (ISMS); §17 (SDLC); §16 (monitoring); §15 (BCP/DR) |
| ISO 22301 (BCP) | §15 Resilience + R-010 DR runbook + annual live failover |
| Money Laundering Act 2022 (record-keeping) | §7.4 Retention; M19 evidence vault |
| CAMA 2020 (records permanence for board) | §7.4 retention; S3 Object Lock |
| BOFIA 2020 (banking secrecy) | §13.7 STR/confidentiality; row-level security; access logging |
| Wolfsberg ABAC Principles (third-party DD) | M14 + M24 |
| FATF Recommendations (Compliance Function) | M01, M03, M04 |

### 20.1 Platform-Specific NDPA Posture

- Atheris is a **data processor** for the institution. A signed DPA between bank and Atheris vendor is in place, with NDPC-aligned clauses (sub-processing, breach notification, audit rights, data return/destruction at exit).
- The platform maintains its **own RoPA** for the data it processes; the DPO can audit it directly.
- Sub-processors (cloud, list vendors, OCR) are listed in a sub-processor register; changes are notified 30 days in advance.

### 20.2 Sub-Processor Register (Sample)

| Sub-Processor | Purpose | Data Categories | Region | Safeguards |
|---|---|---|---|---|
| AWS (af-south + NG zone) | Hosting | All | NG / SA | DPA + SOC 2 + ISO 27001 + region-pinning |
| CloudHSM | Key custody | Encryption keys | NG | FIPS 140-2 L3 |
| Dow Jones / Refinitiv / LexisNexis | Sanctions lists | Sanctions data | Multiple | Vendor DPA |
| Email provider | Notifications | User contact data | TBD | DPO-approved |
| OCR (AWS Textract) | OCR | Regulator PDFs (public) | NG/SA | Public data only |
| LMS partner (M15) | Training delivery | Staff training records | TBD | DPA |

---

## 21. Risks, Open Decisions and Assumptions

### 21.1 Technical Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| TR-R1 | Region pinning constrains performance | M | M | Use NG edge / Local Zone; cache-first design; DR in second NG region |
| TR-R2 | Vendor list-refresh API rate limits | M | M | Pre-negotiated rates; backpressure with queued refresh |
| TR-R3 | Drools rule complexity drifts | M | M | Per-rule unit tests; canary scenarios; sandbox replay |
| TR-R4 | goAML schema change mid-build | M | H | Schema versioning; pre-submission validator with rollback |
| TR-R5 | Camunda cluster persistent volume corruption | L | H | Daily snapshot; PV-replication; quarterly restore drills |
| TR-R6 | Kafka backpressure under txn surges | M | M | 24 partitions on `txn.ingested`; tiered storage; producer rate limiting |
| TR-R7 | OpenSearch index bloat from poor OCR | M | M | OCR confidence gating; archival to warm tier |
| TR-R8 | Aurora long-running migration blocks releases | M | M | Online schema changes (pg_repack / lazy backfills); Liquibase preconditions |
| TR-R9 | Loss of audit ledger continuity | L | C | Hash chain; daily Merkle root sealed to S3 Object Lock; alerting on chain break |
| TR-R10 | Sub-processor failure | L | H | Multi-vendor strategy where possible; DR runbook |

### 21.2 Open Decisions

| ID | Decision | Owner | Target |
|---|---|---|---|
| OD-1 | AWS NG region GA vs af-south-1 + NG local zone | CIO + CISO | Phase 0 |
| OD-2 | HSM choice (CloudHSM vs on-shore Thales/Utimaco) | CISO | Phase 0 |
| OD-3 | Authoritative local PEP list source (M07) | CCO + MLRO | Phase 0 |
| OD-4 | Sanctions vendor selection (Dow Jones / Refinitiv / LexisNexis / Accuity) | CCO + Procurement | Phase 0 |
| OD-5 | Regulator portal scope (M18 §FR18.9) | CCO + DPO + Board | Phase 8 |
| OD-6 | LMS partner integration (SCORM vs xAPI) | HR + Procurement | Phase 5 |
| OD-7 | Customer-portal-side DSR intake build (separate channel app) | DPO + Eng | Phase 6 |
| OD-8 | E&S/GHG data pipeline (build vs buy) | Sustainability + CIO | Phase 7 |
| OD-9 | Whistleblowing voice intake provider | Ethics + Procurement | Phase 5 |
| OD-10 | Multi-tenant deployment for sister entities | CIO | Post-Phase 8 |

### 21.3 Assumptions

- Bank-side IdP exists and supports OIDC.
- NIBSS, NIMC, CAC, FIRS, NFIU credentials and SLAs available before Phase 3 cut-over.
- A signed DPA exists between bank and Atheris vendor before any real-data load.
- The bank's existing AML, sanctions, market-abuse engines expose alert/refresh APIs or can be wrapped.
- Quarterly maintenance windows are agreed with operations.

---

## 22. Technical Glossary

| Term | Definition |
|---|---|
| ADR | Architecture Decision Record. |
| AZ | Cloud Availability Zone. |
| BC | Bounded Context. |
| CCM | Continuous Controls Monitoring. |
| CMK | Customer Master Key (KMS). |
| DEK | Data Encryption Key. |
| GitOps | Configuration-as-code via Git as the source of truth. |
| HPA | Horizontal Pod Autoscaler. |
| IaC | Infrastructure-as-Code. |
| ISMS | Information Security Management System. |
| JIT | Just-In-Time (privileged access). |
| KMS | Key Management Service. |
| KPI / KCI / KRI | Key Performance / Control / Risk Indicator. |
| MFA | Multi-Factor Authentication. |
| OIDC | OpenID Connect. |
| OTel | OpenTelemetry. |
| PII | Personally Identifiable Information. |
| RACI | Responsible, Accountable, Consulted, Informed. |
| RBAC | Role-Based Access Control. |
| RPO / RTO | Recovery Point / Time Objective. |
| SBOM | Software Bill of Materials. |
| SLO | Service Level Objective. |
| SPIFFE / SPIRE | Workload identity framework. |
| WAF | Web Application Firewall. |
| WORM | Write Once Read Many (S3 Object Lock). |

---

## 23. Appendices

### Appendix A — Bill of Materials (Indicative)

| Component | Vendor / Project | Edition / Tier | Justification |
|---|---|---|---|
| Cloud | AWS af-south-1 + NG edge / Aurora / MSK / OpenSearch / EKS / S3 / CloudHSM | Production | Mature, in-region, CBN-aligned |
| K8s mesh | Istio (open-source) | OSS | mTLS + traffic policy |
| API gateway | Kong Gateway | Enterprise | Plugins, rate-limit, OIDC |
| Identity | Keycloak | OSS / self-hosted | OIDC + SAML federation |
| Workflow | Camunda 8 SM | Production | Long-running BPMN |
| Rule engine | Drools / KIE | OSS | Mature AML rule patterns |
| Search | OpenSearch | OSS | Universe + alert workbench |
| Stream | MSK (Kafka) | Managed | Backbone |
| Cache | ElastiCache (Redis) | Managed | Hot data |
| Frontend | React + MUI + Vite | OSS | Modern, accessible |
| Observability | Prometheus / Loki / Tempo / Grafana | OSS | Vendor-neutral |
| Secrets | HashiCorp Vault | Enterprise | Dynamic creds + transit |
| Code quality | SonarQube + Snyk + OWASP DC + Trivy | Mixed | Defence in depth |
| Build | Gradle | OSS | Multi-module |
| CI/CD | GitHub Actions / GitLab CI + ArgoCD | Mixed | GitOps |

### Appendix B — Sample DDL (Selected)

**`crmp_row`**

```sql
CREATE TABLE crmp_row (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  theme_id            INT  NOT NULL REFERENCES crmp_theme(id),
  sn                  INT,
  instrument_id       BIGINT REFERENCES instrument(id),
  section_ref         TEXT,
  title               TEXT NOT NULL,
  description         TEXT,
  plain_language      TEXT,
  risk_description    TEXT,
  inherent_l          TEXT CHECK (inherent_l IN ('High','Medium','Low')),
  inherent_i          TEXT CHECK (inherent_i IN ('High','Medium','Low')),
  responsibility      TEXT,
  control_text        TEXT,
  residual_l          TEXT CHECK (residual_l IN ('High','Medium','Low')),
  residual_i          TEXT CHECK (residual_i IN ('High','Medium','Low')),
  additional_control  TEXT,
  due_date            DATE,
  final_responsibility TEXT,
  source_row_hash     BYTEA UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NOT NULL,
  updated_by          UUID NOT NULL
);
CREATE INDEX idx_crmp_theme ON crmp_row(theme_id);
CREATE INDEX idx_crmp_instrument ON crmp_row(instrument_id);
```

**`monitoring_activity`**

```sql
CREATE TABLE monitoring_activity (
  id                          BIGSERIAL PRIMARY KEY,
  tenant_id                   UUID NOT NULL,
  theme_id                    INT  NOT NULL REFERENCES crmp_theme(id),
  human_id                    TEXT UNIQUE,                 -- e.g. ABAC001
  regulatory_requirement      TEXT,
  compliance_area             TEXT,
  risk_level                  TEXT CHECK (risk_level IN ('High','Medium','Low')),
  compliance_control_id       BIGINT REFERENCES control(id),
  monitoring_activity_text    TEXT,
  frequency                   TEXT,
  responsible_officer_role    TEXT,
  due_date                    DATE,
  status                      TEXT CHECK (status IN ('Not Tested','In Progress','Completed','Pass','Fail','Partial','Overdue','Closed')),
  control_effectiveness_measure TEXT,
  evidence_uri                TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`sanction_line`**

```sql
CREATE TABLE sanction_line (
  id                  BIGSERIAL PRIMARY KEY,
  tenant_id           UUID NOT NULL,
  instrument_id       BIGINT REFERENCES instrument(id),
  section_ref         TEXT,
  offence_text        TEXT NOT NULL,
  sanction_text       TEXT NOT NULL,
  implication_text    TEXT,
  responsible_party_role TEXT,
  source_row_hash     BYTEA UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sanction_instr ON sanction_line(instrument_id);
CREATE INDEX idx_sanction_party ON sanction_line(responsible_party_role);
```

**`return_definition` / `return_run`**

```sql
CREATE TABLE return_definition (
  id                  BIGSERIAL PRIMARY KEY,
  instrument_id       BIGINT REFERENCES instrument(id),
  type_of_return      TEXT NOT NULL,
  legal_basis         TEXT,
  description         TEXT,
  frequency           TEXT NOT NULL,
  channel             TEXT,
  file_format         TEXT,
  regulator_id        INT  REFERENCES regulator(id),
  responsible_unit    TEXT,
  approval_matrix     JSONB,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE return_run (
  id                  BIGSERIAL PRIMARY KEY,
  return_def_id       BIGINT NOT NULL REFERENCES return_definition(id),
  period_start        DATE,
  period_end          DATE,
  due_date            DATE NOT NULL,
  status              TEXT CHECK (status IN ('queued','drafted','approved','submitted','acknowledged','overdue','failed')) DEFAULT 'queued',
  drafted_at          TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ,
  ack_at              TIMESTAMPTZ,
  ack_ref             TEXT,
  evidence_uri        TEXT
);
CREATE INDEX idx_return_run_due ON return_run(due_date) WHERE status IN ('queued','drafted','overdue');
```

### Appendix C — Sample Sequence Flows (Text)

**Real-time payment screening (M07)**

```
Payment Gateway --(POST /v1/screening/realtime)--> Kong --(mTLS)--> screening-service
  screening-service.RedisCache → list-entries (≤2ms)
  screening-service.Matcher → Levenshtein/Jaro-Winkler/Soundex (≤30ms)
  if hit:
    screening-service emits screening.hit (Kafka)
    case-service consumer creates a case; MLRO workbench surfaces it
  return: decision, hits, latencyMs
Total budget ≤500ms p95
```

**STR submission (M09, WF-03)**

```
MLRO Workbench --(POST /v1/str/draft)--> case-service → str row (status: drafted)
MLRO --(POST /v1/str/{id}/submit)--> nfiu-service
  nfiu-service generates goAML XML
  XSD validation pre-submission
  HTTPS submit to NFIU goAML
  parse acknowledgement; update str.status='submitted'
  emit str.submitted (Kafka)
  audit-service appends event
Tipping-off rule: any read of str row goes through RLS + audit_event
```

**NDPC 72-hour breach notification (WF-04)**

```
incident-service receives breach.detected
  Camunda starts BreachTimer (72h) with intermediate timer markers at 24h/48h
dpo-service drafts NDPC notification, routes to DPO
DPO signs off → submit to NDPC portal
  if 72h elapsed without submission → escalate to CCO + CIO; audit-service flags as breach-of-timer
```

### Appendix D — Sequence Numbering of BRD Functional Rules to TRD Services

| BRD `FR` Range | TRD Service / Component |
|---|---|
| `FR1.*` | `library-service`, `horizon-service`, `evidence-service` |
| `FR2.*` | `policy-service` |
| `FR3.*` | `library-service` (obligation), `crmp-service` |
| `FR4.*` | `crmp-service` (BRA module) |
| `FR5.*` | `controls-service`, `monitoring-service`, `kci-service`, `audit-replay-service` |
| `FR6.*` | `kyc-service`, `identity-verify-service` |
| `FR7.*` | `screening-service`, `case-service` |
| `FR8.*` | `aml-service`, `aml-ml-service` |
| `FR9.*` | `nfiu-service`, `case-service` |
| `FR10.*` | `returns-service` |
| `FR11.*` | `complaints-service` |
| `FR12.*` | `dpo-service` |
| `FR13.*` | `whistle-service` |
| `FR14.*` | `vendor-service` |
| `FR15.*` | `training-service` |
| `FR16.*` | `incident-service` |
| `FR17.*` | `calendar-service` |
| `FR18.*` | `dashboard-service` |
| `FR19.*` | `audit-service`, `evidence-service` |
| `FR20.*` | `fatca-crs-service` |
| `FR21.*` | `tax-service` |
| `FR22.*` | `conduct-service`, `surveillance-ingest-service` |
| `FR23.*` | `openbank-service` |
| `FR24.*` | `abac-service` |
| `FR25.*` | `governance-service` |
| `FR26.*` | `esg-service` |
| `FR27.*` | `capmkt-service` |
| `FR28.*` | `sanctions-kb-service` |
| `FR29.*` | `account-mgmt-service` |
| `FR30.*` | `cash-mgmt-service` |

### Appendix E — Initial Engineering Team Shape (Indicative)

| Squad | Members | Focus |
|---|---|---|
| Platform / SRE | 4 | EKS, observability, security, DR |
| Regulatory Backbone | 6 | M01–M03, M17, M18, M19 |
| Financial Crime | 8 | M06–M09, M28 |
| Returns & Tax | 5 | M10, M20, M21 |
| Conduct & Governance | 5 | M11, M13, M22, M24, M25 |
| Data & DPO | 4 | M12, M16 |
| ESG / Capital Market / Cash & Account / Open Banking | 6 | M23, M26, M27, M29, M30 |
| Vendor / Training / Cross-cutting | 3 | M14, M15 |
| Frontend | 5 | Back-office UI, design system |
| QA | 4 | Automation, performance, security |
| Total | ~50 | — |

### Appendix F — Mapping BRD Acceptance Criteria to TRD Verifications

| BRD AC | Verification Method (in this TRD) |
|---|---|
| AC1.1 (Day-1 load) | §19 day1-loader migration report |
| AC1.2 (24h horizon lag) | Synthetic regulator-publication monitor in §16 |
| AC1.3 (search p95 ≤2s) | k6 load test §14.1 / §17.4 |
| AC5.1 (control fail → issue ≤1h) | Integration test + Prom alert §14.5 |
| AC6.1 (BVN+NIN ≤3s p95) | k6 + Resilience4j budget §10.6 / §14.1 |
| AC7.1 (sanctions list refresh ≤4h) | Vendor SLA + monitor §10.7 |
| AC7.2 (false-positive ≤30%) | Tuning workbench + monthly KPI dashboard |
| AC9.1 (goAML XSD pass ≥99%) | Pre-submission validator metrics §10.9 |
| AC9.2 (STR submission within 24h ≥98%) | SLO §16.2 |
| AC10.1 (returns on time ≥98%) | SLO §16.2 |
| AC12.1 (NDPC 72h ≥99%) | Camunda timer test + audit §10.12 |
| AC18.1 (dashboard refresh ≤5m) | Synthetic observe §16.4 |
| AC19.1 (replay end-to-end) | `audit-replay-service` test §10.19 |
| AC28.1 (417 lines loaded) | Day-1 load count check §19.4 |
| (All NFRs) | Performance test plan §17.4 |

---

**End of Document**




---

## Appendix G — Technical Architecture Addendum (v1.1)

> This appendix documents all technical decisions made during the engineering design session of 19 May 2026. It supersedes or supplements individual sections of TRD v1.0 where noted.

---

### G.1 — ADR Updates

#### ADR-004 (Updated): Event Bus — Kafka Replaced by PostgreSQL Job Queue for MVP

**Original decision:** Kafka for all cross-service async communication.

**Revised decision:** PostgreSQL `job_queue` table + Spring `@Scheduled` cron processors for MVP.

**Rationale:**
- Nigerian regulatory volume: ≤10 new documents per day across all 43 regulators. Kafka is designed for millions of events per second. The infrastructure cost and operational overhead are not justified.
- A `job_queue` table with `FOR UPDATE SKIP LOCKED` provides equivalent ordering and at-least-once delivery guarantees at zero infrastructure cost.
- The abstraction is compatible with migration to a proper message queue when volume demands it.

**Job queue schema:**
```sql
CREATE TABLE job_queue (
  job_id          BIGINT PRIMARY KEY,
  job_type        VARCHAR(100) NOT NULL,  -- 'ocr_document' | 'classify_instrument'
                                          -- | 'evaluate_applicability' | 'send_webhooks'
  subject_type    VARCHAR(50),
  subject_id      BIGINT,
  payload         JSONB NOT NULL,
  status          VARCHAR(50) DEFAULT 'pending',
  priority        INT DEFAULT 0,          -- 1=HIGH (monitoring), 0=LOW (backfill)
  attempt_count   INT DEFAULT 0,
  max_attempts    INT DEFAULT 3,
  last_error      TEXT,
  next_retry_at   TIMESTAMP,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  created_by_service VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW()
);
```

**Cron schedule:**
```
*/15 * * * *    Horizon scanner (monitoring mode)
*/2  * * * *    OCR processor
*/5  * * * *    AI classifier
*/5  * * * *    Applicability evaluator
*/5  * * * *    Webhook sender
*/30 * * * *    Webhook retry
0    * * * *    Anomaly detector
*/10 * * * *    Backfill processor (LOW priority, skips if HIGH jobs pending)
```

**Migration path to Kafka:** Replace `jobQueue.claimOne()` calls with Kafka consumer subscriptions. No business logic changes required.

---

#### ADR-007 (Updated): Headless Browser — Playwright Replaces Selenium

**Original decision:** Selenium WebDriver + WebDriverManager for JavaScript-rendered regulator sites.

**Revised decision:** Microsoft Playwright (`com.microsoft.playwright:playwright:1.44.0`).

**Rationale:**

| Issue with Selenium | Playwright solution |
|---|---|
| `Thread.sleep(3000)` — guessing when JS loads | `page.waitForSelector(selector)` — deterministic |
| ChromeDriver version conflicts with Chrome | Playwright bundles its own Chromium — zero version management |
| Frequent crashes in Docker containers | Built for Docker/headless from inception |
| No native image/media blocking | `page.route()` blocks images, fonts, CSS — faster page loads |
| No built-in download interception | `page.waitForDownload()` native API |

**Setup (one-time, in Dockerfile):**
```dockerfile
RUN mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI \
    -D exec.args="install chromium"
```

**Key implementation — PlaywrightBrowserPool:** Singleton Spring `@Component` that launches one shared Chromium process on `@PostConstruct` and closes it on `@PreDestroy`. Per-scrape sessions use `browser.newContext()` (lightweight isolated context, like incognito), not a new browser.

**Three pagination strategies implemented:**
- `NEXT_BUTTON` — follows CSS-selected next page link
- `PAGE_PARAM` — increments `?page=N` URL parameter
- `YEAR_FOLDERS` — navigates `/2024/` → `/2023/` → `/2022/`

---

#### ADR-015 (New): Tenant Isolation — PostgreSQL Schema-Per-Tenant

**Decision:** Each tenant gets a dedicated PostgreSQL schema (`atheris_tenant_{tenant_id}`). Application uses `SET search_path TO {schema}` per request.

**Alternatives considered:**

| Approach | Risk | Decision |
|---|---|---|
| Shared tables with `tenant_id` column | One missing WHERE clause exposes all tenants | Rejected |
| Separate databases | Operational overhead, connection pool explosion | Rejected |
| Schema-per-tenant | Cross-tenant data leakage impossible at DB level | **Accepted** |

**Implementation:**
- `TenantContextHolder` (ThreadLocal) — holds current schema name for request thread
- `TenantSchemaFilter` (Spring filter, Order=2, runs after JWT filter) — sets `search_path` per request
- Schema name validated against regex `tenant_[a-z0-9_]+` before use — prevents SQL injection
- `TenantProvisioningService` — creates schema + runs Flyway migrations on tenant onboarding
- Deactivated tenants: schema retained (regulatory audit requirement), `is_active = false` blocks login

---

#### ADR-016 (New): Auth — JWT + Rotating Refresh Tokens

**Decision:** Stateless JWT access tokens (15 min) + rotating refresh tokens stored as SHA256 hashes in PostgreSQL.

**Token design:**

| Token | Lifetime | Storage | Notes |
|---|---|---|---|
| Access token (JWT) | 15 minutes | Client only | Contains userId, email, role. Signed HS256. |
| Refresh token | 30 days | `refresh_tokens` table (hash only) | Raw token never stored. Rotated on each use. |
| Invite token | 72 hours | `invite_tokens` table (hash only) | One-time use. Marks `used_at` on acceptance. |
| Password reset token | 1 hour | `invite_tokens` table (hash only) | One-time use. Revokes all refresh tokens on completion. |

**Security controls:**
- Raw tokens never stored — only SHA256 hash. DB compromise does not yield usable tokens.
- Refresh token rotation — old token revoked on each use. Stolen token detected on next legitimate use.
- Account lockout — 5 failed login attempts → 15-minute lockout. `locked_until` timestamp in `users` table.
- Password reset revokes ALL refresh tokens — forces re-login on all devices.
- HTTPS enforced — tokens never transmitted over plain HTTP.

---

### G.2 — Distributed SaaS Architecture (Technical Detail)

#### G.2.1 Central Platform Services

```
atheris-platform (Spring Boot 3.x, Java 21)
├── RegulatorController          → CRUD + test scraper endpoint
├── DocumentUploadController     → Manual PDF upload + queue
├── InstrumentController         → Regulatory library management
├── ClassificationService        → Claude API wrapper
├── ApplicabilityService         → Tenant routing logic
├── TenantController             → Platform admin manages tenants
├── WebhookService               → HMAC sign + POST delivery
├── JobQueueProcessors           → All @Scheduled cron workers
├── ScraperService               → Routes to HTML or Playwright
├── HtmlScraperStrategy          → JSoup static HTML parsing
├── PlaywrightHeadlessStrategy   → Playwright JS rendering
├── PlaywrightBrowserPool        → Shared Chromium singleton
├── PdfExtractionService         → PDFBox + Tesseract fallback
├── StorageService               → S3 streaming multipart upload
└── ScraperAnomalyDetector       → Hourly health checks + alerts
```

#### G.2.2 Tenant Application Services (Not Yet Fully Designed — v2.1)

```
atheris-tenant (Spring Boot 3.x, Java 21)
├── WebhookReceiverController    → Receives platform webhooks ✅ Designed
├── AuthController               → Login, invite, password reset ✅ Designed
├── UserController               → Team management ✅ Designed
├── TenantProfileController      → Own profile + regulator subscriptions ✅ Designed
├── ObligationController         → Classify received obligations ❌ Not yet designed
├── ControlController            → CRMP, controls register ❌ Not yet designed
├── ControlTestController        → Test scheduling + recording ❌ Not yet designed
├── FindingController            → Gap + remediation workflow ❌ Not yet designed
├── ReturnController             → 187 return calendar + filing ❌ Not yet designed
├── DashboardController          → Live metrics + board pack ❌ Not yet designed
└── AuditController              → Evidence vault + examiner portal ❌ Not yet designed
```

#### G.2.3 Communication Pattern

```
Central Platform → Tenant:   Webhook (HTTP POST, HMAC-signed)
Tenant → Central Platform:   REST API (tenant API key, optional — for profile sync)
Tenant → Tenant:             None (tenants are fully isolated)
```

The central platform never initiates a database connection to a tenant schema. All tenant data flows through the webhook receiver.

---

### G.3 — PDF Processing Pipeline (Technical Detail)

#### G.3.1 OCR Strategy

```java
// Decision tree — PDFBox first, Tesseract fallback
String text = pdfExtractor.extractText(pdfBytes);

private String extractText(byte[] pdf) {
    String text = extractWithPdfBox(pdf);
    if (text.length() >= 100) return text;     // Digital PDF — done
    return extractWithTesseract(pdf);           // Scanned image — OCR
}
```

**Why this works for Nigerian regulators:** CBN, SEC, NDIC, NAICOM and most other Nigerian regulators publish digitally-created PDFs (not scanned images). PDFBox extracts these in milliseconds with no API call. Tesseract is only invoked for older scanned regulations — estimated <5% of documents.

#### G.3.2 Streaming Download (Replaces byte[] approach)

```
HTTP InputStream
    ↓
DigestInputStream (SHA256 computed on the fly)
    ↓
S3 multipart upload (8MB chunks)
    ↓
Hash finalised after upload — stored as S3 object metadata
```

Peak memory per download: 8MB (one chunk buffer). Previously: entire PDF in memory (up to 500MB).

---

### G.4 — Webhook Delivery Technical Specification

#### G.4.1 Three Webhook Types

| Type | Trigger | Action Required |
|---|---|---|
| `obligation.received` | New obligation matched to tenant | Tenant classifies — assign owner, link controls |
| `obligation.applicability_updated` | Platform re-evaluates applicability (e.g. ISA 2025 clarified) | Tenant reviews previous decision |
| `obligation.superseded` | Regulation repealed or replaced | Tenant may retire linked controls |

#### G.4.2 Security

```
X-Atheris-Signature: sha256={HMAC_SHA256(body, webhook_secret)}
X-Webhook-Event-ID: webhook_20260531_001
X-Webhook-Timestamp: 2026-05-31T02:14:22Z
```

Tenant validates:
1. HMAC-SHA256 signature matches
2. `webhook_id` not already processed (idempotency key)
3. Timestamp within 5 minutes (replay attack prevention)
4. Return 200 OK only after successful DB insert

#### G.4.3 Retry Schedule

```
Attempt 1 → immediate
Attempt 2 → 5 minutes
Attempt 3 → 15 minutes
Attempt 4 → 1 hour
Attempt 5 → 4 hours
Final     → 1 day, then mark permanently failed + alert
```

---

### G.5 — Data Model Additions (v1.1)

The following tables are additions to TRD v1.0 §7–8:

**Central platform additions:**
- `tenant_eligibility_rules` — pre-computed routing rules per instrument
- `webhook_delivery_log` — delivery audit trail with retry tracking
- `scraper_run_logs` — per-regulator scrape history
- `backfill_jobs` — resumable historical import tracking
- `job_queue` — cron-based event pipeline (replaces Kafka topics)
- `queue_metrics` — job queue health monitoring

**Tenant additions (per-schema):**
- `tenant_profile` — tenant's own profile + subscribed regulators
- `users` — tenant staff with invite lifecycle fields
- `invite_tokens` — invite + password reset tokens (hash only)
- `refresh_tokens` — JWT refresh token store (hash only, per device)
- `role_permissions` — reference table mapping roles to resource/action pairs

---

### G.6 — Open Decisions Carried Forward

| ID | Decision | Impact |
|---|---|---|
| OD-1 | AWS af-south-1 (Cape Town) cannot be primary production region for CBN-regulated data. In-Nigeria hosting required. MainOne/Rack Centre/Open Access DC evaluation needed. | Blocks Phase 0 closure. |
| OD-2 | HSM vendor and model for Nigeria-resident key storage. | Blocks encryption key architecture. |
| OD-3 | PEP list source and curation methodology. | Blocks M07 sanctions screening. |
| OD-4 | Playwright browser provisioning in production Kubernetes — privileged container vs sidecar vs managed browser service. | Blocks scraper deployment. |
| OD-5 | Tenant deployment model: Atheris-hosted SaaS vs self-managed per-bank deployment. | Impacts tenant provisioning and network architecture. |

---

**End of Addendum**

