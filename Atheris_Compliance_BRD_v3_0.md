# BUSINESS REQUIREMENTS DOCUMENT
## ATHERIS COMPLIANCE MANAGEMENT SOLUTION
### An Integrated Regulatory Compliance, Risk Management and Monitoring Platform for Nigerian and African Financial Institutions

| Field | Value |
|---|---|
| Product Code | ATHERIS-CMS-3.0 |
| Document Title | Business Requirements Document — Atheris Compliance Management Solution |
| Version | 3.0 (Architecture-Aligned, Implementation-Integrated) |
| Status | Engineering Review Draft |
| Date | 19 May 2026 |
| Prepared by | Mohammed Ali / Engineering Review |
| Classification | Internal — Confidential |
| Supersedes | NGCOMPLY BRD v1.0 (May 2026), Atheris BRD v2.0 (May 2026), Atheris BRD v2.1 (May 2026) |
| Canonical Source | Compliance Management Toolkits DRAFT (working file) + Engineering Design Session 19 May 2026 |

---

## 1. Document Control

### 1.1 Version History

| Version | Date | Author | Change Summary | Approver |
|---|---|---|---|---|
| 0.1 | 2026-05-10 | M. Ali | Initial outline | — |
| 0.5 | 2026-05-12 | M. Ali | Functional requirements drafted across 23 modules | — |
| 1.0 | 2026-05-13 | M. Ali | Engineering-review-ready draft including Appendix A regulatory universe (36 obligations) | Pending CCO |
| **2.0** | **2026-05-14** | **M. Ali** | **Consolidated and extended BRD. Carries through every feature, sub-feature, workflow and capability described in the Compliance Management Toolkits DRAFT (352-obligation Compliance Universe, twelve CRMP category registers, master CRMP, Compliance Monitoring Plan, Returns & Remittance register, Sanctions & Penalties grid, Compliance Risk Profile analytics and all reference data). Adds modules M24–M30, expands data model, RBAC, integrations, regulatory mapping, traceability matrix and acceptance criteria.** | **Pending CCO, CRO, CISO, DPO, Head Engineering, Internal Audit, Board Risk Committee** |
| **2.1** | **2026-05-19** | **Engineering Review** | **Architecture and implementation design session additions. Added: (1) Distributed multi-tenant SaaS architecture — central intelligence platform with tenant-isolated environments; (2) Horizon Scanner / Scraper service fully specified (JSoup + Playwright, two-mode monitoring vs backfill, reliability improvements including streaming PDF download, Resilience4j retry, provenance snapshots, anomaly detection); (3) Central regulatory intelligence data model (regulators, instruments, obligation_mappings, sanctions_and_penalties, tenant_eligibility_rules, regulatory_change_log); (4) Tenant data model (received_obligations, controls, control_test_results, findings, regulatory_returns, return_filing_instances, audit_events, dashboard_snapshots); (5) Cron-based event pipeline replacing Kafka — job_queue table, five scheduled processors; (6) Webhook delivery system — obligation.received, obligation.applicability_updated, obligation.superseded with HMAC-SHA256 signing and retry logic; (7) User management — invite token flow, JWT + refresh tokens, role-based access (PLATFORM_ADMIN, TENANT_ADMIN, CCO, ANALYST, AUDITOR, VIEWER); (8) Tenant isolation via PostgreSQL separate schemas with TenantContextHolder and schema-per-tenant provisioning; (9) Six pain point analysis — Ngozi persona, current Excel toolkit mapped to Atheris solution. Open decisions: cloud region (OD-1), tenant deployment model (hosted vs self-managed), Playwright browser provisioning in production containers.** | **Engineering Review** |
| **3.0** | **2026-05-19** | **Engineering Review** | **Consolidated final version. All documents merged into four canonical files: (1) BRD v3.0 (this document); (2) TRD v2.0; (3) Atheris_Technical_Implementation.md (merges all 10 implementation documents into seven sections); (4) Atheris_Pain_Points_and_Solutions.md (maps each pain point to implementing components). BRD updated to reflect two-product model: Product 1 = Regulatory Intelligence API (standalone, for institutions with existing GRC); Product 2 = Full compliance platform. Two operating modes added: Incremental Monitoring (15-min cycle) and Historical Backfill (resumable, LOW priority). Tenant onboarding wizard (4-step: institution → regulators → document types → review) with per-regulator subscription overrides. Regulator subscriptions drive applicability routing — tenants only receive obligations from subscribed regulators matching their licence type. Immutability principle formalised: PDF text, OCR output and AI classification computed once, shared to all eligible tenants. Central platform solves Pain Points 1 and 2 (first half). Tenant application solves Pain Points 2–6 (design deferred to next session).** | **Engineering Review** |

### 1.2 Document Owners and Approvers

| Role | Name / Function | Responsibility |
|---|---|---|
| Document Owner | Chief Compliance Officer (CCO) | Maintains the BRD; sole authority to approve content changes |
| Business Sponsor | Executive Director, Risk Management / Chief Risk Officer | Business case, budget, board reporting |
| Subject-Matter Approver — Financial Crime | MLRO / Head, Financial Crime Compliance | Approves Sections covering M06–M09 (KYC, Screening, Transaction Monitoring, NFIU goAML) and M28 (Sanctions and Penalties Knowledge Base) |
| Subject-Matter Approver — Data Protection | Data Protection Officer (DPO) | Approves Section M12, all data-protection NFRs |
| Subject-Matter Approver — Regulatory | Head, Regulatory Compliance | Approves M01–M03, M10, M17, M28, regulatory landscape |
| Subject-Matter Approver — Consumer Protection | Head, Consumer Protection | Approves M11 |
| Subject-Matter Approver — Conduct & ABAC | Head, Conduct Risk / Ethics | Approves M22, M24 |
| Subject-Matter Approver — Corporate Governance | Company Secretary / Head, Governance | Approves M25 |
| Subject-Matter Approver — ESG | Head, Sustainability & ESG | Approves M26 |
| Subject-Matter Approver — Capital Market | Head, Treasury / Investment Banking Compliance | Approves M27 |
| Security Approver | Chief Information Security Officer (CISO) | Approves NFRs, security architecture, cyber-resilience |
| Build Lead | Head of Engineering | Receives BRD as build specification |
| Independent Reviewer | Chief Internal Auditor | Reviews for completeness and audit-ability |
| Implementation Partner | Selected systems integrator | Receives BRD as scope of work input |
| Board Risk Committee | Non-executive directors | Final sign-off on the business case and scope |

### 1.3 Distribution List

Chief Compliance Officer; Chief Risk Officer; Chief Internal Auditor; MLRO / Head FCC; Data Protection Officer; Head, Regulatory Compliance; Head, Consumer Protection; Head, Conduct Risk; Company Secretary; Head, Sustainability & ESG; Head, Treasury & Investment Banking Compliance; CISO; Head of Engineering; Implementation Partner Lead; Board Risk Committee Secretariat; Board Audit Committee Secretariat. Distribution beyond this list requires written authorisation from the CCO.

### 1.4 Document Conventions

- **Functional Requirements** are uniquely identified as `FR<module>.<n>` (e.g., `FR1.1`). IDs are stable across versions.
- **Acceptance Criteria** are uniquely identified as `AC<module>.<n>`.
- **Non-Functional Requirements** are identified as `NFR<n>`.
- **Data Entities** are identified as `E<n>`.
- **Workflows** are identified as `WF-<n>`.
- **Regulatory Obligations** carry IDs of the form `OBL-<theme>-<seq>` mapped to source instruments.
- **Assumptions** and **decisions still needed** are explicitly flagged as `[ASSUMPTION]` or `[NEEDS DECISION]`.

---

## 2. Executive Summary

Nigerian banks, capital market operators, insurance companies, Pension Fund Administrators, payment service banks, microfinance banks, mortgage banks and other licensed financial institutions operate under one of the densest and most rapidly evolving regulatory regimes in Africa. The bank's own working inventory — captured in the Compliance Management Toolkits DRAFT that is the canonical source for this BRD — already enumerates **three hundred and fifty-two (352) discrete statutory, regulatory and supervisory obligations** drawn from **forty-three (43) regulatory and industry bodies**, of which **two hundred and fifteen (215, or 62%) carry a High residual risk rating** within the commercial bank context. The inventory spans **twenty-nine (29) areas of focus** including AML/CFT/CPF, foreign exchange operations, payment management systems, credit risk, corporate governance, consumer protection, cybersecurity, data protection, tax compliance, ESG, capital market operations and people & conduct risk. The Central Bank of Nigeria alone accounts for **two hundred and seventy-five (275) of those 352 obligations**, supplemented by SEC, NDIC, NFIU, NDPC, FIRS, NAICOM, PenCom, EFCC, ICPC, FRC, CAC, FCCPC, NITDA, NIMC, the Federal Government of Nigeria, the Lagos State Government, FATF/GIABA and the Wolfsberg Group, among others.

Compliance breaches in Nigeria attract administrative penalties from N1 million to N1 billion per infraction, suspension or revocation of licences under section 12 of BOFIA 2020, personal criminal liability for directors and the Chief Compliance Officer under the Money Laundering (Prevention and Prohibition) Act 2022, and administrative fines under the Nigeria Data Protection Act (NDPA) 2023 of up to ₦10 million or 2% of annual gross revenue. Beyond the headline figures, exposure is escalating: CBN alone now issues 80–150 instruments per year, and the half-life of a CBN circular before it is amended or superseded is under eighteen months.

Despite this exposure, the prevailing tooling across Nigerian financial institutions remains spreadsheets, SharePoint document libraries, locally hosted GRC tools designed for US/EU markets, and a series of disconnected vendor systems for AML, KYC, sanctions screening and regulatory reporting. The result is duplicated effort, evidence that cannot be produced quickly during CBN Risk-Based Supervision (RBS) examinations, late or inaccurate returns to eFASS, FinA and goAML, residual financial-crime risk and rising compliance run-cost.

This Business Requirements Document specifies the build of **Atheris** — an integrated, Nigeria-first Regulatory Compliance Management platform that operationalises the bank's full compliance lifecycle described in the canonical Drafts. The platform converts the spreadsheet-based Compliance Universe, the per-theme Compliance Risk Management Plans (CRMPs), the Compliance Monitoring Plan, the Returns and Remittance Register and the Sanctions and Penalties Grid into a single cloud-native, role-based, evidence-bearing system. It covers the five-phase compliance process documented in the User Guide of the Drafts: (i) developing and maintaining the Regulatory Universe and Compliance Risk Profile; (ii) developing and maintaining Compliance Risk Management Plans across the twelve canonical themes — AML/CFT/CPF, Account Management, Anti-Bribery & Corruption, Cash Management, Consumer Protection, Corporate Governance, Cybersecurity, Data Protection, Financial Reporting, ESG, People & Conduct Risk, and Capital Market; (iii) developing and operating Compliance Monitoring Plans; (iv) executing returns, remittances and breach reporting; and (v) reporting to management, the Board and regulators through dashboards and audit-ready evidence packs.

The platform consolidates the regulatory library, policy management, obligations register, control testing, AML/CFT/CPF operations, suspicious-transaction and currency-transaction reporting to NFIU goAML, sanctions and PEP screening, regulatory returns automation, data-protection compliance under NDPA 2023, consumer-complaint handling under the CBN Consumer Protection Regulations, vendor risk, training and attestation, whistleblowing, anti-bribery & corruption, corporate governance attestations, ESG and sustainability reporting, capital-market compliance, and a unified Board and regulator-facing dashboard. The build is cloud-native with full deployment-in-Nigeria options to satisfy CBN data-localisation guidance and the NDPA cross-border transfer rules.

The expected outcome, benchmarked against comparable deployments in peer markets, is a 50% reduction in regulator findings within 18 months of go-live, a 60–70% reduction in manual compliance effort within 12 months, sub-eleven-month payback against business case, and demonstrable, audit-ready evidence of the bank's control environment on any given day. Crucially, the platform is the system of record for the inventory and analytics already produced by the bank's compliance function in the canonical Drafts: every column in the Compliance Universe becomes a structured data attribute; every per-theme CRMP becomes a live risk register; every monitoring row becomes a tracked test with status and effectiveness measure; every entry in the Sanctions Grid becomes a queryable knowledge base linked to the obligation and to the responsible party; every return in the Returns Register becomes a scheduled, auto-prepared, queueable submission to its regulator.

This BRD is written for the engineering team and the implementation partner. It defines functional requirements at the module level, non-functional requirements, integration points with the Nigerian financial-market infrastructure (NIBSS, NIMC, CAC, SWIFT, RTGS, NIP, goAML, eFASS, FinA, SCUML, TaxPro Max), the conceptual data model, role-based access controls, acceptance criteria, deployment topology and a phased delivery roadmap. Appendix C is the traceability matrix mapping every feature in the canonical Drafts to its module and feature ID in this BRD; it is the formal artefact that demonstrates no source capability has been lost.

---

## 3. Business Context, Problem Statement and Objectives

### 3.1 Business Context

Nigerian financial institutions operate at the intersection of (a) intense, multi-agency regulatory supervision that issues new rules at high velocity; (b) a customer base in a cash-heavy, multi-currency, financial-inclusion-driven economy with persistent typologies for money laundering, terrorism financing and proliferation financing; (c) a payment and FX environment dominated by NIBSS rails, mobile money, agent banking and BDC channels with their own regulatory regimes; (d) a digital-banking and fintech expansion that has brought open banking, regulatory sandbox, payment service banks, mobile money operators and switching/processing licensees into the supervised perimeter; and (e) growing extraterritorial regimes — FATCA, the Common Reporting Standard, UN sanctions, OFAC, EU and HMT sanctions, Wolfsberg principles and FATF mutual evaluation expectations — which Nigerian institutions must satisfy in addition to domestic rules.

### 3.2 Problem Statement

**3.2.1 Regulatory volume and velocity.** A typical Nigerian commercial bank tracks 350–600 active obligations. The canonical Drafts already enumerate 352 obligations; the platform is expected to absorb the full inventory of CBN, SEC, NDIC, NFIU, NDPC, NAICOM, PenCom, FIRS, CAC, FRC, FCCPC, NITDA, ICPC, EFCC and other agencies, and to ingest new issuances continuously.

**3.2.2 Fragmented evidence base.** Policies live in SharePoint or shared drives; controls testing in Excel; AML alerts in a separate AML engine; sanctions screening in another tool; returns generation in standalone Excel templates; consumer complaints in the Customer Experience system; sanctions and penalties knowledge in PDFs or hand-curated spreadsheets. Mapping a single CBN obligation to a policy, a control, a tested outcome and the evidence requires manual reconciliation across at least four systems.

**3.2.3 Regulator-facing readiness gap.** When CBN Banking Supervision opens an RBS examination, NDIC conducts a target examination, NFIU issues an information request, NDPC commences a compliance audit under section 47 of the NDPA, or the EFCC issues a freezing order under section 34(3) of the EFCC Act, the bank is given anywhere from 24 hours to ten working days to produce evidence. Current tooling rarely supports this turnaround.

**3.2.4 Penalty exposure is escalating.** Recent CBN administrative penalties have ranged from ₦2 million per branch for FX-related infractions to ₦1–2 billion aggregate fines for KYC, AML and consumer-protection lapses at Tier-1 banks. The Sanctions and Penalties Grid in the canonical Drafts now enumerates 417 specific sanction lines extracted from primary instruments. Personal liability for directors and the CCO is real and increasing.

**3.2.5 Cost of compliance is rising faster than revenue.** Without automation, compliance run-cost scales linearly with the obligations register. The business case for Atheris rests on holding compliance run-cost flat while the obligations register grows.

### 3.3 Strategic Objectives

| ID | Objective |
|---|---|
| G1 | **Single source of truth.** Consolidate the institution's full regulatory universe (statutes, regulations, guidelines, circulars, frameworks, codes, rules, prudential standards, supervisory letters and exposure drafts) into one version-controlled library with automated horizon-scanning feeds from CBN, NDIC, NFIU, SEC, NGX, FMDQ, NDPC, NITDA, FIRS, CAC, FRC, NAICOM, PenCom, EFCC, ICPC, NCC, FCCPC and the Federal Government Gazette. |
| G2 | **End-to-end mapping.** Map every obligation to a policy, a control, a control owner, a testing schedule, an evidence repository and a regulatory return. |
| G3 | **Twelve canonical CRMPs.** Operationalise all twelve Compliance Risk Management Plan categories defined in the Drafts — AML/CFT/CPF, Account Management, Anti-Bribery & Corruption, Cash Management, Consumer Protection, Corporate Governance, Cybersecurity, Data Protection, Financial Reporting, ESG, People & Conduct Risk, Capital Market — with inherent risk, residual risk, controls, additional controls, due dates and responsibilities tracked per row. |
| G4 | **Monitoring plan execution.** Convert the Compliance Monitoring Plan rows into scheduled, owned, status-tracked monitoring activities with control-effectiveness measures and exception reporting. |
| G5 | **Returns automation.** Automate ≥80% of regulatory returns to CBN (eFASS, FinA, RBS), NDIC, NFIU (goAML), SEC (e-portal), NDPC (NDPC reporting portal), FIRS (TaxPro Max) and PenCom (RBS portal); maintain the Returns Register from the Drafts as the canonical schedule. |
| G6 | **Sanctions, PEP, adverse-media screening.** Automate screening against UN, OFAC, EU, HMT, the Nigeria Sanctions Committee consolidated list, NFIU designations, and a curated local PEP list. |
| G7 | **Real-time AML transaction monitoring** calibrated to Nigerian typologies. |
| G8 | **Audit-ready evidence on demand.** Produce evidence packs for CBN, NDIC, NFIU, NDPC, SEC and external auditors within one working day. |
| G9 | **Quantified business outcomes.** Reduce regulatory findings by 50% within 18 months of go-live; reduce manual compliance hours by 60% within 12 months. |
| G10 | **Comply with NDPA 2023, NDPR Implementation Framework, ISO 27001 and the CBN Risk-Based Cybersecurity Framework** for the platform itself, with hosting in Nigeria where required by sector data-localisation rules. |

### 3.4 Success Criteria (Measurable)

| ID | Measure |
|---|---|
| S1 | 100% of CBN circulars issued in the prior 90 days are present in the regulatory library with mapping status (Mapped / Pending / Not Applicable). |
| S2 | ≥95% of obligations are mapped to at least one policy, one control and one control owner. |
| S3 | ≥90% of controls are tested on schedule; overdue controls auto-escalate to the CCO. |
| S4 | Sanctions screening latency ≤500ms at the 95th percentile for real-time payment screening. |
| S5 | Transaction-monitoring false-positive rate ≤30% (industry benchmark in Nigeria is 60–85%). |
| S6 | STR submission to NFIU via goAML XML succeeds on first attempt ≥98% of the time. |
| S7 | Mean time to produce a regulator evidence pack ≤4 hours from request to release. |
| S8 | Platform availability ≥99.9% during business hours; ≥99.5% 24×7. |
| S9 | Zero high or critical findings in the annual CBN cyber-resilience self-assessment of the platform. |
| S10 | User satisfaction (Compliance, Risk, Internal Audit) ≥4.2/5 within six months of go-live. |
| S11 | 100% of the 352 obligations in the canonical Compliance Universe are loaded on Day 1 and tagged with all 17 source attributes (see §11.2). |
| S12 | 100% of the twelve canonical CRMP themes are configured with inherent/residual risk, controls, additional controls, responsibilities and due dates. |
| S13 | 100% of the Returns Register lines are loaded with timeline, frequency, responsible unit and legal basis; ≥98% of in-scope returns are filed on or before due date. |
| S14 | The Sanctions & Penalties Knowledge Base contains the full 417-line grid and is queryable by obligation source, section, offence and responsible party. |

---

## 4. Stakeholders and User Personas

### 4.1 Stakeholder Map

| Stakeholder | Role | Responsibility |
|---|---|---|
| Sponsor | Executive Director, Risk Management / Chief Risk Officer | Business case, funding, board reporting |
| Product Owner | Chief Compliance Officer (CCO) | Defines functional priorities; signs off on regulatory accuracy |
| MLRO | Money Laundering Reporting Officer / Head, Financial Crime Compliance | Owns AML, sanctions, STR/CTR, NFIU liaison |
| DPO | Data Protection Officer | Owns NDPA compliance, DPIA, breach notification |
| Head, Regulatory Compliance | Reports to CCO | Owns regulatory library, returns, CBN/NDIC/SEC liaison |
| Head, Consumer Protection | Reports to CCO | Owns CBN Consumer Protection Regulations, complaints, redress |
| Head, Conduct Risk / Ethics | Reports to CCO or HR | Owns ABAC, conduct, whistleblowing, gifts and entertainment |
| Company Secretary / Head, Governance | Reports to Board | Owns Corporate Governance CRMP, board returns, related-party transactions |
| Head, Sustainability & ESG | Reports to CEO or CFO | Owns ESG, NSBP, Climate Change Act and sustainability disclosures |
| Head, Treasury / Investment Banking Compliance | Reports to CCO | Owns Capital Market CRMP |
| Chief Internal Auditor | Reports to Board Audit Committee | Independent assurance, control testing oversight |
| CISO | Chief Information Security Officer | Owns platform cyber controls, CBN Cybersecurity Framework compliance |
| Head, Internal Control | Operational risk | Owns RCSA, control library |
| Compliance Officer (line of business) | 1st-line compliance in Retail, Corporate, Treasury, Digital, etc. | Executes controls, completes attestations |
| Branch Compliance Officer | 1st-line, branch network | BVN/NIN verification, CDD, branch-level STR drafting, cash management oversight |
| IT & Engineering | Application owner post go-live | Operations, integrations, support |
| Vendor / Implementation partner | Selected systems integrator | Build, configure, deploy |
| External regulator users | CBN, NDIC, NFIU, SEC, NDPC examiners | Read-only regulator portal (optional Phase 2) |
| Internal audit examiners | Reports to BAC | Independent assurance |
| Board Risk Committee | Non-executive directors | Approves risk appetite and major findings |
| Board Audit Committee | Non-executive directors | Receives evidence packs |

### 4.2 Primary User Personas

**Adaeze — Chief Compliance Officer.** Career compliance professional, ACAMS certified, 18 years experience. Reports to MD/CEO and to the Board Risk Committee. Needs a single-pane-of-glass dashboard mirroring the Compliance Risk Profile sheet of the Drafts — total obligations, regulator count, high-risk count, areas of focus, item-type breakdown, and risk-rating distribution — refreshed in near-real time. Wants to answer "are we compliant?" in two clicks. Pain: currently consolidates a monthly board pack from seven spreadsheets and three vendor systems. Primary actions: approve policies; sign off on returns; review AML escalations; respond to regulator letters; sign off Board pack.

**Ibrahim — MLRO / Head, Financial Crime Compliance.** Reports to CCO. Liaison to NFIU, EFCC, ICPC. Holds CAMS and CFE. Needs a live AML alert queue with case management; sanctions hit workbench; STR/CTR drafting and goAML XML export; PEP investigation workbench; periodic risk reviews of high-risk customers. Owns AML/CFT/CPF CRMP. Pain: AML engine alerts are not joined to KYC data; STR drafting in Word; goAML uploads fail silently. Primary actions: triage alerts; approve STRs; review EDD packs; chair Financial Crime Committee.

**Ngozi — Data Protection Officer (DPO).** Reports to CCO (or Legal). Registered with NDPC. Holds CIPP/E or CIPM. Needs records of processing activity (RoPA), DPIA workflow, data-subject rights request tracking (access, rectification, erasure, portability), breach register with 72-hour notification timer to NDPC, vendor data-protection schedule tracker. Owns the Data Protection CRMP. Pain: NDPA is new and rules are still being interpreted; no system maintains RoPA; DPIA is in Word; breach notifications are emails. Primary actions: approve DPIAs; manage data-subject requests; report breaches to NDPC.

**Tunde — Compliance Officer, Retail Banking.** Reports functionally to CCO, administratively to ED Retail. Needs daily checklist of controls, attestation forms, exceptions to log, training to complete. Owns Account Management, Cash Management and Consumer Protection CRMP execution at branch level. Pain: receives compliance requests by email; chases evidence from branches.

**Funmi — Branch Compliance Officer, Ikeja Branch.** Line-of-business compliance at branch. Needs customer risk score on screen at account opening; BVN/NIN verification status; sanctions/PEP hits before account is activated; quick STR drafting interface; cash-handling alerts (counterfeit notes, large cash transactions, ATM cash-out spikes). Pain: switches between Finacle, BVN portal, NIN portal and the AML system to onboard a single high-risk customer.

**Yetunde — Company Secretary.** Reports to Board. Holds ICSAN. Needs Corporate Governance CRMP, board pack returns (annual, half-year, event-driven), fit-and-proper assessment workflow, related-party transaction logs, conflict-of-interest declarations, AGM/EGM compliance, CBN no-objection workflow for board appointments, whistleblowing reports to Board Audit Committee. Pain: Corporate Governance lives across the Charter, BOFIA, CAMA, the Nigerian Code of Corporate Governance, the SEC CG Code and CBN circulars — currently reconciled in Word.

**Tope — Head, Sustainability & ESG.** Reports to CFO. Needs ESG CRMP aligned to NSBP, Climate Change Act 2021, FRC Sustainability Disclosure Standards and NSE Sustainable Disclosure Requirements. Needs to schedule, collect and approve environmental and social impact disclosures.

**Olamide — Head, Treasury Compliance.** Reports to CCO. Needs Capital Market CRMP aligned to ISA 2025, SEC Rules, NGX/FMDQ rulebooks, BOFIA 2020 and CBN treasury circulars. Needs trading-book and banking-book disclosure tracking and CMO licensing renewals.

**Bisi — Internal Auditor.** Reports to Board Audit Committee. CISA, CIA. Needs read-only access to controls, testing evidence, audit trails of approvals, sample selections and evidence packs. Pain: currently re-tests controls because evidence of first-line testing cannot be located.

**Sade — Head, Conduct Risk and Ethics.** Reports to CCO or HR. Needs ABAC CRMP, gifts and entertainment register, conflicts of interest, whistleblowing case management, mis-selling and market-abuse surveillance hooks, conduct attestations and code-of-conduct training tracking.

**Chinedu — Head, Cybersecurity (CISO).** Reports to CRO or CIO. Needs Cybersecurity CRMP aligned to CBN Risk-Based Cybersecurity Framework, NDPR, NITDA Code of Practice, NDPA 2023 security obligations, Cybercrime Act 2015 (as amended) and ISO 27001 audits. Drives the platform's own NFRs.

**External Examiners (Regulator).** CBN/NDIC/NFIU/SEC/NDPC examiners during on-site or off-site reviews. Need read-only views of the regulatory library, the obligations register, the monitoring plan status, evidence on selected obligations, returns history and the Sanctions Knowledge Base — without seeing customer PII.

---

## 5. Scope

### 5.1 In Scope

The platform shall deliver, end-to-end, the capabilities defined in this BRD and in the canonical Drafts. In-scope items include:

**5.1.1 Regulatory library and horizon scanning** for the full set of Nigerian regulators identified in the canonical Drafts and the existing BRD: CBN (Central Bank of Nigeria, 275 obligations), SEC (Securities and Exchange Commission, 3+ obligations and the new ISA 2025), NDIC (Nigeria Deposit Insurance Corporation, 4+ obligations and the NDIC Act 2023), NFIU (Nigerian Financial Intelligence Unit, 2 obligations and the NFIU Act 2018), NDPC (Nigeria Data Protection Commission, 2 obligations plus NDPA 2023, NDPR 2019 and the GAID 2025), NAICOM, PenCom (4 obligations including Pension Reform Act 2014), FIRS (9 obligations including FATCA/CRS), CAC (2 obligations including CAMA 2020), FRC (3 obligations including the Code of Corporate Governance 2018), FCCPC, NITDA, EFCC (3 obligations), ICPC (1 obligation), NIMC (1 obligation), NSITF, NYSC, NCTC, Fiscal Responsibility Commission, NEXIM, NIPC, NGX, FMDQ, Federal Mortgage Bank of Nigeria, Industrial Training Fund, Chartered Institute of Bankers of Nigeria, National Council on Climate Change, Trademarks Registry (FMITI), Nigeria Immigration Service, Lagos State Government, the Federal Government of Nigeria, FATF, the Wolfsberg Group, and US/UK regulators where extraterritorial.

**5.1.2 Compliance Universe management.** A structured, queryable, version-controlled master register reproducing every attribute in the Drafts Compliance Universe (the 17 standard fields defined in §11.2 and 4.1 of the Definitions sheet) for at least the 352 obligations already inventoried.

**5.1.3 Compliance Risk Profile analytics.** Live reproduction and extension of the Drafts Compliance Risk Profile sheet — total obligations, regulator count, high-risk item count, areas-of-focus count, breakdowns by nature (Core / Topical / Secondary / Others), by item type (Act, Circular, Code, Directive, Exposure Draft, Framework, Guidance, Guidelines, Law, Manual, Regulations, Rules, Policy), by regulator, by risk rating and by area of focus. Visualised in dashboards and exportable as Board pack inputs.

**5.1.4 Twelve canonical Compliance Risk Management Plans (CRMPs).** Operational, versioned, multi-row risk registers for each of the twelve themes defined in the Drafts: AML/CFT/CPF; Account Management; Anti-Bribery & Corruption; Cash Management; Consumer Protection; Corporate Governance; Cybersecurity; Data Protection; Financial Reporting; ESG; People & Conduct Risk; Capital Market. Each row carries all CRMP columns from the source — Theme, S/N, Acts, Section, Title, Description, plain-language obligation, Risk Description, Inherent Likelihood, Inherent Impact, Responsibility, Control, Residual Likelihood, Residual Impact, Additional Control, Due Date and (final) Responsibility.

**5.1.5 Compliance Monitoring Plan execution.** Operationalisation of the Drafts Compliance Monitoring Plan with every column carried through: Theme, ID, Regulatory Requirement, Compliance Area, Risk Level, Compliance Control, Monitoring Activity, Frequency, Responsible Officer, Due Date, Status and Control Effectiveness Measure. Status states (e.g., Completed, In Progress, Overdue) tracked with status history.

**5.1.6 Returns and Remittance Register.** Reproduction and operationalisation of the Drafts Returns Register: every return loaded with Acts, Type of Return / Obligation, Legal Basis (Section), Description, Timeline/Frequency, Responsible Unit. Automated scheduling, drafting, submission, acknowledgement and evidence.

**5.1.7 Sanctions and Penalties Knowledge Base.** Reproduction and operationalisation of the Drafts Sanctions Grid: every sanction loaded with Compliance Obligation Source, Section, Offence / Obligation, Sanction or Penalty, Implication for Commercial Banks and Responsible Party. Searchable, linked to the obligation, surfaced in evidence packs and in the policy/control screen.

**5.1.8 Policy and procedure management** with version control, attestations and acknowledgement tracking; aligned to all CRMP themes.

**5.1.9 Obligations register and control mapping** with parent–child traceability from statute → regulation → guideline → circular → obligation → control → policy → return.

**5.1.10 Risk and Control Self-Assessment (RCSA) and Business Risk Assessment (BRA)** for ML/TF/PF and for each CRMP theme.

**5.1.11 Control testing — manual, automated, sample-based, continuous monitoring** via KCI/KRI.

**5.1.12 AML/CFT/CPF**: CDD, EDD, ongoing due diligence, customer risk scoring, periodic review, ML/TF/PF business risk assessment.

**5.1.13 Sanctions, PEP and adverse-media screening** at onboarding and continuously.

**5.1.14 Transaction monitoring** with rule engine, scenarios calibrated to Nigerian typologies.

**5.1.15 Suspicious Transaction Report (STR) drafting and submission to NFIU via goAML XML.**

**5.1.16 Currency Transaction Report (CTR)** automation against N5m (individual) / N10m (corporate) thresholds.

**5.1.17 Currency Declaration Report (CDR)** tracking for cross-border movement of currency.

**5.1.18 Regulatory returns generation**: CBN eFASS, FinA, RBS, NDIC, NDPC, FIRS TaxPro Max, SEC e-portal, PenCom RBS, NFIU goAML.

**5.1.19 Consumer protection and complaints management** aligned to the Consumer Protection CRMP — CBN Consumer Protection Regulations, the Revised Consumer Protection Regulations 2.0 Exposure Draft, the Consumer Complaints Management System (CCMS), FCCPA 2018 — covering Fair Treatment, Business Ethics, Sales Promotion & Advertising, Unfair Contract Terms, Lending Practices, Debt Recovery, Complaints Handling and Industry Dispute Resolution.

**5.1.20 Whistleblowing** aligned with CBN Whistleblowing Guidelines for Banks and OFIs and with internal Reporting Unethical Conduct policy.

**5.1.21 Vendor / third-party risk management** aligned to CBN Outsourcing Standards, NDPA data-processor obligations and the Shared Services Guidelines.

**5.1.22 Training, attestation, certification tracking** (KYC, AML, conduct, ethics, NDPA, ABAC, cybersecurity, ESG).

**5.1.23 Data protection workflow**: RoPA, DPIA, data subject rights, breach register and 72-hour NDPC notification, aligned to the Data Protection CRMP and NDPA 2023.

**5.1.24 Incident and breach management** (operational, cyber, conduct, financial-crime, data).

**5.1.25 Compliance calendar** tied to obligations and to the Returns Register.

**5.1.26 FATCA and Common Reporting Standard (CRS)** classification, reporting and IDES submission readiness.

**5.1.27 Tax compliance**: VAT, WHT, EMTL, CIT obligations, Stamp Duty, Tertiary Education Tax.

**5.1.28 Conduct risk and surveillance hooks** — mis-selling, market abuse, insider trading surveillance hook ingestion and case management; integrates with the People & Conduct Risk CRMP.

**5.1.29 Anti-Bribery & Corruption (ABAC) compliance** — EFCC Act, ICPC Act, FCPA-style controls, Nigerian Criminal Code, Wolfsberg ABAC Principles, gifts & entertainment register, facilitation payments register.

**5.1.30 Corporate Governance compliance** — Nigerian Code of Corporate Governance 2018, SEC Corporate Governance Guidelines, CBN Corporate Governance Guidelines for Commercial Banks/Merchant/Non-Interest/PSBs, CAMA 2020, BOFIA 2020, Fiscal Responsibility Act 2007, Whistleblowing Guidelines, Approved Persons Regime, board fit-and-proper, related-party transactions.

**5.1.31 ESG and Sustainable Banking** — NSBP, Climate Change Act 2021, NSE Sustainable Disclosure Requirements, NCCC reporting and FRC Sustainability Disclosure Standards.

**5.1.32 Capital Market compliance** — ISA 2025, SEC Rules 2013 (as updated), NGX Rulebook, FMDQ Rules, Disclosure obligations, market-abuse, insider trading, related-party transactions for listed entities.

**5.1.33 Cybersecurity compliance** — Cybercrime Act 2015 (Amended), CBN Risk-Based Cybersecurity Framework 2018/2022, NITDA frameworks, ISO 27001, ISO 22301, NIST CSF reference. Drives both the Cybersecurity CRMP and the platform's NFRs.

**5.1.34 Dashboards, board-pack generation and regulator-facing read-only portal (Phase 2).**

**5.1.35 Audit trail and tamper-evident evidence store.**

**5.1.36 Open Banking compliance** — CBN Operational Guidelines for Open Banking 2023.

**5.1.37 Account Management compliance** — Dormant accounts, abandoned property, e-Dividend, dishonoured cheques, vulnerable customers, NDIC differential premium, charges per the Guide to Bank Charges, interest rates on savings.

**5.1.38 Cash Management compliance** — Clean Note Policy, counterfeit notes, ATM cash management, large-cash threshold reporting, currency operations, currency disposal.

### 5.2 Out of Scope

- Core banking ledger functions and posting.
- Real-time fraud scoring of payments (assumed delivered by a separate fraud engine; Atheris consumes its alerts).
- Treasury middle-office market-risk computation (Atheris consumes their KRIs).
- Granular FX dealer pricing or e-FX trading.
- Underlying tax computation engine for corporate income tax (FIRS TaxPro Max integration is in-scope; the computation engine is the bank's existing tax solution).
- Customer-relationship management (CRM) functions.
- Loan origination and credit underwriting (Atheris consumes credit exposures for KRIs).
- The bank's general-ledger, payroll or HR records of joiners/movers/leavers (Atheris consumes HRIS events).
- Health, safety and environment monitoring beyond what falls under ESG/NSBP disclosure.
- The downstream litigation case-management system (Atheris notifies it of breaches with regulatory implications).

### 5.3 Assumptions

- The bank has at least one core banking platform (Finacle, T24, Flexcube, BaNCS or Temenos) with documented APIs.
- NIBSS BVN, NIMC NIN, CAC, FIRS TIN and NIS connectivity is available or can be procured.
- NFIU goAML credentials and the bank's reporting officer designation are available.
- The bank's existing AML engine (Actimize/Oracle FCCM/SAS) can emit alerts to Atheris.
- The bank's existing sanctions vendor (Dow Jones / Refinitiv / LexisNexis / Accuity) exposes a refresh API.
- The bank has agreed an in-Nigeria hosting model with a CBN-approved data centre or hyperscaler region.
- The bank has a published Acceptable Use Policy and identity provider (Active Directory / Azure AD / Okta) for SSO.

---

## 6. Business Process Overview

### 6.1 The Five-Phase Compliance Process (Per the Canonical Drafts User Guide)

The compliance risk management process consists of five interlocking phases that this platform shall operationalise end-to-end:

**Phase 1 — Develop the Regulatory Universe and the Compliance Risk Profile.** The regulatory universe is the list of applicable regulatory items before they have been risk-assessed and prioritised. The Compliance Risk Profile is the universe once it has been risk-assessed and prioritised. The platform shall ingest, classify, assess and prioritise every obligation; produce the Risk Profile analytics; and refresh both continuously as the regulator landscape moves.

**Phase 2 — Develop Compliance Risk Management Plans (CRMPs).** Each CRMP is the management plan that translates a class of regulatory obligations into clear, plain-language requirements, identifies the risk of non-compliance, scores inherent risk (likelihood × impact), specifies controls and the control owner, scores residual risk, identifies additional controls, and assigns a due date and final responsibility. CRMPs are owned by management with facilitation from the compliance function. The platform shall maintain the twelve canonical CRMPs as live, multi-row registers and shall enforce a CRMP review cadence.

**Phase 3 — Develop and Operate Compliance Monitoring Plans.** A Compliance Monitoring Plan is the schedule and methodology by which the bank tests that controls operate as designed. Each monitoring row enumerates the Regulatory Requirement, the Compliance Area, the Risk Level, the Compliance Control, the Monitoring Activity, Frequency, Responsible Officer, Due Date, Status and Control Effectiveness Measure. The platform shall execute, schedule, track and evidence every monitoring activity, and shall escalate overdue or failed activities.

**Phase 4 — Reporting and Returns.** The bank discharges its statutory and regulatory reporting through returns (periodic) and remittances (event-driven). The Returns Register from the Drafts is loaded as the canonical schedule; the platform shall draft, queue, route for approval, submit, capture acknowledgement and evidence each return.

**Phase 5 — Continuous Improvement, Sanctions Tracking and Board Reporting.** The platform shall maintain the Sanctions & Penalties Knowledge Base; shall track every breach, finding and remediation; shall feed back lessons learned into Phases 1–4; and shall generate the monthly/quarterly Compliance Report to the Board Risk Committee, the Board Audit Committee and the Board.

### 6.2 Current State (As-Is)

| Phase | Current State Pain Points |
|---|---|
| 1 | Universe maintained as an Excel workbook; horizon scanning is manual; new circulars logged days or weeks after issue |
| 2 | Per-theme CRMPs in separate Word/Excel files; inherent vs. residual risk not consistently scored; controls not joined to obligations |
| 3 | Monitoring plan in Excel; status updated weekly by email; evidence in shared folders |
| 4 | Returns prepared from disparate sources at month-end; late submissions trigger CBN penalty letters |
| 5 | Board pack assembled manually in PowerPoint; sanctions knowledge not centralised; lessons-learned loop weak |

### 6.3 Future State (To-Be)

| Phase | Future State Outcome |
|---|---|
| 1 | Universe is a queryable, versioned system of record with automated horizon scanning, change-management workflow and impact assessment |
| 2 | CRMPs are live, multi-user, signed-off risk registers with inherent/residual scoring, control mapping and additional-control tracking |
| 3 | Monitoring plan is a scheduler + workbench with status-tracked tests, control-effectiveness measures and exception escalation |
| 4 | Returns are auto-drafted, auto-routed, auto-submitted (where regulator APIs allow), with acknowledgements logged and evidence retained |
| 5 | Sanctions KB is searchable and linked to every obligation; Board pack is one-click; breach register feeds back into universe and CRMP |

### 6.4 Headline Workflow Narratives

**WF-01 New CBN Circular Ingestion.** Horizon scanner detects a new CBN circular → automatically creates a draft Compliance Universe entry with PDF, issuer, type, date of issue, date of commencement, area of focus → routes to Regulatory Compliance for triage and risk rating → routes to LOB compliance for impact assessment → triggers CRMP update (which theme), policy update (which policies), control update, training update and returns update → sign-off by CCO → closed with evidence.

**WF-02 Onboarding a High-Risk Corporate Customer.** Customer applies → Tier 3 KYC required → BVN/NIN verified via NIBSS/NIMC → CAC search for legal-entity profile → PSC register populated → sanctions/PEP/adverse-media screening → if PEP or high-risk, EDD pack assembled → MLRO senior approval → if approved, customer activated; otherwise rejected → all evidence stored under Audit Trail.

**WF-03 STR Submission to NFIU.** AML monitoring rule fires alert → MLRO triages → case opened → evidence gathered → STR drafted in plain language → reviewed by MLRO → goAML XML generated and submitted → acknowledgement captured → CCO and Board Audit Committee notified per CBN AML/CFT/CPF Regulation 2022.

**WF-04 NDPC Breach Notification (72-hour timer).** Data incident reported (cyber alert, customer complaint, internal discovery) → DPO assesses → if reportable, 72-hour countdown starts → breach record drafted with Data Subject impact, categories, remediation → NDPC notification submitted → data subjects notified if high risk → post-incident review fed back to RoPA and DPIA.

**WF-05 Monthly CBN Consumer Complaints Return.** Throughout the month complaints are logged with category, channel, resolution time → at month-end the platform aggregates per CBN Consumer Protection Regulations → return drafted, reviewed by Head Consumer Protection, signed off by CCO, submitted to CBN.

**WF-06 Quarterly Returns Cycle.** Compliance Calendar surfaces returns due in next 30 days → data pulled from source systems → drafts auto-generated → routed for approval → submitted → acknowledgements stored.

**WF-07 EFCC Freezing Order.** Branch receives EFCC freezing order under section 34(3) of the EFCC Act → branch enters into the platform → automatically blocks the account in core banking via API → routes to MLRO, Branch Manager, Legal → response composed and acknowledged → evidence retained per the Sanctions and Penalties grid responsibility allocation.

**WF-08 Annual Board Compliance Pack.** Compliance team configures the report period → platform auto-generates the Compliance Risk Profile analytics (mirroring the Drafts), the per-theme CRMP residual risk heat map, the Monitoring Plan status, the Returns Register status, the Sanctions Knowledge Base summary of recent enforcement, the Top 10 risks, breaches and remediation status → CCO signs off → distributed to Board.

**WF-09 NDPA Data Subject Rights Request.** Customer raises an access / rectification / erasure / portability / objection / restriction request → DSR ticket auto-created → identity verified → request triaged by DPO → fulfilled within 30 days (or extended once with notice) → evidence pack retained.

**WF-10 Quarterly Sanctions List Refresh.** Vendor publishes consolidated list → ingested → all customers and counterparties re-screened in batch → hits routed to MLRO workbench → confirmed hits escalated and reported per CBN Sanctions Regulation 2022.

---

## 7. Functional Requirements — Modules

Atheris is organised into thirty modules. Modules M01–M23 derive from BRD v1.0 and are fully retained. Modules M24–M30 are new and operationalise the canonical Drafts CRMP themes that the prior BRD covered only partially. Every feature, sub-feature, workflow and capability described in the Drafts is allocated to a module and is enumerated in the traceability matrix in Appendix C.

| Module | Title | Primary Drafts Source |
|---|---|---|
| M01 | Regulatory Library & Horizon Scanning | Compliance Universe (sheet); Definitions; Regulators; Regulatory Item Types; Status |
| M02 | Policy & Procedure Management | All CRMP sheets (control / additional control columns) |
| M03 | Obligations Register & Control Mapping | Compliance Universe; per-theme CRMP sheets |
| M04 | RCSA / Business Risk Assessment | CRMP (Inherent Likelihood, Inherent Impact, Residual Likelihood, Residual Impact) |
| M05 | Controls Testing & Continuous Monitoring | Compliance Monitoring Plan |
| M06 | KYC & CDD/EDD/ODD | AMLCFT sheet; Account Mgt sheet |
| M07 | Sanctions, PEP and Adverse-Media Screening | AMLCFT sheet (Sanctions / Targeted Financial Sanctions rows) |
| M08 | AML Transaction Monitoring | AMLCFT sheet (Suspicious Transaction reporting, monitoring) |
| M09 | STR / CTR / CDR / SAR — NFIU goAML Reporting | AMLCFT sheet; Returns Register (NFIU lines); Sanctions Grid |
| M10 | Regulatory Returns Automation | Returns and Remittance Register |
| M11 | Consumer Protection & Complaints Management | Consumer Protection sheet; CRMP CONSUMER PROTECTION rows |
| M12 | Data Protection (NDPA 2023) | Data Protection sheet; NDPA / NDPR / GAID rows |
| M13 | Whistleblowing | Corporate Governance sheet (Whistleblowing Guidelines) |
| M14 | Vendor / Third-Party Risk Management | Shared Services Arrangements; Outsourcing rows |
| M15 | Training, Attestation & Certification | All CRMPs (training control entries) |
| M16 | Incident, Breach & Operational-Risk Management | Cybersecurity sheet; Data Protection sheet |
| M17 | Compliance Calendar | Returns Register; CRMP Due Date columns |
| M18 | Dashboards, Board Pack & Regulator Portal | Compliance Risk Profile sheet; Dashboard sheet |
| M19 | Audit Trail & Evidence Vault | All sheets — every approval, change, status update |
| M20 | FATCA & CRS | AMLCFT sheet (FATCA/CRS rows) |
| M21 | Tax Compliance Cockpit | Financial Reporting sheet; FIRS-issued instruments |
| M22 | Conduct Surveillance Hooks | Conduct Risk sheet |
| M23 | Open Banking Compliance | Compliance Universe rows on Open Banking Framework & Operational Guidelines |
| M24 | Anti-Bribery & Corruption (ABAC) | ABAC sheet |
| M25 | Corporate Governance | Corporate Governance sheet |
| M26 | ESG & Sustainable Banking | ESG sheet |
| M27 | Capital Market Compliance | Capital Market sheet |
| M28 | Sanctions & Penalties Knowledge Base | Sanctions and Penalties grid |
| M29 | Account Management Compliance | Account Management (Actmgt) sheet |
| M30 | Cash Management Compliance | Cash Management (Cash Mgt) sheet |

The detailed feature specifications follow in Section 8. Section 7.X below summarises each module's intent so that the build team can map them quickly to the Drafts.

### 7.1 Module-by-Module Summary Index

For each module, a one-paragraph summary of the intent. Detailed feature specifications are in Section 8.

- **M01 Regulatory Library & Horizon Scanning** — System of record for the Compliance Universe. Operationalises every column of the Drafts Compliance Universe sheet (17 fields) for at least the 352 obligations already inventoried, plus a horizon-scanner that ingests new instruments from 43+ regulator and industry-body sources.
- **M02 Policy & Procedure Management** — Lifecycle management for every internal policy, procedure, standard, work instruction and code of conduct. Each CRMP "Control" entry surfaces here as a policy reference.
- **M03 Obligations Register & Control Mapping** — Breaks each regulatory instrument into discrete obligations; maps every obligation to control, policy, owner, return and CRMP row.
- **M04 RCSA / BRA** — Enterprise-wide RCSA and ML/TF/PF BRA. Drives the inherent/residual scoring captured per CRMP row.
- **M05 Controls Testing & Continuous Monitoring** — Operationalises the Compliance Monitoring Plan. Library of controls; testing schedules; sample selection; pass/fail; remediation; KCI/KRI; Control Effectiveness Measures.
- **M06 KYC & CDD/EDD/ODD** — Customer lifecycle aligned to the AML/CFT/CPF CRMP and to the Three-Tiered KYC, BVN, NIN and UBO obligations enumerated in the AMLCFT sheet.
- **M07 Sanctions, PEP and Adverse-Media Screening** — Real-time and batch screening; UN/OFAC/EU/HMT/NSC lists; curated local PEP list; goAML and NFIU-designation feeds.
- **M08 AML Transaction Monitoring** — Rule-based and behavioural monitoring with rules calibrated to Nigerian typologies.
- **M09 STR / CTR / CDR / SAR — NFIU goAML Reporting** — End-to-end STR/CTR drafting and submission via goAML XML.
- **M10 Regulatory Returns Automation** — Operationalises the Returns and Remittance Register; auto-drafts, routes, submits, captures acknowledgement for every return.
- **M11 Consumer Protection & Complaints Management** — Operationalises the Consumer Protection CRMP — Fair Treatment, Business Ethics, Sales Promotion & Advertising, Unfair Contract Terms, Lending Practices, Debt Recovery, Complaints — and the Consumer Complaints Management System.
- **M12 Data Protection (NDPA 2023)** — Operationalises the Data Protection CRMP — NDPR 2019, NDPA 2023, GAID 2025 — including RoPA, DPIA, DSRs, breach notification.
- **M13 Whistleblowing** — Operationalises the CBN Whistleblowing Guidelines and the Corporate Governance whistleblowing controls.
- **M14 Vendor / Third-Party Risk Management** — Operationalises Shared Services and Outsourcing controls.
- **M15 Training, Attestation & Certification** — Every CRMP training control becomes a tracked training requirement with completion evidence.
- **M16 Incident, Breach & Operational-Risk Management** — Operationalises incident management across cyber, data, conduct, financial-crime and operational categories.
- **M17 Compliance Calendar** — Single calendar surfacing every due date — CRMP, Returns, Reviews, Trainings, Attestations.
- **M18 Dashboards, Board Pack & Regulator Portal** — Replicates and extends the Compliance Risk Profile analytics; produces the monthly Board pack; provides an optional regulator-facing read-only portal.
- **M19 Audit Trail & Evidence Vault** — Every action, approval, edit, sign-off captured with WORM-class evidence; underpins regulator readiness.
- **M20 FATCA & CRS** — Customer classification (US Person, controlling persons), reporting, IDES submission.
- **M21 Tax Compliance Cockpit** — Operationalises the Financial Reporting CRMP for tax obligations (VAT, WHT, EMTL, CIT, Stamp Duty, TET).
- **M22 Conduct Surveillance Hooks** — Operationalises the People & Conduct Risk CRMP; mis-selling, market abuse, insider trading; gifts & entertainment.
- **M23 Open Banking Compliance** — Operationalises CBN Open Banking Framework 2021 and Operational Guidelines 2023; consent register, API access logs.
- **M24 Anti-Bribery & Corruption (ABAC)** — Operationalises the ABAC CRMP — EFCC Act 2004, ICPC Act 2000, Nigerian Criminal Code 1990 — gifts & entertainment, facilitation payments, third-party due diligence, charitable contributions.
- **M25 Corporate Governance** — Operationalises the Corporate Governance CRMP — Board Structure, Board Roles, Officers of the Board, Independent Professional Advice, Board Committees, AGM/EGM, fit-and-proper, related-party transactions, conflicts of interest, BOFIA, CAMA, the Code 2018, SEC CG Guidelines, the Corporate Governance Guidelines for Commercial Banks 2023.
- **M26 ESG & Sustainable Banking** — Operationalises the ESG CRMP — NSBP, Climate Change Act 2021, NSE Sustainable Disclosure Requirements, FRC Sustainability Disclosure Standards — emissions tracking, environmental & social risk assessment of credit transactions, sustainability disclosure preparation.
- **M27 Capital Market Compliance** — Operationalises the Capital Market CRMP — ISA 2025, SEC Rules 2013 (as updated), NGX Rulebook, FMDQ Rulebooks — for treasury and investment-banking activities.
- **M28 Sanctions & Penalties Knowledge Base** — Operationalises the Sanctions and Penalties grid (417 lines): a queryable knowledge base of every sanction, its source, section, offence, penalty, implication and responsible party.
- **M29 Account Management Compliance** — Operationalises the Account Management CRMP — dormant accounts, vulnerable customers, e-Dividend, dishonoured cheques, abandoned property, NDIC differential premium, charges per the Guide to Bank Charges, savings deposit interest rates, ATM transaction limits.
- **M30 Cash Management Compliance** — Operationalises the Cash Management CRMP — Clean Note Policy, counterfeit notes, cash disbursement, ATM cash management, currency operations.

---

## 8. Detailed Feature Specifications

Each module specifies: (i) Description and intent; (ii) Detailed functional rules (`FR<module>.<n>`); (iii) Inputs / outputs / key data fields; (iv) User roles; (v) Workflow / state transitions; (vi) Dependencies; (vii) Regulatory obligation satisfied; (viii) Acceptance criteria (`AC<module>.<n>`).

### 8.1 M01 — Regulatory Library & Horizon Scanning

**Description and business rationale.** Single, version-controlled inventory of every statute, regulation, guideline, circular, framework, code, rule, prudential standard, exposure draft, manual, law, policy and supervisory letter applicable to the institution. Reproduces and extends the 352-line Drafts Compliance Universe so that every column becomes a queryable, evidence-bearing system-of-record attribute. Replaces the legacy spreadsheet with a workflow-enabled application that ingests new instruments automatically, drives Change Management, and feeds every downstream module.

**Functional rules.**

- `FR1.1` Each regulatory instrument is stored with: unique ID, hierarchical Type (Act / Circular / Code / Directive / Exposure Draft / Framework / Guidance / Guidelines / Law / Manual / Regulations / Rules / Policy — the 13 types enumerated in the Drafts Regulatory Item Types sheet), Title (= "Compliance Obligation Source" in the Drafts), Issuing Regulator (drawn from the 43 bodies enumerated in the Drafts Regulators sheet), Instrument Number, Date of Issue, Date of Commencement, Repeal Date if any, Jurisdiction (Federal / State / International / Industry), Applicable Institution Type (DMB, MFB, PSB, MMO, BDC, CMO, PFA, PFC, Insurance, NBFI, Holding Co, etc.), Theme (Financial Crime / Business Conduct / Client Conduct / Prudential / Operational / Data Protection / Tax / Corporate Governance / ESG / Capital Market / People & Conduct), Area of Focus (drawn from the 29 areas enumerated in the Drafts Area of Focus sheet), Summary / Objectives (= "Objectives/Description"), Full-text PDF reference, Link of Document (URL), Parent Instrument and Child Instruments.

- `FR1.2` Each instrument carries the 17 standard Drafts attributes (see §11.2): Compliance Obligation Source, Objectives/Description, Date of Issue, Date of Commencement, Regulatory/Enforcement Body, Type of Regulatory Item, Nature of Compliance Item (Core / Topical or Pertinent / Secondary / Others), Area of Focus, Sanctions (incl. specific section), Status (Current / Outdated / Exposure Draft), Comment on Status, Link of Document, Risk Rating (High / Medium / Low) within commercial-bank context, Risk Rating Explanation, Commercial Bank Relevance, Commercial Bank Compliance Context, Applicability to Commercial Banks (Yes / No / Partially).

- `FR1.3` Risk assessment per instrument: configurable impact (1–5) and likelihood (1–5) producing residual rating (H / M / L) per the Risk Rating sheet of the Drafts (which today reports High 215, Medium 117, Low 14). Editable with rationale (the "Risk Rating Explanation" field).

- `FR1.4` Each instrument may be assigned a Compliance Owner (BCO), a 1st-line owner, a 2nd-line reviewer, an internal-audit assurance reviewer and a board-level oversight committee, with RACI.

- `FR1.5` Horizon scanner polls — on a configurable schedule but at minimum daily — the publication endpoints of CBN (cbn.gov.ng/Documents, /Out/Publications, /Out/Circulars), NDIC, NFIU, SEC, NGX, FMDQ, NDPC, NITDA, FIRS (Tax Circulars), CAC, FRC, NAICOM, PenCom, EFCC, ICPC, NCC, FCCPC, NIMC, Federal Government Gazette, FATF, GIABA, Wolfsberg, Lagos State Government (and the other state governments where relevant). New documents trigger a Change Management workflow.

- `FR1.6` Change Management workflow: New instrument → Auto-categorise (best-effort type, theme, area of focus) → Triage (Regulatory Compliance Lead) → Impact Assessment (LOB compliance officers) → Implementation Plan (Policy update, Control change, Training, System change, Returns change) → Sign-off (CCO) → Closure with evidence and date of effective change.

- `FR1.7` Full-text search across title, summary, full-text PDFs (OCR if scanned), keywords, the obligation register, the CRMP rows and the Sanctions KB. Boolean operators, faceted search (by regulator, by type, by area of focus, by nature, by risk rating, by status).

- `FR1.8` Bulk import via XLSX template matching the Drafts Compliance Universe schema (18 columns), with field-level validation, dry-run mode and a downloadable error report.

- `FR1.9` Bulk export back to XLSX in the Drafts schema for offline review.

- `FR1.10` Mandatory immutable audit trail on every edit; every change shows who, when, before/after and reason.

- `FR1.11` Reference taxonomies are managed as configurable look-ups: Regulators list (initial seed = 43 bodies from the Drafts), Item Types (initial seed = 13 from the Drafts), Statuses (Current / Outdated / Exposure Draft per the Drafts), Areas of Focus (initial seed = 29 from the Drafts), Nature of Compliance Item (Core / Topical or Pertinent / Secondary / Others per the Drafts), Risk Ratings (High / Medium / Low per the Drafts).

- `FR1.12` Each instrument may be tagged with the CRMP themes it belongs to (one or many of the twelve themes in §7.1) so that updates cascade to those CRMPs.

- `FR1.13` Each instrument carries a Sanctions sub-entity that lists every sanction line associated with that instrument; this is the join to M28 (Sanctions & Penalties KB).

- `FR1.14` Each instrument carries one or more Returns sub-entities listing the returns triggered by it; this is the join to M10 (Returns Automation).

**Inputs.** Regulator publication feeds; uploaded PDFs; manual entries; XLSX bulk import.

**Outputs.** Structured obligation records; Change Management cases; full-text search index; analytics feeds to M18; impact-assessment routing to LOB compliance.

**Key data fields.** See §11.2 (17 standard attributes) and `FR1.1`–`FR1.2`.

**User roles.** Regulatory Compliance Lead (Owner); LOB Compliance Officers (Impact Assessors); CCO (Approver); Internal Audit (Reviewer); Read-only for all other staff.

**Workflow states.** Detected → Triage → Impact Assessment → Implementation Plan → Sign-off → Active → Superseded / Repealed / Outdated.

**Dependencies.** Underpins M02, M03, M04, M05, M10, M17, M18, M28 and every CRMP module (M24–M30 and M11, M12, M22, M23).

**Regulatory obligation.** This module is the operational fulfilment of the Compliance function's mandate under section 9 of the CBN AML/CFT/CPF Regulations 2022, the Compliance Function obligations under the Nigerian Code of Corporate Governance 2018, and the FATF Recommendation 18 (Internal Controls).

**Acceptance criteria.**

- `AC1.1` All 352 obligations in the canonical Drafts Compliance Universe load on Day 1 with all 17 attributes populated.
- `AC1.2` A new CBN circular posted to cbn.gov.ng appears in the platform within 24 hours.
- `AC1.3` Search returns relevant results in ≤2 seconds across a library of 5,000 documents.
- `AC1.4` Bulk import of 1,000 obligations in the Drafts schema completes in ≤5 minutes with a downloadable error report.
- `AC1.5` Every edit appears in the audit trail with before/after and is non-erasable.
- `AC1.6` Reference taxonomies (Regulators, Item Types, Statuses, Areas, Nature, Risk Ratings) are administrable without code change.

---

### 8.2 M02 — Policy & Procedure Management

**Description.** Lifecycle management for all internal policies, procedures, standards, work instructions and code-of-conduct documents. Each policy maps upstream to one or more regulatory obligations (M03) and downstream to one or more controls (M05).

**Functional rules.**

- `FR2.1` Policy lifecycle: Draft → Review → Legal/Compliance approval → Board / ExCo approval (where required) → Publish → Acknowledge → Review (annual or triggered).
- `FR2.2` Each policy version is immutable once published; new versions create new immutable records.
- `FR2.3` Mandatory annual review cycle with auto-escalation 60 / 30 / 7 days before expiry.
- `FR2.4` User acknowledgement tracking with completion rate by department, by role, by LOB.
- `FR2.5` Mapping: Policy ↔ Obligation (N:M), Policy ↔ Control (N:M), Policy ↔ Training Module (N:M), Policy ↔ CRMP row (N:M).
- `FR2.6` Watermarked PDF export of any policy version.
- `FR2.7` Each policy is tagged with the CRMP themes it serves (one or many of the twelve).
- `FR2.8` Mandatory policy taxonomy seeded to include: AML/CFT/CPF Policy, Sanctions Policy, KYC Policy, EDD Policy, Whistleblowing Policy, Code of Conduct, Conflict of Interest Policy, Gifts and Entertainment Policy, Anti-Bribery and Corruption Policy, Outsourcing Policy, Shared Services Policy, Data Protection Policy (NDPA-aligned), Privacy Notice, Cookie Policy, Information Security Policy, Acceptable Use Policy, Business Continuity Policy, Disaster Recovery Policy, Cyber Resilience Policy, Consumer Protection Policy, Complaints Handling Policy, Conduct Risk Policy, Tax Strategy Policy, ESG Policy, Climate Risk Policy, Sustainable Lending Policy, Account Management Policy, Cash Management Policy, Dormant Account Policy, Treasury Policy, Capital Market Activities Policy, Open Banking Policy, Records Retention Policy.
- `FR2.9` Policy-to-CRMP linkage is enforced: every CRMP "Control" or "Additional Control" entry must reference at least one policy or be raised as a gap.

**User roles.** Policy Owner (drafter); Policy Approver (CCO / DPO / CISO / CFO / Company Secretary depending on policy); Board / ExCo (Approver for policies that require it); all staff (Acknowledgers).

**Workflow states.** Draft → In Review → Approved → Published → Acknowledged → In Force → Under Review → Superseded.

**Dependencies.** M01 (Obligations), M03 (Controls mapping), M05 (Control testing), M15 (Training), M19 (Audit Trail).

**Regulatory obligation.** Required policy framework prescribed by CBN AML/CFT/CPF Regulation 2022 (Comprehensive Compliance Programme), CBN Consumer Protection Regulations (§4 minimum standards), NDPA 2023 (data-protection policies), CBN Whistleblowing Guidelines, Nigerian Code of Corporate Governance 2018.

**Acceptance criteria.**

- `AC2.1` Annual review reminders fire reliably; overdue policies surface on the CCO dashboard.
- `AC2.2` Acknowledgement completion ≥ 95% within 30 days of publication for in-scope staff.
- `AC2.3` Every policy has at least one upstream obligation and one downstream control.
- `AC2.4` Watermarked PDF export carries policy version, owner, last reviewed and approver.

---

### 8.3 M03 — Obligations Register & Control Mapping

**Description.** Breaks each regulatory instrument into discrete, actionable obligations. Each obligation is the row that translates the legal text into a clear, plain-language commitment ("The Bank shall …") and that owns the join to controls, policies, returns and CRMP rows.

**Functional rules.**

- `FR3.1` An instrument may decompose into many obligations. Example: CBN AML/CFT/CPF Regulation 2022 decomposes into ~120 obligations. The Drafts CRMP and AMLCFT sheets already provide the seed.
- `FR3.2` Each obligation has: unique ID; parent instrument; clause/section reference; Description (text of the obligation); Plain-language Translation (the "Translate to Clear and Plain Language (Compliance Obligation)" column from the Drafts); Risk Description; Inherent Likelihood (H/M/L); Inherent Impact (H/M/L); Residual Likelihood (H/M/L); Residual Impact (H/M/L); Frequency (Continuous / Real-time / Daily / Event-driven / Weekly / Monthly / Quarterly / Half-yearly / Annual / On-demand / At-onboarding / Per-transaction); Responsible role (R-A-C-I); applicable LOBs.
- `FR3.3` Mapping: Obligation ↔ Control (N:M); Obligation ↔ Policy (N:M); Obligation ↔ Regulatory Return (N:M); Obligation ↔ Training Module (N:M); Obligation ↔ CRMP Theme (N).
- `FR3.4` Obligations Heat Map: visual matrix of obligations × LOB × residual risk; mirrors the analytics in the Drafts Compliance Risk Profile sheet at the obligation level.
- `FR3.5` Bulk import via XLSX template matching the CRMP schema (Theme, S/N, Acts, Section, Title, Description, Plain Language, Risk Description, Inherent L, Inherent I, Responsibility, Control, Residual L, Residual I, Additional Control, Due Date, Responsibility).
- `FR3.6` Obligation status: Mapped / Pending Mapping / Not Applicable / Gap.
- `FR3.7` Obligation-level review cadence with reminders.

**Workflow states.** Drafted → Plain-language translation → Risk-scored → Mapped to control(s) → Owned → Reviewed → Closed (when superseded).

**Acceptance criteria.**

- `AC3.1` 100% of Core / High-rated obligations from the canonical Drafts are mapped to a control owner before Phase-1 go-live.
- `AC3.2` Unmapped obligations surface on the CCO dashboard as a tracked gap.
- `AC3.3` Bulk import of 1,000 obligations in the CRMP schema completes in ≤5 minutes with a downloadable error report.

---

### 8.4 M04 — Risk & Control Self-Assessment / Business Risk Assessment

**Description.** Enterprise-wide RCSA and ML/TF/PF Business Risk Assessment (mandated by CBN AML/CFT/CPF Regulation 2022 §4 and the Money Laundering Act 2022). Supports inherent and residual risk scoring (per the Drafts CRMP four-quadrant scoring), control effectiveness rating and action plans. Hosts the inherent/residual likelihood and impact captured per CRMP row.

**Functional rules.**

- `FR4.1` Standard risk taxonomy: Customer risk, Geographic risk, Product/Service risk, Channel risk, Transaction risk, Regulatory risk, Conduct risk, Cyber risk, Data risk, Outsourcing risk, Reputational risk, Strategic risk, Climate risk, ESG risk, Liquidity risk, Credit risk, Operational risk.
- `FR4.2` 5×5 impact–likelihood matrix configurable per institution; the platform also supports the 3×3 matrix that the Drafts use today (H/M/L on each axis).
- `FR4.3` Business Risk Assessment on schedule (annual at minimum, event-triggered on new product, new geography, new typology).
- `FR4.4` Methodology documentation tied to FATF Recommendations 1 and 10 and GIABA mutual-evaluation criteria.
- `FR4.5` Action plans with owner, due date, dependencies, status, evidence on closure.
- `FR4.6` Per-theme RCSA cycle reflecting each of the twelve CRMP themes; the platform produces a heat-map per theme.
- `FR4.7` Risk appetite: the Board defines risk-appetite thresholds per category; breaches escalate automatically.

**Acceptance criteria.**

- `AC4.1` BRA pack can be produced for NFIU on request within 4 hours.
- `AC4.2` RCSA cycle for any LOB completes within 30 calendar days.
- `AC4.3` Risk-appetite breach triggers escalation within 24 hours of detection.

---

### 8.5 M05 — Controls Testing & Continuous Monitoring (Operationalises the Compliance Monitoring Plan)

**Description.** Library of controls (preventive / detective / corrective; manual / automated / semi-automated); testing schedules; sampling methodology; pass/fail recording; remediation tracking; KCI/KRI; Control Effectiveness Measures. This module operationalises the Drafts Compliance Monitoring Plan in full, reproducing every column — Theme, ID, Regulatory Requirement, Compliance Area, Risk Level, Compliance Control, Monitoring Activity, Frequency, Responsible Officer, Due Date, Status, Control Effectiveness Measure — and extending them with sample selection, evidence capture, exception escalation and continuous monitoring.

**Functional rules.**

- `FR5.1` Control attributes: ID, name, description, type (preventive/detective/corrective), nature (manual/automated/semi-automated), frequency (matching the Drafts schedule), owner, tester (independent), test method (sampling / 100% / KCI / KRI), threshold, last tested, next due, status (Pass / Fail / Partial / Not Tested / Completed / In Progress / Overdue per the Drafts), evidence link, Control Effectiveness Measure (the metric used to evidence the control worked).
- `FR5.2` Sampling: configurable methodology (random, judgmental, stratified) with sample size calculator (AICPA / ISA 530 aligned).
- `FR5.3` Continuous Controls Monitoring (CCM): query connectors to Finacle / T24 / Flexcube / TCS BaNCS / Temenos, to NIBSS BVN service, to the AML engine, to the sanctions engine, to the Core HRIS, to the GL. CCM runs scheduled SQL/API queries and raises exceptions automatically.
- `FR5.4` KCI / KRI library: % of accounts with valid BVN, % of high-risk customers reviewed in the last 12 months, FX position vs CBN net open position limit, dormant account ratio, ATM/POS uptime against CBN SLA targets, % of complaints resolved within CBN 14-day SLA, CRR/LRR compliance, counterfeit-note frequency, large-cash transactions vs CTR threshold, STR aging, sanctions alert closure aging, dormant account aging, customer due diligence overdue counts, etc.
- `FR5.5` Issue management with linkage back to the failing control, the obligation and the CRMP row.
- `FR5.6` Bulk import of monitoring activities via XLSX matching the Drafts Compliance Monitoring Plan schema.
- `FR5.7` Status workflow: Not Tested → In Progress → Completed (Pass) / Completed (Fail) / Completed (Partial) → Remediation In Progress → Closed.
- `FR5.8` Escalation: Overdue activities escalate to the line of business, then to the CCO, then to the Board Risk Committee per a configurable matrix.

**Acceptance criteria.**

- `AC5.1` Control failure raises a tracked issue within 1 hour of detection.
- `AC5.2` ≥90% of scheduled control tests are completed on time.
- `AC5.3` Every monitoring activity in the Drafts Compliance Monitoring Plan is loaded with its frequency, owner, due date, status and control effectiveness measure.

---

### 8.6 M06 — KYC & Customer Due Diligence (CDD / EDD / ODD)

**Description.** End-to-end customer lifecycle: onboarding (Tier 1 / Tier 2 / Tier 3 accounts per CBN Three-Tiered KYC Regulation), risk scoring, periodic review, enhanced due diligence for PEPs and high-risk, ongoing monitoring, exit. Operationalises the AML/CFT/CPF CRMP rows on CDD (s. 12 et seq. of the Drafts AMLCFT sheet) and the Account Management CRMP rows on opening, vulnerable customers and dormant accounts.

**Functional rules.**

- `FR6.1` Customer types: Natural person (Nigerian / non-Nigerian / refugee per CBN Acceptance of MRCTD), Sole Proprietor, Partnership, Limited Liability Company, Public Limited Company, NGO / Incorporated Trustee, Government, Diplomatic Mission, Trust, Cooperative.
- `FR6.2` Tier 1 accounts: N50,000 single deposit, N300,000 cumulative balance — minimum ID, passport photo, address. Tier 2: N100,000 single, N500,000 cumulative — verified ID and address. Tier 3: full KYC, no transaction limits. Limits configurable.
- `FR6.3` Mandatory identifiers for Nigerian customers: BVN (CBN BVN Regulatory Framework), NIN (Mandatory Use of NIN Regulations 2017), TIN (FIRS) for corporate entities, CAC registration number for incorporated entities, RC number for companies, BN number for business names. Identity verification real-time via NIBSS BVN service, NIMC NIN verification, CAC corporate search, FIRS TIN verification, FRSC driver's licence verification (where applicable), NIS passport verification, INEC PVC verification (per the Drafts AMLCFT entry on PVC acceptance).
- `FR6.4` Beneficial Ownership: Persons with Significant Control (PSC) register per CAMA 2020 — 5% threshold; mandatory for legal-person customers; linkage to CAC PSC submission; aligned to the Drafts Guidance on Ultimate Beneficial Owners of Legal Persons.
- `FR6.5` Customer Risk Rating (CRR) model: factors include customer type, occupation/sector, geography, product mix, expected transaction profile, PEP status, source-of-funds documentation. Scoring produces Low / Medium / High / Prohibited. Configurable thresholds.
- `FR6.6` Enhanced Due Diligence (EDD) for High and PEP customers: senior management approval, source-of-funds and source-of-wealth documentation, enhanced ongoing monitoring, annual review. Aligned to the CBN PEP Guidance Note.
- `FR6.7` Ongoing Due Diligence (ODD): periodic refresh — High annual, Medium every 2 years, Low every 3 years; trigger-based refresh on customer events.
- `FR6.8` Account closure / exit workflow with reason codes (regulatory, risk appetite, customer request, dormant per the CBN Guidelines on Management of Dormant Accounts).
- `FR6.9` Tiered KYC for digital / wallet customers (CBN Tier 1 Wallets, PSP and MMO frameworks per the Drafts AMLCFT rows on Tier 1 Wallets and Mobile Money).
- `FR6.10` Watch-list screening at onboarding and continuously: NIBSS Industry Watch-list, NFIU sanctions list, Nigeria Sanctions Committee list, UN consolidated, OFAC SDN, EU consolidated, HMT, World-Check, Dow Jones. (Detailed in M07.)
- `FR6.11` Uniform Account Opening Forms support per the Drafts AMLCFT entry.
- `FR6.12` Authorised Signatories Verification Portal integration per the Drafts AMLCFT entry.

**Acceptance criteria.**

- `AC6.1` Onboarding flow validates BVN + NIN in ≤3 seconds at p95.
- `AC6.2` No customer can be activated with an unresolved sanctions or PEP hit.
- `AC6.3` Periodic review reminders fire automatically; overdue reviews block high-risk debit transactions.
- `AC6.4` PSC register is captured for 100% of legal-person customers at onboarding.

---

### 8.7 M07 — Sanctions, PEP and Adverse-Media Screening

**Description.** Real-time and batch screening of customers, counterparties, beneficial owners, SWIFT messages, payments, trade-finance parties and employees against consolidated sanctions, PEP and adverse-media lists.

**Functional rules.**

- `FR7.1` List management: UN (1267, 1988, 1373, 1540, etc.), OFAC SDN and Consolidated, EU Consolidated, HMT, NSC Nigeria Sanctions Committee list, NFIU designations, Interpol Red Notice (where available), local PEP list curated to include President, VP, Ministers, NASS members, Justices, Service Chiefs, Governors, Deputy Governors, State Commissioners, INEC officials, RIA officials, Local Government chairs, traditional rulers of certain ranks, political party leadership, heads of MDAs.
- `FR7.2` Matching algorithms: exact, fuzzy (Levenshtein, Jaro-Winkler), phonetic (Soundex, Metaphone for English; modified phonetics for Yoruba/Hausa/Igbo names), date-of-birth tolerance, address-based discriminator.
- `FR7.3` Real-time screening of payments via API; SLA ≤500ms p95.
- `FR7.4` Batch screening of customer base on list refresh (daily or as published).
- `FR7.5` Alert workbench: hit details, side-by-side compare, four-eyes approval, audit trail, reason codes (true positive / false positive / discounted), Targeted Financial Sanctions handling per the Drafts AMLCFT rows on TFS (24-hour reporting requirement).
- `FR7.6` Whitelist with expiry and justification.
- `FR7.7` Reporting: hit volumes, false-positive rates, average closure time, by list, by LOB.
- `FR7.8` Sanctions Committee Reporter — direct linkage to M28 Sanctions & Penalties KB.

**Acceptance criteria.**

- `AC7.1` Sanctions list refresh within 4 hours of source publication.
- `AC7.2` False-positive rate ≤30%.
- `AC7.3` Zero true positives released without secondary review.
- `AC7.4` TFS hits trigger reporting workflow within 24 hours per the regulation.

---

### 8.8 M08 — AML Transaction Monitoring

**Description.** Rule-based and behavioural transaction monitoring across all customer transactions (cash, transfers, FX, trade finance, cards, digital channels) for ML, TF and PF typologies. Operationalises the Drafts AMLCFT rows on Designated Predicate Offences, suspicious transaction identification, currency reporting and instant payment functionalities.

**Functional rules.**

- `FR8.1` Rule library calibrated to Nigerian typologies: structuring around N5m/N10m CTR thresholds; rapid in-out (pass-through accounts); BDC clustering; FX round-tripping; multiple BVN-linked beneficiaries; PEP-related transfers; high-value cash deposits inconsistent with profile; cash deposits aggregated across branches in a single day; ATM cash-out spikes; mobile-money funnelling; cryptocurrency-adjacent transactions per the CBN Letter on Crypto.
- `FR8.2` Behavioural baselining per customer; deviation triggers alert.
- `FR8.3` Watch-list re-screening on every monetary event for high-risk customers.
- `FR8.4` Alert workbench with case management; linked KYC, EDD, sanctions and prior STRs.
- `FR8.5` Alert ageing dashboards.
- `FR8.6` Tuning workbench: scenario thresholds, false-positive analysis, suppression rules, change control.
- `FR8.7` Configurable rule import / export (JSON/YAML).
- `FR8.8` Linkage to M09 (STR / CTR generation).

**Acceptance criteria.**

- `AC8.1` 99th-percentile alert generation latency ≤30 seconds from transaction posting.
- `AC8.2` MLRO can close any alert with full audit trail (reason, evidence, four-eyes if required).
- `AC8.3` Tuning changes require maker / checker approval and are versioned.

---

### 8.9 M09 — STR / CTR / CDR / SAR — NFIU goAML Reporting

**Description.** End-to-end suspicious-transaction reporting (STR), currency-transaction reporting (CTR), currency-declaration reporting (CDR) and suspicious-activity reporting (SAR) per the Money Laundering (Prevention and Prohibition) Act 2022, the CBN AML/CFT/CPF Regulations 2022 and NFIU goAML XML schema.

**Functional rules.**

- `FR9.1` STR drafting workspace with structured fields (subject, narrative, supporting transactions, supporting documents).
- `FR9.2` CTR generation against thresholds (N5m individual / N10m corporate) with automatic aggregation rules.
- `FR9.3` CDR tracking for cross-border movement of currency per the Foreign Exchange Manual.
- `FR9.4` goAML XML export aligned to NFIU schema with maker/checker approval before submission.
- `FR9.5` Acknowledgement capture; failure retry; audit trail.
- `FR9.6` STR archive with non-disclosure (tipping-off) controls — limited access per role; access is logged.
- `FR9.7` STR submission SLA: within 24 hours of detection per the AML/CFT/CPF Regulations.
- `FR9.8` Pattern reporting: monthly NFIU pattern reporting (where applicable).

**Acceptance criteria.**

- `AC9.1` goAML XML schema validation passes pre-submission ≥99% of the time.
- `AC9.2` STR submission within 24 hours of detection ≥98% of the time.
- `AC9.3` Tipping-off controls prevent unauthorised disclosure; access attempts are logged.

---

### 8.10 M10 — Regulatory Returns Automation (Operationalises the Returns and Remittance Register)

**Description.** Operationalises the Drafts Returns and Remittance Register (187 rows). Auto-prepares, routes, submits, acknowledges and evidences every return — monthly, quarterly, half-year, annual, event-driven — to CBN (eFASS, FinA, RBS), NDIC, NFIU (goAML), SEC (e-portal), NDPC (NDPC reporting portal), FIRS (TaxPro Max), PenCom (RBS portal), SCUML and others.

**Functional rules.**

- `FR10.1` Returns Register data model carries every Drafts column: S/N, Acts, Type of Return / Obligation, Legal Basis (Section), Description, Timeline / Frequency, Responsible Unit. Extended attributes: target regulator, submission channel, file format, supporting evidence required, approval matrix.
- `FR10.2` Schedule engine fires reminders 30 / 14 / 7 / 1 days before due date.
- `FR10.3` Data-collection connectors to source systems (core banking, treasury, AML, sanctions, complaints, HR, IT) so returns are mostly auto-populated.
- `FR10.4` Maker / checker / approver workflow with role-based approval matrix.
- `FR10.5` Direct submission via regulator API where available (NFIU goAML XML; FIRS TaxPro Max; CBN eFASS where API exposed); manual submission with acknowledgement capture otherwise.
- `FR10.6` Acknowledgement capture (file upload, screenshot, email parsing).
- `FR10.7` Late / missed return escalation per a configurable matrix culminating in CCO and Board Risk Committee.
- `FR10.8` Reporting: returns dashboard showing due / submitted / acknowledged / late counts by regulator, by month.
- `FR10.9` Bulk import via XLSX matching the Drafts Returns Register schema.
- `FR10.10` Mandatory carry-through of the AML/CFT/CPF returns enumerated in the Drafts: Monthly AML compliance status report to Board (s. 9(4)); Annual report on AML/CFT/CPF compliance to CBN (s. 15(2)); STR / CTR / CDR to NFIU; suspicious matters under TFS; quarterly Compliance Function reports; CBN cyber-incident reports; NDPC breach notifications; and every other return enumerated in the Drafts Register.

**Acceptance criteria.**

- `AC10.1` ≥98% of scheduled returns submitted on or before due date.
- `AC10.2` 100% of submitted returns carry a captured acknowledgement.
- `AC10.3` Returns dashboard reconciles to the Returns Register and matches CBN/NFIU/NDPC submission records.

---

### 8.11 M11 — Consumer Protection & Complaints Management

**Description.** Operationalises the Consumer Protection CRMP (Drafts Consumer Protection sheet) and the CBN Consumer Protection Regulations / FCCPA 2018. Surfaces obligations and controls for Fair Treatment, Business Ethics, Sales Promotion & Advertising, Unfair Contract Terms, Lending Practices, Debt Recovery, Complaints Handling and Industry Dispute Resolution.

**Functional rules.**

- `FR11.1` Complaint capture across channels (branch, contact centre, email, web, mobile, social media, CCMS) with category, sub-category, product, channel, customer ID, value at risk.
- `FR11.2` SLA management aligned to CBN Consumer Protection Regulations (14-day initial resolution).
- `FR11.3` Linkage to root cause and the failing control (M05).
- `FR11.4` Redress workflow with maker / checker, financial impact, customer communication.
- `FR11.5` CBN Consumer Complaints Management System (CCMS) integration: import / export of complaints in the CCMS schema.
- `FR11.6` Industry Dispute Resolution: notification, escalation, status tracking per the Drafts ConsProt sheet entry on the Industry Dispute Resolution System.
- `FR11.7` Pre-product launch consumer-protection sign-off: every new product / promotional material / contract template goes through compliance and legal review and the approval is stored.
- `FR11.8` Fair Treatment minimum standards enforced as controls (plain-language disclosure, no hidden fees, accessibility for vulnerable customers).
- `FR11.9` Sales Promotion & Advertising sign-off workflow with mandatory legal / compliance review.
- `FR11.10` Unfair Contract Terms register: list of unfair terms identified, contracts amended, customers re-papered.
- `FR11.11` Lending Practices controls: affordability assessment, fees on disbursed amount only, fee disclosure at offer.
- `FR11.12` Debt Recovery controls: notice templates, escalation steps, courtesy/fair-practice rules, foreclosure timing.
- `FR11.13` Vulnerable customers register (elderly, persons with disabilities, low-literacy, refugees) with tailored handling rules.

**Acceptance criteria.**

- `AC11.1` ≥90% of complaints resolved within 14 days.
- `AC11.2` Monthly CBN consumer-protection return auto-generated and submitted.
- `AC11.3` 100% of new advertising material carries a recorded compliance / legal sign-off prior to release.

---

### 8.12 M12 — Data Protection (NDPA 2023)

**Description.** Operationalises the Data Protection CRMP (Drafts Data Protection sheet) — NDPR 2019, NDPA 2023, GAID 2025 — including governing principles, lawful basis, data subject rights, data breaches and cross-border transfer.

**Functional rules.**

- `FR12.1` Records of Processing Activity (RoPA) per Article 30-equivalent of NDPA: data category, purpose, lawful basis, recipients, retention, security measures.
- `FR12.2` Data Protection Impact Assessment (DPIA) workflow for high-risk processing (new products, profiling, biometrics, large-scale).
- `FR12.3` Data Subject Rights (DSR) ticketing: access, rectification, erasure, portability, objection, restriction, automated-decision objection. 30-day SLA with one extension.
- `FR12.4` Breach register with 72-hour NDPC notification timer; auto-drafted breach notice; severity classification; affected data subject count; controlled customer notification where high risk.
- `FR12.5` Vendor data-processor schedule tracking; standard contractual clauses; periodic vendor security reviews (links to M14).
- `FR12.6` Cross-border transfer register: country, adequacy basis, safeguards (binding corporate rules, standard contractual clauses, certifications).
- `FR12.7` Consent management: capture, withdrawal, audit trail.
- `FR12.8` Data minimisation, retention and disposal scheduling.
- `FR12.9` NDPC registration tracking (annual filing) and DPO designation.
- `FR12.10` Implementation of GAID 2025 specific requirements (per the Drafts row on GAID).

**Acceptance criteria.**

- `AC12.1` Breach notification to NDPC within 72 hours ≥99% of cases.
- `AC12.2` DSR fulfilment within 30 days ≥98% of cases.
- `AC12.3` RoPA covers 100% of in-scope processing activities and is reviewed at least annually.

---

### 8.13 M13 — Whistleblowing

**Description.** Implements the CBN Whistleblowing Guidelines for Banks and OFIs and the bank's Reporting Unethical Conduct policy per the Corporate Governance CRMP.

**Functional rules.**

- `FR13.1` Multi-channel intake: web form, dedicated email, hotline, SMS, branch drop, post; anonymous and identified options.
- `FR13.2` Anonymisation and case management with restricted access (CCO, Ethics Officer, BAC Chair, External counsel).
- `FR13.3` Case workflow: Received → Acknowledged → Triaged → Investigated → Concluded → Closed.
- `FR13.4` Reporter protection: anti-retaliation flags on HR records; periodic check-ins.
- `FR13.5` Reporting: quarterly report to Board Audit Committee per CBN Whistleblowing Guidelines.
- `FR13.6` Linkage to M16 (incident) and M24 (ABAC) where conduct breaches are implicated.

**Acceptance criteria.**

- `AC13.1` Quarterly report to BAC generated automatically.
- `AC13.2` Reporter identity is not exposed to non-authorised users in any system view, export or log.

---

### 8.14 M14 — Vendor / Third-Party Risk Management

**Description.** Implements CBN Outsourcing Standards, the Shared Services Arrangements Guidelines and NDPA data-processor obligations.

**Functional rules.**

- `FR14.1` Vendor inventory: name, services, criticality, data accessed, location, regulatory category (cloud, AML vendor, sanctions vendor, etc.).
- `FR14.2` Onboarding due diligence: legal, financial, security (ISO 27001 / SOC 2), regulatory, sanctions, beneficial ownership.
- `FR14.3` Contract register with key clauses (audit rights, breach notification, sub-processing, exit, data return/destruction).
- `FR14.4` Periodic re-assessment cadence (annual for critical, biennial otherwise).
- `FR14.5` Continuous monitoring: certification expiry, sanctions hits, adverse media, breach disclosures.
- `FR14.6` Exit / termination workflow with data return/destruction certificate.
- `FR14.7` Shared Services arrangements: registration with CBN where required; supervisory access.

**Acceptance criteria.**

- `AC14.1` 100% of critical vendors have an annual re-assessment.
- `AC14.2` No critical vendor onboarded without recorded due diligence.
- `AC14.3` Vendor certification expiry triggers escalation 60 days before expiry.

---

### 8.15 M15 — Training, Attestation & Certification

**Description.** Tracks every training requirement embedded in CRMP controls — AML, sanctions, NDPA, ABAC, conduct, ethics, ESG, cybersecurity, customer-protection — with attestations and certifications.

**Functional rules.**

- `FR15.1` Training catalog with mandatory vs. role-based modules.
- `FR15.2` LMS integration (SCORM / xAPI) or native delivery.
- `FR15.3` Joiner → automatic enrollment in role-mandatory training; failure to complete within SLA escalates to manager and CCO.
- `FR15.4` Attestation campaigns (annual code of conduct, conflict of interest, gifts & entertainment, data protection, AML refresher).
- `FR15.5` Certification tracking: ACAMS, CFE, CIPP, etc. — expiry, renewal reminders.
- `FR15.6` Reporting: completion rates by department, by role, by training.

**Acceptance criteria.**

- `AC15.1` ≥98% completion of mandatory training within 30 days of enrollment.
- `AC15.2` Outstanding training surfaces on staff profile and manager dashboard.

---

### 8.16 M16 — Incident, Breach & Operational-Risk Management

**Description.** Single ledger of incidents across cyber, data, conduct, financial-crime and operational categories. Drives root-cause analysis, remediation, regulator notification and lessons-learned.

**Functional rules.**

- `FR16.1` Intake from CISO platforms (SIEM), DPO, MLRO, branch managers, internal audit, customer-protection.
- `FR16.2` Severity classification: Critical / High / Medium / Low aligned to CBN cyber incident classification.
- `FR16.3` Regulator notification timers (CBN cyber incident reporting; NDPC 72-hour data breach; NFIU; SEC).
- `FR16.4` Root-cause analysis, corrective and preventive actions, owner, due date, evidence on closure.
- `FR16.5` Lessons-learned feedback loop into CRMP, RCSA, controls and policies.
- `FR16.6` Operational-risk loss event register aligned to Basel categories.

**Acceptance criteria.**

- `AC16.1` Critical incidents have a regulator notification within the prescribed window in ≥99% of cases.
- `AC16.2` Closure requires evidence; closures without evidence are blocked.

---

### 8.17 M17 — Compliance Calendar

**Description.** Single calendar surfacing every due date — CRMP reviews, monitoring activities, returns, reviews, trainings, attestations, audits, regulator engagements. Acts as the activity backbone for Phase 4 of the compliance process.

**Functional rules.**

- `FR17.1` Per-user calendar view; per-team view; CCO view; Board view.
- `FR17.2` ICS / iCal export for personal calendar integration.
- `FR17.3` Status colours: Upcoming / Due / Overdue / Completed.
- `FR17.4` Drill-down to source item.

**Acceptance criteria.**

- `AC17.1` All due dates from the Returns Register, the CRMP and the Monitoring Plan surface on the calendar.
- `AC17.2` Calendar reconciles to the source modules on every refresh.

---

### 8.18 M18 — Dashboards, Board Pack & Regulator Portal (Operationalises the Compliance Risk Profile)

**Description.** Reproduces and extends the Drafts Compliance Risk Profile sheet as live dashboards; produces the monthly Board pack; provides a read-only regulator portal.

**Functional rules.**

- `FR18.1` Executive Dashboard reproducing the Drafts Risk Profile KPIs: Total Obligations; Number of Regulatory Bodies; Number of High-Risk Items; Number of Areas of Focus.
- `FR18.2` Breakdown panels reproducing the Drafts pivots: Nature of Compliance Items (Core / Topical / Secondary / Others); Compliance Item Categories (Act / Circular / Code / Directive / Exposure Draft / Framework / Guidance / Guidelines / Law / Manual / Regulations / Rules / Policy); Regulatory Bodies; Areas of Focus; Risk Rating (H / M / L).
- `FR18.3` Per-CRMP heat map (12 themes) showing inherent vs. residual risk distribution.
- `FR18.4` Returns status panel (due, submitted, acknowledged, late).
- `FR18.5` Monitoring status panel (Completed / In Progress / Overdue / Failed).
- `FR18.6` Incident / breach panel (volume, severity, age).
- `FR18.7` Sanctions & Penalties exposure panel (recent enforcement, by regulator).
- `FR18.8` Board pack export (PDF / DOCX / PPTX) per a configurable template, signed off by the CCO.
- `FR18.9` Regulator portal (Phase 2): read-only access via federated identity (regulator-issued token) to specific datasets — regulatory library entries, mapped controls, monitoring status, evidence — without customer PII.

**Acceptance criteria.**

- `AC18.1` Dashboards refresh within 5 minutes of underlying change.
- `AC18.2` Board pack assembled in under 60 seconds.
- `AC18.3` Regulator-portal sessions are audited; data exports are watermarked.

---

### 8.19 M19 — Audit Trail & Evidence Vault

**Description.** Every action, approval, edit, sign-off captured with WORM-class evidence; underpins regulator readiness; the technical backbone of every other module.

**Functional rules.**

- `FR19.1` Immutable, append-only event log: user, timestamp, action, before, after, IP, session, signed digest.
- `FR19.2` Evidence Vault: signed PDFs of approvals, screenshots, exports, attachments, with hash references in the event log.
- `FR19.3` Retention: minimum five years (per CBN AML/CFT/CPF Regulation 2022 record-keeping requirement) and where longer required by NDPA, FRC, FIRS, ISA, etc.
- `FR19.4` Legal hold: any record subject to legal hold cannot be purged.
- `FR19.5` Tamper-evident packaging for regulator evidence packs (digital signature, manifest, hash chain).

**Acceptance criteria.**

- `AC19.1` Any audited action can be replayed end-to-end from the event log.
- `AC19.2` No event log entry can be edited or deleted.
- `AC19.3` Evidence packs reproduce identically when re-generated for the same scope and period.

---

### 8.20 M20 — FATCA & CRS

**Description.** Customer classification (US Person, controlling persons), W-8/W-9 collection, annual reporting per the Nigeria–US FATCA IGA and the OECD CRS.

**Functional rules.**

- `FR20.1` Customer classification at onboarding and on customer-data change.
- `FR20.2` Document collection (W-9 / W-8BEN / W-8BEN-E / self-certifications).
- `FR20.3` Annual reporting file generation in the CRS XML schema and the FATCA IDES schema.
- `FR20.4` Submission to FIRS (CRS) and to IRS via IDES (FATCA).
- `FR20.5` Indicia review and remediation workflow.

**Acceptance criteria.**

- `AC20.1` Annual CRS / FATCA submission within deadline.
- `AC20.2` Indicia review backlog ≤ 0 at year-end.

---

### 8.21 M21 — Tax Compliance Cockpit (Operationalises the Financial Reporting CRMP)

**Description.** Operationalises the Financial Reporting CRMP for tax obligations — VAT, WHT, EMTL, CIT, Stamp Duty, Tertiary Education Tax (TET) — to FIRS, state Internal Revenue Services and Lagos State (per the Drafts entries).

**Functional rules.**

- `FR21.1` Tax calendar per obligation, per jurisdiction.
- `FR21.2` Auto-generation of returns from source data via tax engine integration.
- `FR21.3` FIRS TaxPro Max integration where available.
- `FR21.4` Approval and submission workflow with evidence.
- `FR21.5` WHT receipts and credit notes generated and dispatched.

**Acceptance criteria.**

- `AC21.1` Monthly VAT / WHT / EMTL submission on or before due date ≥98% of months.
- `AC21.2` All tax payments evidenced and reconciled to the GL.

---

### 8.22 M22 — Conduct Surveillance Hooks (Operationalises the People & Conduct Risk CRMP)

**Description.** Operationalises the People & Conduct Risk CRMP — Pension Reform Act 2014, NSITF, ITF, National Minimum Wage Act, Trade Union Act, Compliance with Bank Employees Declaration of Assets, Blacklisting Guidelines, De-marketing of Banks, CIBN Act, Competency Framework, Discrimination Against PWD Act, NYSC Act — and ingests alerts from market-abuse / mis-selling / insider-trading surveillance engines for case management.

**Functional rules.**

- `FR22.1` Employee compliance attestations: declaration of assets, conflict of interest, gifts & entertainment, outside business activities.
- `FR22.2` Code of Conduct attestation campaigns.
- `FR22.3` Blacklisting workflow per the CBN Blacklisting Guidelines.
- `FR22.4` De-marketing complaints register.
- `FR22.5` HR-event-driven training (joiner / mover / leaver) triggers; CIBN certification verification.
- `FR22.6` Pension Reform Act compliance: enrolment, remittance, group life insurance — links to monthly PenCom remittance return.
- `FR22.7` Market-abuse / insider-trading / mis-selling alert ingestion; case management.
- `FR22.8` Disability/PWD inclusion controls; NYSC posting compliance for graduate intakes.

**Acceptance criteria.**

- `AC22.1` Annual Code of Conduct attestation completion ≥98%.
- `AC22.2` Pension remittance reconciled monthly to PenCom records.

---

### 8.23 M23 — Open Banking Compliance

**Description.** Operationalises CBN Open Banking Regulatory Framework 2021 and Operational Guidelines 2023.

**Functional rules.**

- `FR23.1` Consent register: capture, withdraw, audit.
- `FR23.2` API access log with throttling, rate-limit and security.
- `FR23.3` Third-party (TPP) onboarding workflow: regulator licence verification, security assessment, contract.
- `FR23.4` Open Banking incident logging.

**Acceptance criteria.**

- `AC23.1` Customer consent withdrawal takes effect within minutes and is auditable.
- `AC23.2` Open Banking API security tests pass quarterly.

---

### 8.24 M24 — Anti-Bribery & Corruption (ABAC) — (Operationalises the ABAC CRMP)

**Description.** Operationalises the ABAC CRMP (Drafts ABAC sheet) — EFCC Establishment Act 2004, Corrupt Practices and Other Related Offences Act 2000 (ICPC), Nigerian Criminal Code 1990, and Wolfsberg ABAC Principles — alongside FCPA / UK Bribery Act for extraterritorial exposure.

**Functional rules.**

- `FR24.1` Gifts & Entertainment register: capture, threshold-based pre-approval, post-event log, periodic review.
- `FR24.2` Facilitation Payments register (zero-tolerance default; any payment requires CCO approval and post-event NFIU/EFCC consultation).
- `FR24.3` Charitable Contributions and Political Donations register with policy thresholds.
- `FR24.4` Third-party due diligence (intermediaries, agents, vendors) for ABAC risk; integrates with M14.
- `FR24.5` ABAC training and attestation for all staff and identified high-risk roles.
- `FR24.6` EFCC information request workflow: receive, log, route to CCO and Legal, prepare response within statutory window, log evidence (per s.34(3) freezing-order workflow WF-07).
- `FR24.7` ICPC reporting and assistance workflow.
- `FR24.8` Periodic ABAC risk assessment as part of the BRA (M04).

**Acceptance criteria.**

- `AC24.1` 100% of gifts above the policy threshold are logged with pre-approval.
- `AC24.2` Facilitation payments register is empty in steady state; any entry escalates to the CCO and BAC.
- `AC24.3` EFCC freezing orders are implemented within 30 minutes of receipt and have an audit trail.

---

### 8.25 M25 — Corporate Governance (Operationalises the Corporate Governance CRMP)

**Description.** Operationalises the Corporate Governance CRMP (Drafts Corporate Governance sheet). Source instruments include the CBN Corporate Governance Guidelines for Commercial Banks, Merchant Banks, Non-Interest Banks and Payment Service Banks; the Status of Chief Compliance Officers circular; the Establishment and Rationalisation of Board Committees; the Revised Assessment Criteria for Approved Persons; CBN Act 2007; the Fiscal Responsibility Act 2007; CAMA 2020; BOFIA 2020; SEC CG Guidelines; Nigerian Code of Corporate Governance 2018; Prudential Guidelines for Deposit Money Banks 2019; CBN Whistleblowing Guidelines for Banks and OFIs; Re: Need for CBN Prior Clearance of Promotions for Top Bank Officials; Guidelines for Shared Services Arrangements; Evidence Act 2011; Trade Marks Act.

**Functional rules.**

- `FR25.1` Board composition register: members, INED ratio, sub-committees, term expiry, declarations.
- `FR25.2` Fit-and-Proper workflow per the Approved Persons regime, with CBN no-objection routing for senior management appointments.
- `FR25.3` Board committees register (Risk, Audit, Governance, Compensation, etc.) with charters, minutes log, members.
- `FR25.4` Board / Committee meeting attendance log; quorum and frequency compliance.
- `FR25.5` Related-Party Transactions (RPT) register; pre-approval workflow; disclosure to Board, ExCo and to CBN per Prudential Guidelines.
- `FR25.6` Conflicts of Interest register; annual declarations; event-driven declarations.
- `FR25.7` Independent Professional Advice register: requests, approvals, evidence per Corporate Governance Guidelines §4.0.
- `FR25.8` Whistleblowing report to Board Audit Committee (cross-links M13).
- `FR25.9` Promotion-of-Top-Officials prior-clearance workflow (links to PenCom and CBN).
- `FR25.10` Fiscal Responsibility Act compliance (where applicable to bank subsidiaries / treasury operations involving public funds).
- `FR25.11` Board evaluation: annual board, committee and director evaluations.
- `FR25.12` AGM / EGM compliance: notice, agenda, resolutions, filings with CAC and SEC where applicable.
- `FR25.13` CCO appointment workflow per the Status of Chief Compliance Officers circular (Board approval, reporting line).
- `FR25.14` Outsourced / Shared Services governance approvals per Shared Services Arrangements Guidelines.

**Acceptance criteria.**

- `AC25.1` 100% of board appointments routed via the fit-and-proper workflow with CBN no-objection captured.
- `AC25.2` 100% of RPTs above threshold pre-approved and disclosed.
- `AC25.3` AGM / EGM filings with CAC / SEC submitted on time ≥98% of years.
- `AC25.4` Annual board evaluation completed and signed off.

---

### 8.26 M26 — ESG & Sustainable Banking (Operationalises the ESG CRMP)

**Description.** Operationalises the ESG CRMP (Drafts ESG sheet) — Nigerian Sustainable Banking Principles (NSBP), Climate Change Act 2021, NSE Sustainable Disclosure Requirements, FRC Sustainability Disclosure Standards — and NCCC reporting obligations.

**Functional rules.**

- `FR26.1` Environmental & Social Risk Assessment (E&S) of credit transactions: questionnaire, scoring, mitigation actions.
- `FR26.2` E&S exclusion list (e.g., specific extractive, weapons, forced labour exposures).
- `FR26.3` Carbon / GHG inventory tracking (Scope 1, 2, 3 to the extent feasible).
- `FR26.4` Climate-risk register: transition risk, physical risk; integrated with the credit risk register where the bank has exposure.
- `FR26.5` NCCC reporting per the Climate Change Act 2021 — annual emissions and decarbonisation plan disclosure.
- `FR26.6` Sustainability Disclosure preparation per FRC SDS — workpapers, evidence, sign-off, board approval.
- `FR26.7` NSE Sustainable Disclosure Report preparation.
- `FR26.8` NSBP reporting to CBN (annual).
- `FR26.9` Green-lending taxonomy and tagging on credit decisions.
- `FR26.10` ESG training and attestation.

**Acceptance criteria.**

- `AC26.1` 100% of in-scope credit transactions have an E&S assessment on file.
- `AC26.2` Annual NSBP report submitted to CBN on time.
- `AC26.3` Annual sustainability disclosure (FRC, NSE) prepared and approved by Board.

---

### 8.27 M27 — Capital Market Compliance (Operationalises the Capital Market CRMP)

**Description.** Operationalises the Capital Market CRMP (Drafts Capital Market sheet) — Investment and Securities Act 2025, SEC Rules and Regulations 2013 (as updated), Rulebook of the Nigerian Stock Exchange / NGX, FMDQ Rulebooks — for the bank's treasury and investment-banking activities.

**Functional rules.**

- `FR27.1` Issuer-side disclosure register (if the bank is a listed issuer): material event disclosure to NGX / SEC within prescribed deadlines.
- `FR27.2` Issuer half-year and annual financial disclosures with sign-off workflow.
- `FR27.3` Capital Market Operator (CMO) licensing renewal tracker.
- `FR27.4` Insider list and insider trading window management.
- `FR27.5` Market abuse surveillance hook ingestion (links to M22).
- `FR27.6` AML/CFT for Capital Market Operators per SEC Regulations 2022 — surfaces controls already implemented under M06–M09 tagged to the CMO function.
- `FR27.7` Continuous disclosure obligations register: dividends, board changes, capital actions, material contracts.
- `FR27.8` FMDQ-specific obligations: OTC trade reporting, post-trade obligations, fixed-income market conduct.
- `FR27.9` Underwriting & primary-issuance compliance: prospectus review, allotment, return of allotments.
- `FR27.10` Investor complaint handling: dedicated route to SEC Complaints Management Framework.

**Acceptance criteria.**

- `AC27.1` 100% of material events disclosed within SEC / NGX deadlines.
- `AC27.2` Insider list integrity controls prevent trading during closed windows.
- `AC27.3` Half-year and annual disclosures filed by due date.

---

### 8.28 M28 — Sanctions & Penalties Knowledge Base (Operationalises the Sanctions and Penalties Grid)

**Description.** Reproduces the Drafts Sanctions and Penalties Grid (417 lines) as a queryable knowledge base. Every sanction line is loaded with the columns from the Drafts: S/N, Compliance Obligation Source, Section, Offence / Obligation, Sanction or Penalty, Implication for Commercial Banks, Responsible Party.

**Functional rules.**

- `FR28.1` Sanctions Grid entity carries every Drafts column with the obligation source linked to the M01 instrument.
- `FR28.2` Each sanction line is searchable by source, section, offence, sanction amount, responsible party, and the obligation it backs.
- `FR28.3` Each obligation in M01 surfaces the list of sanctions that apply to non-compliance, providing the CCO with an "exposure-at-risk" view per obligation.
- `FR28.4` Each control in M05 surfaces the sanctions it mitigates — quantifying the cost of control failure.
- `FR28.5` Bulk import in the Drafts schema (8 columns).
- `FR28.6` Dashboard view: total potential exposure (₦) per CRMP theme, per regulator, per LOB.
- `FR28.7` Incident-to-sanction link: when a breach is recorded in M16, the platform surfaces the applicable sanctions and an estimated exposure.
- `FR28.8` Auto-update from M01 horizon-scanner when a new instrument carries new sanction sections.

**Acceptance criteria.**

- `AC28.1` All 417 lines of the Drafts Sanctions Grid load on Day 1.
- `AC28.2` Every sanction line is searchable in ≤2 seconds.
- `AC28.3` Incident records show applicable sanctions automatically.
- `AC28.4` Bulk import of additional sanctions in the 8-column schema completes in ≤2 minutes with a downloadable error report.

---

### 8.29 M29 — Account Management Compliance (Operationalises the Account Management CRMP)

**Description.** Operationalises the Account Management CRMP (Drafts Actmgt sheet) — CBN Guidelines on Management of Dormant Accounts and Other Unclaimed Funds, Guidelines on Operations of Bank Accounts for Vulnerable Persons, Re: Guidelines on Management of Dormant Accounts, NDIC Act, Guidelines on Financial and Technical Assistance, Exposure Draft - Revised Framework for Differentiated Banking Models, Re: Guide to Charges by Banks, Re: Interest Rate on Savings Deposit, Review of ATM Transaction Charges, Circular on the Implementation of e-Dividend Mandate, Dishonoured Cheques (Offences) Act, Need to Implement Measures to Dissuade Issuance of Dud Cheques.

**Functional rules.**

- `FR29.1` Dormant Account workflow: classification at 6 months no activity / 1 year inactive per CBN guideline; reactivation procedure; transfer to CBN unclaimed-funds pool after the statutory period; reactivation customer notice and audit trail.
- `FR29.2` Vulnerable Persons account workflow: differentiated CDD; periodic welfare check; safeguarding controls.
- `FR29.3` e-Dividend Mandate management: customer mandate capture; dividend application to mandated account; e-DMMS portal linkage.
- `FR29.4` Dishonoured Cheques register: capture, reporting to credit bureaus, customer warning, criminal-referral workflow per the Dishonoured Cheques (Offences) Act and the CBN Need to Dissuade Issuance of Dud Cheques circular.
- `FR29.5` Charges compliance per the CBN Guide to Bank Charges 2020 (as amended): no charge outside the guide; charges reconciliation; refund workflow.
- `FR29.6` Savings deposit interest rates per CBN Re: Interest rate on savings deposit.
- `FR29.7` ATM transaction-charges enforcement per the CBN ATM charges review.
- `FR29.8` Differentiated Banking Models adherence for any segment-specific account types.
- `FR29.9` Account closure with reason codes (CBN regulatory, customer request, risk-appetite, dormant, deceased).
- `FR29.10` Linkages to M06 KYC, M11 Consumer Protection and M16 Incident.

**Acceptance criteria.**

- `AC29.1` 100% of accounts classified as dormant per guideline within the prescribed period.
- `AC29.2` Zero charges raised outside the Guide to Bank Charges.
- `AC29.3` e-Dividend mandates processed within prescribed turnaround.

---

### 8.30 M30 — Cash Management Compliance (Operationalises the Cash Management CRMP)

**Description.** Operationalises the Cash Management CRMP (Drafts Cash Mgt sheet) — Clean Note Policy v0.1, Penalty for Payment of Counterfeit Banknotes from the CBN, Updated Penalty on Inappropriate Cash Disbursement — and other CBN cash and currency operations circulars.

**Functional rules.**

- `FR30.1` Clean Note Policy: branch and ATM cash-quality reporting; mutilated note exchange workflow.
- `FR30.2` Counterfeit Note workflow: detection, capture, immediate hand-off to CBN, customer counter-claim, penalty per CBN circular.
- `FR30.3` Cash disbursement compliance: large-cash thresholds, in-branch escort, ATM cash-out limits, cash-in-transit certification.
- `FR30.4` Currency operations: deposit/withdrawal of foreign currency; FX cash sale per CBN PTA/BTA policy and the related defaulters circular.
- `FR30.5` ATM operations: uptime SLAs, cash-replenishment cadence; integration with M05 KCI dashboards.
- `FR30.6` Cash logistics: vault management, key-holder controls, dual-control reconciliation.
- `FR30.7` Linkages to M07 sanctions screening on cross-border cash movements, M09 CDR reporting, and M16 incident.

**Acceptance criteria.**

- `AC30.1` 100% of counterfeit-note incidents handed to CBN within prescribed window.
- `AC30.2` Cash disbursement above CTR threshold triggers M09 CTR workflow.
- `AC30.3` ATM uptime KCIs reported daily to operations and weekly to compliance.

---

## 9. Non-Functional Requirements

### 9.1 Performance

| ID | Requirement |
|---|---|
| NFR1 | Real-time sanctions / PEP screening latency ≤500ms at p95 (and ≤800ms at p99). |
| NFR2 | Customer onboarding identity-verification round-trip (BVN + NIN + CAC + sanctions hit) ≤3 seconds at p95. |
| NFR3 | AML transaction-monitoring alert generation latency ≤30 seconds from transaction posting at p99. |
| NFR4 | Compliance Universe search ≤2 seconds at p95 across 5,000 documents and 50,000 obligations. |
| NFR5 | Dashboard refresh ≤5 minutes from underlying change. |
| NFR6 | Bulk import of 1,000 obligations in the CRMP schema ≤5 minutes. |
| NFR7 | Board pack generation ≤60 seconds. |
| NFR8 | Returns auto-draft generation ≤2 minutes per return. |
| NFR9 | Evidence pack assembly ≤4 hours from request, for a scope of up to 50 obligations. |

### 9.2 Availability and Resilience

| ID | Requirement |
|---|---|
| NFR10 | Platform availability ≥99.9% during business hours (08:00–18:00 WAT, Mon–Sat); ≥99.5% 24×7. |
| NFR11 | RPO ≤15 minutes; RTO ≤4 hours for the production environment; ≤24 hours for full DR. |
| NFR12 | Active-active deployment across two Nigerian data centres or hyperscaler availability zones. |
| NFR13 | Disaster Recovery exercised at least annually with documented results. |
| NFR14 | Graceful degradation: if a downstream system (BVN, NIMC, goAML) is unavailable, queued retries with operator notification; no transaction is silently dropped. |

### 9.3 Scalability

| ID | Requirement |
|---|---|
| NFR15 | Support up to 50 million customer records and 1 billion transactions per year. |
| NFR16 | Support up to 5,000 concurrent named users; up to 50,000 API calls per second for screening. |
| NFR17 | Horizontal scaling for screening, transaction monitoring and ingestion services. |

### 9.4 Security and Privacy

| ID | Requirement |
|---|---|
| NFR18 | All data encrypted in transit (TLS 1.2+; TLS 1.3 preferred) and at rest (AES-256). |
| NFR19 | Customer PII pseudonymised in non-production environments. |
| NFR20 | Application security aligned to OWASP ASVS Level 2 (minimum) and the CBN Risk-Based Cybersecurity Framework controls applicable to Tier-1 banks. |
| NFR21 | Annual penetration testing by an independent, CBN-recognised firm; results reviewed by CISO and CCO. |
| NFR22 | ISO 27001-certified hosting; SOC 2 Type II reports from any cloud provider. |
| NFR23 | NDPA 2023 compliance for the platform itself: lawful basis, data minimisation, retention, cross-border transfer safeguards, DPO designation. |
| NFR24 | Cybercrime (Prohibition, Prevention, Etc) Act 2015 (as amended) compliance for incident response and reporting. |
| NFR25 | All administrator actions require maker-checker; privileged access is time-bound and JIT. |
| NFR26 | Comprehensive Identity and Access Management with SSO, MFA (TOTP / FIDO2 / push), role-based access, least privilege, periodic access recertification. |
| NFR27 | API authentication via mTLS or OAuth 2.0 + signed JWT; rate-limiting; replay protection. |
| NFR28 | DLP controls on exports; watermarking on all reports leaving the platform. |
| NFR29 | Anti-tamper controls: WORM storage for the evidence vault; hash-chain integrity proofs. |
| NFR30 | CBN Risk-Based Cybersecurity Framework annual self-assessment for the platform; CBN cyber-incident reporting integrated. |

### 9.5 Auditability

| ID | Requirement |
|---|---|
| NFR31 | Every functional action produces an immutable audit log entry. |
| NFR32 | Audit log retained at minimum 5 years (AML/CFT/CPF Reg 2022); 7 years for tax records; per NDPA where personal data is involved. |
| NFR33 | Internal Audit has read-only access to all data, all logs, all reports. |

### 9.6 Localisation and Accessibility

| ID | Requirement |
|---|---|
| NFR34 | English (Nigerian) primary; with localisation hooks for Hausa, Yoruba and Igbo customer-facing artefacts where required. |
| NFR35 | West Africa Time (WAT, UTC+1) as primary; all timestamps stored in UTC and displayed in WAT by default. |
| NFR36 | Web Content Accessibility Guidelines (WCAG) 2.1 AA compliance for staff UIs. |
| NFR37 | Currency: NGN primary; multi-currency support (USD, EUR, GBP, ZAR, GHS, KES, XOF, XAF and others) for FX-touching modules. |

### 9.7 Usability

| ID | Requirement |
|---|---|
| NFR38 | A new compliance officer can complete first-day training and onboard their first customer within four working hours. |
| NFR39 | Branch users complete account-opening KYC in ≤8 minutes for a Tier 3 individual; ≤15 minutes for a corporate. |
| NFR40 | All major actions reachable within three clicks from the home dashboard for each role. |

### 9.8 Data Residency and Sovereignty

| ID | Requirement |
|---|---|
| NFR41 | Production data resides in Nigeria; cross-border copies (DR, vendor support) only where NDPA cross-border transfer safeguards are documented. |
| NFR42 | Cloud hosting in a CBN-approved Nigerian data centre region; if hyperscaler, the bank confirms NITDA/NDPC compliance prior to go-live. |
| NFR43 | Encryption keys managed in a FIPS 140-2 Level 2+ HSM located in Nigeria; key custodianship per the bank's information-security policy. |

### 9.9 Sustainability of the Platform

| ID | Requirement |
|---|---|
| NFR44 | Backwards-compatible APIs for at least 18 months; deprecation notice period 90 days. |
| NFR45 | Quarterly release cycle with hotfix capability; release notes published. |
| NFR46 | Configuration over code: reference taxonomies, risk matrices, workflow rules, return templates and report layouts administrable without code change. |

---

## 10. Regulatory and Compliance Requirements (Mapping)

The platform is built to satisfy the obligations issued by the regulators below. Each module in Section 8 declares which regulator(s) it primarily serves. The table is the formal mapping between regulator, primary instruments, and the modules that operationalise them.

| Regulator / Agency | Mandate (in Scope) | Primary Instruments (Drafts and Beyond) | Modules |
|---|---|---|---|
| CBN — Central Bank of Nigeria | Banking, payments, FX, currency, prudential, AML/CFT/CPF for banks and OFIs, consumer protection, cybersecurity, Open Banking, PSBs, MFBs, dormant accounts, charges, dishonoured cheques | BOFIA 2020; CBN Act 2007; CBN Circulars (Banking Supervision, FPR, PSM, CPD, Currency Ops, OFISD); CBN AML/CFT/CPF Regulations 2022; Three-Tiered KYC; BVN Regulatory Framework; Open Banking Framework 2021 + Operational Guidelines 2023; Risk-Based Cybersecurity Framework 2018/2022; Consumer Protection Framework + Regulations (and the Revised Consumer Protection Regulations 2.0 Exposure Draft); CCMS; Corporate Governance Guidelines for Commercial Banks; Status of CCO; PEP Guidance Note; Targeted Financial Sanctions Regulation 2022; Guidelines on Management of Dormant Accounts; Guide to Bank Charges; ATM Charges Review; Clean Note Policy; Counterfeit Notes Circulars; Whistleblowing Guidelines; Shared Services Guidelines; Approved Persons Regime; eNaira Regulations; QR Code Payments Framework; Mobile Money Framework; PSP / PSB Frameworks; NSBP; Cessation of Crypto Activities Letter; Tier 1 Wallets Guidance; Need to Dissuade Issuance of Dud Cheques; Re: Interest Rate on Savings Deposit; Receipt of Diaspora Remittances; FX Manual and PTA/BTA Circulars; etc. | M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M16, M17, M18, M22, M23, M25, M28, M29, M30 (and platform NFRs under §9.4) |
| NDIC | Deposit insurance, target examinations, failure resolution, premium assessment | NDIC Act 2023; Differential Premium Assessment System | M01, M10, M29 |
| NFIU | Receives STR/CTR/CDR; financial-intelligence analysis; goAML | NFIU Act 2018; NFIU Regulations; goAML XML schema; FATF Recs; GIABA | M01, M07, M08, M09, M10 |
| SCUML | DNFBP supervision; SCUML reporting | Money Laundering (Prevention and Prohibition) Act 2022 | M09, M10 |
| SEC | Capital market; CMO licensing; AML/CFT for CMOs; CG | ISA 2025; SEC Rules 2013 (as updated); SEC AML/CFT (Capital Market Operators) Regulations 2022; SEC Code of Corporate Governance; SEC Guidance on Sections 60–63 ISA 2007 | M01, M03, M07, M08, M09, M10, M25, M27 |
| NGX | Listing rules; market surveillance; post-listing obligations | NGX Rulebook; Listing Rules; Sustainable Disclosure Requirements | M01, M10, M22, M26, M27 |
| FMDQ | OTC market; debt capital markets; FX; derivatives | FMDQ Rulebooks | M01, M10, M27 |
| NDPC | Data protection supervisory authority | Nigeria Data Protection Act (NDPA) 2023; NDPR 2019; NDPC Implementation Directive / GAID 2025 | M01, M10, M12, M14, M16, M19 (and all NFRs under §9.4 and §9.8) |
| NITDA | ICT industry development; cybersecurity for IT systems | NITDA Act 2007; NITDA Code of Practice for Interactive Computer Service Platforms | M12, M16 (and platform NFRs) |
| FIRS | Federal taxes — VAT, CIT, WHT, EMTL, Stamp Duty, FATCA/CRS, CGT, TET | FIRS Establishment Act; FATCA IGA Model 2; CRS Regulations; FIRS Tax Circulars | M01, M10, M20, M21 |
| CAC | Company registration; beneficial ownership register (CAMA 2020 PSC); business name; incorporated trustees | CAMA 2020 | M01, M06, M25 |
| FRC | Accounting standards; audit oversight; corporate governance; sustainability disclosure | FRC Act 2011 (as amended); Nigerian Code of Corporate Governance 2018; Nigerian Sustainability Disclosure Standards | M01, M10, M25, M26 |
| NAICOM | Insurance and reinsurance; takaful | Insurance Act 2003; NAICOM Operational Guidelines; RBS Framework | M01, M10 (if insurance subsidiaries in scope) |
| PenCom | PFAs, PFCs, CPS | Pension Reform Act 2014; PenCom RBS Framework; Discontinuation of DBA | M01, M10, M22, M25 |
| EFCC | Financial-crime investigation; bank reporting interactions | EFCC Establishment Act 2004; Advance Fee Fraud Act 2006 | M01, M09, M16, M24 |
| ICPC | Corruption-related offences | Corrupt Practices and Other Related Offences Act 2000 | M01, M24 |
| NCC | USSD, mobile money, telecoms partnerships | NCC Act; USSD Pricing Determination | M01, M23 |
| FCCPC | Competition and consumer protection | Federal Competition and Consumer Protection Act 2018 | M01, M11 |
| NIMC | NIN | NIMC Act 2007; Mandatory Use of NIN Regulations 2017 | M06 |
| NIBSS | BVN; NIP; NEFT; Industry Customer Account Database; Watch-list | CBN-issued operating rules; BVN Framework | M06, M07, M08 |
| OAGF | AML/CFT designations; MLA; NSC secretariat | Money Laundering Act 2022; Terrorism Prevention and Prohibition Act 2022 | M07, M09 |
| NSC — Nigeria Sanctions Committee | Maintains Nigerian sanctions list; UN 1267/1373/1540 designations | TPPA 2022; NSC Implementation Regulations | M07 |
| NCCC | Climate change governance | Climate Change Act 2021 | M01, M26 |
| Federal Government of Nigeria | Statutes | CAMA 2020; BOFIA 2020; ISA 2025; NDPA 2023; Cybercrime Act 2015 (Amended); Money Laundering Act 2022; TPPA 2022; Climate Change Act 2021; FCCPA 2018; Various Acts | M01 (canonical loader) |
| Lagos State Government / Other State Govts | State taxes and levies | Lagos State Internal Revenue laws; PAYE | M21 |
| FATF / GIABA | International AML/CFT standards | FATF Recommendations; GIABA mutual-evaluation reports | M03, M04, M07, M08, M09 |
| Wolfsberg Group | Industry AML/ABAC principles | Wolfsberg AML/ABAC Principles | M06, M07, M24 |
| US Government (FATCA) / OECD (CRS) | FATCA / CRS reporting | FATCA IGA; CRS | M20 |

[ASSUMPTION] Insurance and pensions modules (NAICOM, PenCom-supervised PFAs) are out of scope for bank-only deployments unless the institution has an insurance or pension subsidiary; in that case M01/M10 are extended.

---

## 11. Data Requirements

### 11.1 Key Data Entities (Conceptual)

| ID | Entity | Description |
|---|---|---|
| E1 | RegulatoryInstrument | Master record for every Act, Circular, Code, Directive, Exposure Draft, Framework, Guidance, Guidelines, Law, Manual, Regulations, Rules, Policy — with the 17 standard attributes (§11.2). |
| E2 | Regulator | One of the 43 issuing bodies (and growing). |
| E3 | InstrumentType | One of the 13 types from the Drafts. |
| E4 | NatureOfItem | Core / Topical or Pertinent / Secondary / Others. |
| E5 | InstrumentStatus | Current / Outdated / Exposure Draft. |
| E6 | AreaOfFocus | One of the 29 areas from the Drafts (extensible). |
| E7 | RiskRating | High / Medium / Low (configurable matrix). |
| E8 | Obligation | A discrete row from the universe / per-theme CRMP, with plain-language translation, inherent/residual risk and Risk Description. |
| E9 | CRMP | A live, multi-row register per theme (twelve themes). |
| E10 | CRMPRow | A single CRMP entry: theme, acts, section, title, description, plain-language, risk description, inherent L, inherent I, responsibility, control, residual L, residual I, additional control, due date, responsibility. |
| E11 | Control | A preventive / detective / corrective control with owner, frequency, evidence, KCI/KRI. |
| E12 | Policy | A versioned internal policy / procedure. |
| E13 | MonitoringActivity | A row of the Compliance Monitoring Plan: regulatory requirement, compliance area, risk level, compliance control, monitoring activity, frequency, responsible officer, due date, status, control effectiveness measure. |
| E14 | Return | A row of the Returns Register: acts, type of return, legal basis (section), description, timeline, responsible unit, regulator, channel, evidence. |
| E15 | Sanction | A row of the Sanctions & Penalties Grid: source, section, offence, sanction, implication, responsible party. |
| E16 | Customer | Natural-person and legal-person customers with KYC tier, identifiers (BVN/NIN/TIN/CAC), beneficial ownership, risk score. |
| E17 | Transaction | Customer transactions ingested for AML monitoring. |
| E18 | Alert | An AML, sanctions or screening alert. |
| E19 | Case | An MLRO / DPO / Ethics case bundling alerts, investigation, decision, evidence. |
| E20 | STR / CTR / CDR | A reportable filing to NFIU. |
| E21 | Breach | An incident / breach record (cyber, data, conduct, financial-crime, operational). |
| E22 | Vendor | A third-party / service provider record. |
| E23 | Training | A training module and completion record. |
| E24 | User / Role | User accounts, roles, role assignments (RBAC). |
| E25 | EvidenceItem | A signed file, screenshot, export, attachment with hash. |
| E26 | AuditEvent | The immutable audit log entry. |
| E27 | DSR | A data-subject rights ticket. |
| E28 | RoPA | A Record of Processing Activity. |
| E29 | DPIA | A Data Protection Impact Assessment. |
| E30 | RPT | A related-party transaction. |
| E31 | Whistle | A whistleblower report. |
| E32 | GiftRecord | A gift / entertainment / hospitality entry. |
| E33 | InsiderListEntry | A capital-market insider list entry. |
| E34 | DormantAccountRecord | A dormant-account classification with reactivation history. |
| E35 | DishonouredChequeRecord | An offence-of-dud-cheques entry. |
| E36 | ConsumerComplaint | A logged complaint with category, channel, SLA. |

### 11.2 Standard Attributes of a Regulatory Instrument (the 17 Drafts Fields)

| Field | Source Definition (per Drafts Definitions sheet) |
|---|---|
| Compliance Obligation Source | The specific law, regulation, guideline, framework, circular, or policy that imposes compliance requirements on the bank. |
| Objectives / Description | Brief summary outlining the purpose and main requirements. |
| Date of Issue | Official date the obligation was published. |
| Date of Commencement | Effective date when the obligation came into force. |
| Regulatory / Enforcement Body / Industry Body | Name of the agency, regulator, or industry association issuing or enforcing the obligation. |
| Type of Regulatory Item | Classification by nature/format (Act, Circular, Guideline, Framework, Regulation, Rulebook, Directive). |
| Nature of Compliance Item | Core / Topical or Pertinent / Secondary / Others. |
| Area of Focus | The specific compliance theme or operational domain affected. |
| Sanctions | Penalties, fines, or enforcement actions for non-compliance; include section references; if not specified, mark "Not Specified". |
| Status | Current / Outdated. (System also supports Exposure Draft.) |
| Comment on Status | Explanation for the status assigned. |
| Link of Document | URL or reference to the official source. |
| Risk Rating | High / Medium / Low within commercial bank context. |
| Risk Rating Explanation | Justification for the risk level. |
| Commercial Bank Relevance | Clear indication of how the obligation affects bank activities. |
| Commercial Bank Compliance Context | How the bank is expected to comply. |
| Applicability to Commercial Banks | Yes / No / Partially (with explanation if needed). |

### 11.3 Retention and Evidence

| Class | Retention | Source |
|---|---|---|
| AML records (KYC, transactions, STRs) | Minimum 5 years post relationship end | CBN AML/CFT/CPF Regulation 2022, s. 7 |
| Tax records | Minimum 6 years | FIRS Act |
| Customer personal data | As required by purpose under NDPA; not beyond | NDPA 2023 |
| Board records (minutes, RPTs) | Permanent (or per Companies Act minimum) | CAMA 2020 |
| Capital market disclosures | At least 6 years | ISA 2025; SEC Rules |
| Audit trail / Evidence Vault | Minimum 5 years; longer where source obligation requires | Multiple |
| Whistleblower reports | Minimum 5 years; with sensitivity controls | CBN Whistleblowing Guidelines |
| Sanctions screening records | Minimum 5 years | CBN Targeted Financial Sanctions Regulation 2022 |

### 11.4 Reference Data

The platform shall maintain the following reference data as configurable look-ups, seeded from the canonical Drafts:

- Regulators (initial seed = 43 from the Drafts Regulators sheet).
- Instrument types (initial seed = 13 from the Drafts Regulatory Item Types sheet).
- Areas of focus (initial seed = 29 from the Drafts Area of Focus sheet).
- Nature of compliance item (Core / Topical or Pertinent / Secondary / Others — counts in the Drafts: 215 / 98 / 37 / 2 respectively).
- Statuses (Current 342, Exposure Draft 4, Outdated 4 in the Drafts).
- Risk Ratings (High 215, Medium 117, Low 14 in the Drafts).
- CRMP themes (12: AML/CFT/CPF, Account Management, Anti-Bribery & Corruption, Cash Management, Consumer Protection, Corporate Governance, Cybersecurity, Data Protection, Financial Reporting, ESG, People & Conduct Risk, Capital Market).
- Sanction types (Administrative, Civil, Criminal, Licence-related).
- Currencies (NGN primary).

---

## 12. Integration Requirements

### 12.1 Internal Bank Systems

| System | Direction | Purpose |
|---|---|---|
| Core Banking (Finacle / T24 / Flexcube / BaNCS / Temenos) | Bi-directional | Customer onboarding, transactions, balances, dormant flag, freezing orders |
| Card Switch (Interswitch / Up-link to NIBSS) | Inbound | Transaction streams for AML monitoring |
| Internet / Mobile Banking | Inbound | Transaction streams; consent capture |
| AML Engine (Actimize / Oracle FCCM / SAS) | Bi-directional | Alert ingestion; rule synchronisation |
| Sanctions Vendor (Dow Jones / Refinitiv / Accuity / LexisNexis) | Inbound | List refresh |
| HRIS | Inbound | Joiner / mover / leaver; training assignment |
| Active Directory / Azure AD / Okta | Inbound | SSO, MFA, group membership |
| GL | Inbound | Financial reconciliation for tax returns |
| Treasury Management System | Inbound | FX positions; treasury exposures; trading-book disclosures |
| Customer Experience System | Inbound | Complaints (where complaints are first logged in CX) |
| Tax Engine | Bi-directional | VAT, WHT, EMTL, CIT computations |
| Email / Collaboration | Outbound | Notifications, attestations, board pack distribution |
| Document Management | Bi-directional | Policy storage; evidence storage |
| BCP / DR Orchestration | Bi-directional | Resilience-test evidence |

### 12.2 External Regulator and Industry Systems

| System | Direction | Purpose |
|---|---|---|
| NIBSS BVN Service | Outbound | BVN validation |
| NIBSS Industry Watch-list | Inbound | Watch-list refresh |
| NIBSS Industry Customer Account Database (ICAD) | Outbound | Customer cross-bank profile |
| NIMC NIN Verification | Outbound | NIN validation |
| CAC Search / PSC | Outbound | Corporate look-up; PSC submission |
| FIRS TIN | Outbound | TIN validation |
| FIRS TaxPro Max | Outbound | Tax-return submission |
| NIS Passport | Outbound | Passport validation |
| FRSC Driver's Licence | Outbound | Driver's licence validation |
| INEC PVC | Outbound | Voter card validation |
| NFIU goAML | Outbound | STR / CTR XML upload |
| CBN eFASS / FinA / RBS | Outbound | Regulatory returns |
| NDIC Returns Portal | Outbound | Premium-assessment returns |
| SEC e-Portal | Outbound | Capital-market returns |
| PenCom RBS Portal | Outbound | Pension returns |
| NDPC Reporting Portal | Outbound | Breach notifications; DSR aggregate stats |
| SCUML | Outbound | DNFBP-related reporting (where applicable) |
| FATCA IDES (IRS) | Outbound | FATCA reports |
| OECD CRS (via FIRS) | Outbound | CRS reports |
| SWIFT Alliance | Bi-directional | Cross-border payment screening |
| NIBSS NIP / RTGS | Bi-directional | Local-payment screening |

### 12.3 Integration Patterns

- REST + JSON as default for synchronous APIs; mTLS or OAuth 2.0 + signed JWT.
- AMQP or Kafka for asynchronous event streams (transactions, HR events).
- SFTP for batch file exchange where regulator only supports it.
- XML schemas for regulator-defined formats (goAML, FATCA, CRS, eFASS where prescribed).
- Idempotent producers; replayable consumers; dead-letter queues.

---

## 13. Reporting and Analytics Requirements

### 13.1 Operational Reports

- Compliance Universe Index (full export in the 17-field schema; reproduces and extends the Drafts Compliance Universe).
- CRMP per-theme register export (per the 17-column CRMP schema).
- Compliance Monitoring Plan status report (per the 12-column Monitoring schema).
- Returns and Remittance Register report (per the Drafts schema, with status overlay).
- Sanctions & Penalties Knowledge Base export.
- Open obligations / gaps report.
- Overdue controls report.
- Overdue returns report.
- Open AML alerts report; alert-aging report.
- Sanctions hits report by list.
- Complaints SLA report.
- Training completion report.
- Whistleblowing case status report.

### 13.2 Management Reports

- Monthly compliance dashboard pack (CCO).
- Monthly FCC pack (MLRO).
- Monthly DPO pack.
- Quarterly compliance report to ExCo.
- Top-10 risks report.
- Lessons-learned report (post-breach).

### 13.3 Board Reports

- Quarterly Board Risk Committee pack.
- Quarterly Board Audit Committee pack.
- Annual Board Compliance Report.
- Annual NSBP report to CBN (M26).
- Annual NDPC compliance report.
- Annual AML / CFT / CPF compliance report to CBN per s. 15(2).

### 13.4 Regulator Reports

All returns enumerated in the Drafts Returns Register, including but not limited to:

- Monthly AML compliance status report to Board (CBN AML/CFT/CPF Reg 2022 s. 9(4)).
- Annual AML / CFT / CPF compliance report to CBN (s. 15(2)).
- STR to NFIU (goAML XML).
- CTR to NFIU (goAML XML).
- CDR to NFIU.
- Monthly consumer-complaint return to CBN.
- Cyber-incident notifications to CBN per the Risk-Based Cybersecurity Framework.
- NDPC 72-hour breach notification.
- NDPC annual compliance return.
- FATCA annual return.
- CRS annual return.
- SEC AML / CFT (CMO) compliance report.
- FIRS monthly VAT / WHT / EMTL.
- PenCom monthly remittance and quarterly compliance report.
- NDIC differential premium return.
- NSBP annual report to CBN.
- NCCC annual emissions / decarbonisation disclosure per Climate Change Act 2021.
- FRC Sustainability Disclosure return.
- NGX continuous-disclosure filings.
- FMDQ post-trade obligations.

### 13.5 Analytics

The platform shall reproduce, in live dashboards, every analytic visible in the Drafts Compliance Risk Profile sheet — total obligations (352 today), regulator count (43), high-risk items (215), areas of focus (29), breakdown by Nature (Core 215, Topical/Pertinent 98, Secondary 37, Others 2), by Item Type, by Regulator and by Area of Focus — and shall extend with per-CRMP heat-maps, monitoring status, returns status, sanctions exposure and incident trends.

---

## 14. Roles and Permissions Model

### 14.1 Role Catalog (Indicative)

| Role | Description |
|---|---|
| Super Administrator | Platform configuration; user management; reference-data administration. |
| Chief Compliance Officer (CCO) | Read-all; approve policies; approve returns; sign off Board pack; gatekeeper for fit-and-proper. |
| MLRO | AML/CFT/CPF case management; STR/CTR submission; sanctions oversight. |
| Data Protection Officer (DPO) | NDPA workflow; DSR; breach; DPIA. |
| Company Secretary / Head Governance | CG CRMP; Board pack input; fit-and-proper; RPT. |
| Head Consumer Protection | Complaints; consumer-protection CRMP; redress. |
| Head Conduct & Ethics | ABAC; whistleblowing; gifts register; conduct. |
| Head Sustainability & ESG | ESG CRMP; NSBP report; sustainability disclosure. |
| Head Treasury Compliance | Capital Market CRMP; insider list; trading-window. |
| Head Regulatory Compliance | Regulatory library; returns; CBN/NDIC/SEC liaison. |
| Head Internal Control | RCSA; control library. |
| Chief Internal Auditor | Read-only across all modules. |
| CISO | Cyber CRMP; cyber-incident; security posture. |
| LOB Compliance Officer | Operational compliance for own LOB. |
| Branch Compliance Officer | KYC; cash management; branch monitoring activities. |
| Reviewer | Maker / checker reviewer role across workflows. |
| Approver | Approval workflows. |
| Read-Only User | Read-only across permitted modules. |
| Regulator Portal User | Read-only (phase 2). |

### 14.2 Permission Principles

- Role-based access (RBAC) with attribute overrides (LOB, region).
- Least privilege.
- Separation of duties: maker, checker, approver distinct individuals where the matrix requires it.
- Quarterly access recertification; expiry on stale accounts.
- Just-in-time elevation for privileged operations; logged.
- All viewing of customer PII is logged.

### 14.3 Permission Matrix (Indicative — Sample Functions)

| Function | CCO | MLRO | DPO | LOB Compl. | Branch Compl. | Co. Sec. | CISO | Audit | Super Admin |
|---|---|---|---|---|---|---|---|---|---|
| Read Compliance Universe | RW | R | R | R | R | R | R | R | RW |
| Add / approve obligation | A | — | — | R | — | — | — | R | RW |
| Approve policy | A | — | — | R | — | R | R | R | — |
| Submit STR / CTR | R | A | — | — | R | — | — | R | — |
| Maintain RoPA | R | R | A | R | — | — | R | R | — |
| Approve return | A | A (FCC) | A (NDPC) | R | — | R (CG) | R | R | — |
| Configure RBAC | — | — | — | — | — | — | — | R | A |
| Approve fit-and-proper | A | — | — | — | — | A | — | R | — |
| Manage Sanctions KB | A | R | — | R | — | — | — | R | RW |
| View customer PII | R | R | R | R | R | — | — | R | — |
| Configure CRMP theme | A | R (AML) | R (DP) | R | — | R (CG) | R (Cyber) | R | RW |

Legend: R = Read; RW = Read/Write; A = Approve; — = No access.

---

## 15. Assumptions, Dependencies and Constraints

### 15.1 Assumptions

- The bank's core banking platform exposes documented APIs for customer, transaction and freezing-order operations.
- NIBSS BVN, NIMC NIN, CAC, FIRS TIN and NIS connectivity is available or can be procured.
- NFIU goAML credentials and the bank's reporting officer designation are available.
- The bank's existing AML engine can emit alerts to Atheris (REST or message bus).
- The sanctions-list vendor exposes a refresh API.
- Hosting is agreed in a CBN-approved Nigerian data centre or hyperscaler region.
- The bank operates SSO (Active Directory / Azure AD / Okta).
- The bank has appointed a registered DPO with NDPC.
- The bank has board-approved AML/CFT/CPF policies; Atheris re-hosts them under M02 in their current form on Day 1.
- [ASSUMPTION] Insurance subsidiary compliance (NAICOM) is out of scope unless explicitly added later.

### 15.2 Dependencies

- M07 Sanctions depends on the list-vendor SLA for list refresh frequency.
- M09 STR submission depends on goAML availability and validity of the bank's submission credentials.
- M10 Returns depends on the regulator's portal availability (eFASS, FinA, TaxPro Max, etc.).
- M12 Data Protection depends on NDPC reporting-portal availability and final NDPC implementation directive.
- M25 Corporate Governance depends on CBN no-objection portal/process for senior appointments.
- M26 ESG depends on NCCC reporting structure being operational.
- All real-time KYC depends on NIBSS BVN / NIMC NIN service availability.

### 15.3 Constraints

- Data residency: production data must reside in Nigeria; non-production replication is constrained by NDPA cross-border rules.
- Tipping-off: STR contents must not be disclosed to the subject; access is tightly controlled.
- Regulator file formats are externally controlled (goAML, FATCA, CRS, eFASS) and may change without notice.
- Some regulator portals only support manual upload; full automation depends on regulator API availability.
- Sanctions list updates are subject to vendor licence and refresh cadence.
- Some Drafts entries are marked as Exposure Drafts and may shift before final issue (e.g., Revised Consumer Protection Regulations 2.0; Revised Framework for Differentiated Banking Models; Baseline Standards for Automated AML Solutions).
- [NEEDS DECISION] Final approach to the regulator-portal (M18 §FR18.9) — whether to expose, to which regulators, on which dataset slices — requires sign-off from the CCO, CISO, DPO and Board Risk Committee.
- [NEEDS DECISION] Whether the bank will adopt a single hosting region in Nigeria or active-active across two regions (NFR12) is a CIO-level decision pending data-centre selection.
- [NEEDS DECISION] Authoritative source of the local PEP list (M07 §FR7.1) — third-party curated, government-issued, or in-house — requires CCO and MLRO decision.

---

## 16. Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Regulator releases new instrument the platform does not auto-ingest | M | H | Manual upload backstop; weekly compliance team sweep; regulator-feed reliability SLA |
| R2 | NIBSS BVN service unavailable during onboarding | M | M | Queue-and-retry pattern; degraded-mode Tier 2 onboarding allowed pending verification |
| R3 | False-positive rate on sanctions screening too high | H | M | Continuous tuning workbench; reviewer feedback loop; ML-assisted re-scoring (post Phase 2) |
| R4 | NDPC implementation directive changes mid-build | H | M | Configuration-over-code design; DPO change-board on every NDPC publication |
| R5 | goAML schema changes | M | H | Schema versioning in M09; pre-submission validation; regulator advisory subscription |
| R6 | Internal user resistance to migrating off spreadsheets | M | M | Phased rollout; mirror the Drafts terminology; training; super-user network |
| R7 | Cyber breach of the platform | L | H | NFRs in §9.4; ISO 27001; quarterly pen-test; SOC; CBN cyber-resilience self-assessment |
| R8 | Tipping-off control fails — STR subject becomes aware | L | H | Hard role-segregation; access logging; legal review of all sub-processors |
| R9 | Data localisation breached by hyperscaler region change | L | H | Contractual region-pinning; periodic verification; alerting on data egress |
| R10 | Regulatory penalty for late return | M | H | Returns auto-draft + scheduler + escalation matrix |
| R11 | Drafts content drifts from platform reference data | M | M | Quarterly diff between Drafts and platform; CCO sign-off |
| R12 | Mismatch between Sanctions Grid responsible-party allocation and current org chart | M | M | Periodic re-mapping with HR; surface stale assignments in dashboard |
| R13 | Board no-objection delays for senior appointments | L | M | M25 workflow with explicit CBN-touchpoint stages; status visibility |
| R14 | Exposure Draft superseded between platform load and go-live | M | L | Status field allows Exposure Draft state; auto-flag for re-load on final issue |

---

## 17. Acceptance Criteria (per Module — Consolidated)

The acceptance criteria below are summarised from §8; they are the minimum bar for module sign-off.

| Module | Key Acceptance Criteria |
|---|---|
| M01 Regulatory Library | AC1.1–AC1.6 |
| M02 Policy & Procedure | AC2.1–AC2.4 |
| M03 Obligations Register | AC3.1–AC3.3 |
| M04 RCSA / BRA | AC4.1–AC4.3 |
| M05 Controls Testing & Continuous Monitoring | AC5.1–AC5.3 |
| M06 KYC / CDD / EDD / ODD | AC6.1–AC6.4 |
| M07 Sanctions / PEP / Adverse Media | AC7.1–AC7.4 |
| M08 AML Transaction Monitoring | AC8.1–AC8.3 |
| M09 STR / CTR / CDR / SAR | AC9.1–AC9.3 |
| M10 Returns Automation | AC10.1–AC10.3 |
| M11 Consumer Protection & Complaints | AC11.1–AC11.3 |
| M12 Data Protection (NDPA) | AC12.1–AC12.3 |
| M13 Whistleblowing | AC13.1–AC13.2 |
| M14 Vendor / TPRM | AC14.1–AC14.3 |
| M15 Training & Attestation | AC15.1–AC15.2 |
| M16 Incident & Breach | AC16.1–AC16.2 |
| M17 Compliance Calendar | AC17.1–AC17.2 |
| M18 Dashboards & Board Pack | AC18.1–AC18.3 |
| M19 Audit Trail & Evidence | AC19.1–AC19.3 |
| M20 FATCA & CRS | AC20.1–AC20.2 |
| M21 Tax Cockpit | AC21.1–AC21.2 |
| M22 Conduct Surveillance | AC22.1–AC22.2 |
| M23 Open Banking | AC23.1–AC23.2 |
| M24 ABAC | AC24.1–AC24.3 |
| M25 Corporate Governance | AC25.1–AC25.4 |
| M26 ESG & Sustainable Banking | AC26.1–AC26.3 |
| M27 Capital Market | AC27.1–AC27.3 |
| M28 Sanctions & Penalties KB | AC28.1–AC28.4 |
| M29 Account Management | AC29.1–AC29.3 |
| M30 Cash Management | AC30.1–AC30.3 |

System-level acceptance: all NFRs (§9) measured and met for two consecutive monthly observation windows before formal go-live.

---

## 18. Glossary

| Term | Definition |
|---|---|
| ABAC | Anti-Bribery & Corruption. |
| AML/CFT/CPF | Anti-Money Laundering / Combating the Financing of Terrorism / Countering Proliferation Financing. |
| BVN | Bank Verification Number (CBN/NIBSS-issued). |
| CBN | Central Bank of Nigeria. |
| CCMS | Consumer Complaints Management System (CBN). |
| CCO | Chief Compliance Officer. |
| CDD | Customer Due Diligence. |
| CDR | Currency Declaration Report. |
| CPF | Countering Proliferation Financing. |
| CRMP | Compliance Risk Management Plan. |
| CRR | Customer Risk Rating. |
| CRS | Common Reporting Standard (OECD). |
| CTR | Currency Transaction Report. |
| DPO | Data Protection Officer. |
| DSR | Data Subject Rights. |
| EDD | Enhanced Due Diligence. |
| EFCC | Economic and Financial Crimes Commission. |
| ESG | Environmental, Social and Governance. |
| FATCA | Foreign Account Tax Compliance Act (US). |
| FCCPA | Federal Competition and Consumer Protection Act 2018. |
| FRC | Financial Reporting Council of Nigeria. |
| FX | Foreign Exchange. |
| GAID | General Application and Implementation Directive (NDPC, 2025). |
| goAML | NFIU's reporting system for AML data. |
| ICPC | Independent Corrupt Practices Commission. |
| ISA | Investments and Securities Act. |
| KCI / KRI | Key Control Indicator / Key Risk Indicator. |
| LOB | Line of Business. |
| MLRO | Money Laundering Reporting Officer. |
| NSBP | Nigerian Sustainable Banking Principles. |
| NCCC | National Council on Climate Change. |
| NDIC | Nigeria Deposit Insurance Corporation. |
| NDPA | Nigeria Data Protection Act 2023. |
| NDPR | Nigeria Data Protection Regulation 2019. |
| NDPC | Nigeria Data Protection Commission. |
| NFIU | Nigerian Financial Intelligence Unit. |
| NGX | Nigerian Exchange Limited. |
| NIBSS | Nigeria Inter-Bank Settlement System. |
| NIMC | National Identity Management Commission. |
| NIN | National Identification Number. |
| NSITF | Nigeria Social Insurance Trust Fund. |
| OBL | Obligation. |
| ODD | Ongoing Due Diligence. |
| OFAC | US Office of Foreign Assets Control. |
| PEP | Politically Exposed Person. |
| PenCom | National Pension Commission. |
| PSC | Persons with Significant Control. |
| RACI | Responsible, Accountable, Consulted, Informed. |
| RBS | Risk-Based Supervision. |
| RCSA | Risk and Control Self-Assessment. |
| RoPA | Records of Processing Activity. |
| RPT | Related Party Transaction. |
| SCUML | Special Control Unit Against Money Laundering. |
| STR / SAR | Suspicious Transaction Report / Suspicious Activity Report. |
| TFS | Targeted Financial Sanctions. |
| TIN | Tax Identification Number. |
| UBO | Ultimate Beneficial Owner. |

---

## 19. Appendices

### Appendix A — Source Sheet Inventory (Canonical Drafts)

| Drafts Sheet | Description | Rows / Records | Primary Module(s) |
|---|---|---|---|
| Homepage | Product banner, version | n/a | M01 (metadata) |
| User Guide | Five-phase compliance process narrative | Narrative | §6 (Business Process Overview) |
| Dashboard | Intended live dashboard | Empty (to be built) | M18 |
| Definitions | Glossary of the 17 standard data fields + CRMP category definitions | 77 rows | §11.2 + Glossary §18 |
| Sheet4 | Nature pivot (Core 215 / Topical 98 / Secondary 37 / Others 2) | 5 rows | M18 |
| Compliance Universe | Master register of all 352 obligations across 18 columns | 352 obligations | M01 |
| Conduct risk | People & Conduct Risk CRMP register | 127 rows | M22 |
| Corporate Governance | Corporate Governance CRMP register | Multi-row | M25 |
| Data protection | Data Protection CRMP register | 104 rows | M12 |
| Financial reporting | Financial Reporting / tax CRMP register | 27 rows | M21 |
| Capital Market | Capital Market CRMP register | 52 rows | M27 |
| Area of Focus | Reference: 28 areas + Grand Total | 29 rows | Reference data |
| Compliance Risk profile | Analytics dashboard: totals, item type, regulator, area, risk | 169 rows | M18 |
| CRMP | Master CRMP across themes | 1,227 rows | M03 + M04 + M05 (plus M24–M30) |
| ESG | ESG CRMP register | 53 rows | M26 |
| Cybersecurity | Cybersecurity CRMP register | 27 rows | NFRs + M16 |
| Consumer Protection | Consumer Protection CRMP register | 87 rows | M11 |
| ABAC | Anti-Bribery & Corruption CRMP register | 13 rows | M24 |
| AMLCFT | AML/CFT/CPF CRMP register (extensive) | 223 rows | M06, M07, M08, M09 |
| Actmgt | Account Management CRMP register | 61 rows | M29 |
| Cash Mgt | Cash Management CRMP register | 20 rows | M30 |
| Compliance Monitoring Plan | Operational monitoring activity register | 236 rows | M05 |
| Returns and Remittance | Returns register | 187 rows | M10 |
| Sanctions and Penalties | Sanctions grid | 417 rows | M28 |
| Regulatory Item Types | Reference: 13 types | 13 entries | Reference data |
| Regulators | Reference: 43 issuing bodies | 43 entries | Reference data |
| Status | Reference: Current / Outdated / Exposure Draft | 4 entries | Reference data |
| Risk Rating | Reference: H / M / L with counts | 7 rows | Reference data |
| Sheet1 | Generation scratch / draft text | Iterative drafts | Not in scope (working memo) |

### Appendix B — The Twelve CRMP Categories (Per the Drafts Definitions Sheet)

| # | Theme | Drafts Definition | Primary Module |
|---|---|---|---|
| 1 | AML/CFT/CPF | The bank's responsibilities in preventing money laundering, terrorist financing, and proliferation financing, in line with applicable laws and regulatory expectations. | M06, M07, M08, M09 |
| 2 | Account Management | Proper handling of customer accounts throughout their lifecycle, ensuring compliance with identification, documentation and regulatory requirements. | M29 |
| 3 | Anti-Bribery & Corruption | Exposure to bribery, facilitation payments, and other corrupt practices across business relationships, employee conduct, and third-party dealings. | M24 |
| 4 | Cash Management | Efficient and compliant handling of cash transactions, including deposits, withdrawals, and ATM operations across the bank's network. | M30 |
| 5 | Consumer Protection | Fair treatment of customers, transparency, responsible product offerings, and effective management of complaints and disputes. | M11 |
| 6 | Corporate Governance | Governance framework, decision-making structures, and ethical standards that guide the bank's operations and ensure regulatory alignment. | M25 |
| 7 | Cybersecurity | Protection of information systems, digital assets, and customer data against cyber threats, in accordance with regulatory standards. | NFRs §9.4 + M16 |
| 8 | Data Protection | Compliance with data privacy laws regarding the collection, processing, storage and sharing of personal information, in line with legal requirements. | M12 |
| 9 | Financial Reporting | Preparation and disclosure of accurate, timely, and complete financial and regulatory reports in compliance with applicable standards. | M21 |
| 10 | ESG | Integrating environmental responsibility, social impact, and ethical governance into the bank's strategy, operations, and disclosures. | M26 |
| 11 | People & Conduct Risk | Staff behaviour, ethical standards, and cultural values that may affect the bank's integrity, reputation, and compliance posture. | M22 |
| 12 | Capital Market | Compliance with regulatory obligations related to securities trading, investment activities and participation in capital market transactions. | M27 |

### Appendix C — Traceability Matrix

The traceability matrix demonstrates that every feature, sub-feature, workflow, capability, sheet, column, reference list and data element in the canonical Drafts is allocated to a module and a feature ID in this BRD. The matrix is grouped first by Drafts artefact, then by feature.

#### C.1 Drafts → BRD Module / Feature Trace (by sheet)

| Drafts Artefact | Captured As | BRD Reference |
|---|---|---|
| Drafts Homepage — product header, "Compliance Universe, Risk Profile, and Risk Management Plans" framing | Product overview | §2 Executive Summary; §6.1 Five-Phase Process |
| Drafts User Guide — "Five main areas of activity" | Phases 1–5 of the compliance process | §6.1 |
| Drafts User Guide — "Developing a Regulatory Risk Universe and Compliance Risk Profile" | Phase 1 | §6.1 Phase 1; M01; M18 |
| Drafts User Guide — "Developing Compliance Risk Management Plans" | Phase 2 | §6.1 Phase 2; M03; M04; M24–M30; M11; M12; M22 |
| Drafts User Guide — "Developing Compliance Monitoring Plans" | Phase 3 | §6.1 Phase 3; M05; M17 |
| Drafts User Guide — implied reporting / returns | Phase 4 | §6.1 Phase 4; M10 |
| Drafts User Guide — implied continuous improvement / dashboards | Phase 5 | §6.1 Phase 5; M18; M16 |
| Drafts Dashboard sheet (blank, to be built) | Live executive dashboard | M18; §13.5 |
| Drafts Definitions sheet — 17 standard data fields | Standard attributes of a regulatory instrument | §11.2; FR1.2 |
| Drafts Definitions — "CRMP Categories" (12 themes with definitions) | Twelve canonical CRMP themes | §7.1; Appendix B |
| Drafts Sheet4 — Nature pivot (Core/Topical/Secondary/Others) | Nature-of-Item analytic | M18 FR18.2; Reference taxonomy §11.4 |
| Drafts Compliance Universe (18 columns, 352 obligations) | The system of record for every regulatory obligation | M01 — all FRs; §11.2 (17-field schema); §11.4 (reference data) |
| Drafts Compliance Universe — "Compliance Obligation Source" column | Title / source field | FR1.1; FR1.2 |
| Drafts Compliance Universe — "Objectives/Description" column | Summary / Objectives field | FR1.1; FR1.2 |
| Drafts Compliance Universe — "Date of Issue" column | Date of Issue field | FR1.1 |
| Drafts Compliance Universe — "Date of Commencement" column | Date of Commencement field | FR1.1 |
| Drafts Compliance Universe — "Regulatory/Enforcement Body/Industry Body" column | Issuing Regulator field; Regulators reference data | FR1.1; FR1.11 |
| Drafts Compliance Universe — "Type of Regulatory Item" column | Instrument Type; 13-entry reference list | FR1.1; FR1.11 |
| Drafts Compliance Universe — "Nature of Compliance Item" column (Core/Topical/Secondary/Others) | Nature-of-Item field; reference list | FR1.1; FR1.11 |
| Drafts Compliance Universe — "Area of Focus" column | Area of Focus field; 29-entry reference list | FR1.1; FR1.11 |
| Drafts Compliance Universe — "Sanctions" column | Sanctions sub-entity (E15); linkage to M28 | FR1.13; M28 |
| Drafts Compliance Universe — "Status" column | Instrument Status; Current/Outdated/Exposure Draft | FR1.1; FR1.11 |
| Drafts Compliance Universe — "Comment on Status" column | Status comment field | FR1.1 |
| Drafts Compliance Universe — "Link of Document" column | Link / URL field | FR1.1 |
| Drafts Compliance Universe — "Risk Rating" column | Risk Rating field; H/M/L reference list | FR1.3 |
| Drafts Compliance Universe — "Risk Rating Explanation" column | Risk Rating Explanation field | FR1.3 |
| Drafts Compliance Universe — "Commercial Bank Relevance" column | Commercial Bank Relevance field | FR1.1; FR1.2 |
| Drafts Compliance Universe — "Commercial Bank Compliance Context" column | Bank Compliance Context field | FR1.1; FR1.2 |
| Drafts Compliance Universe — "Applicability to Commercial Banks" column (Yes/No/Partially) | Applicability field | FR1.1; FR1.2 |
| Drafts Compliance Risk Profile sheet — total obligations (352) | Live KPI on dashboard | FR18.1 |
| Drafts Compliance Risk Profile — number of regulatory bodies (43) | Live KPI on dashboard | FR18.1 |
| Drafts Compliance Risk Profile — number of high-risk items (215) | Live KPI on dashboard | FR18.1 |
| Drafts Compliance Risk Profile — areas of focus (29) | Live KPI on dashboard | FR18.1 |
| Drafts Compliance Risk Profile — Nature pivot | Breakdown panel | FR18.2 |
| Drafts Compliance Risk Profile — Item-type pivot | Breakdown panel | FR18.2 |
| Drafts Compliance Risk Profile — Regulator pivot | Breakdown panel | FR18.2 |
| Drafts Compliance Risk Profile — Area-of-focus pivot | Breakdown panel | FR18.2 |
| Drafts Compliance Risk Profile — Risk Rating pivot (H 215 / M 117 / L 14) | Breakdown panel | FR18.2 |
| Drafts CRMP sheet — Theme column | CRMP theme on each row | FR3.2; FR1.12 |
| Drafts CRMP sheet — S/N column | Sequence number | E10 |
| Drafts CRMP sheet — Acts / Compliance Obligation Source | Source instrument link | M03; FR3.2 |
| Drafts CRMP sheet — Section column | Clause/section reference | FR3.2 |
| Drafts CRMP sheet — Title column | Obligation title | FR3.2 |
| Drafts CRMP sheet — Description column | Description (with section text) | FR3.2 |
| Drafts CRMP sheet — Translate to Clear and Plain Language column | Plain-language obligation | FR3.2 |
| Drafts CRMP sheet — Risk Description column | Risk Description field | FR3.2; FR4.1 |
| Drafts CRMP sheet — Inherent Likelihood column | Inherent Likelihood | FR4.2 |
| Drafts CRMP sheet — Inherent Impact column | Inherent Impact | FR4.2 |
| Drafts CRMP sheet — Responsibility (Inherent) column | Responsibility (R-A-C-I) | FR3.2 |
| Drafts CRMP sheet — Control column | Control description; linkage to M05 | FR5.1; M02 (policy linkage) |
| Drafts CRMP sheet — Residual Likelihood column | Residual Likelihood | FR4.2 |
| Drafts CRMP sheet — Residual Impact column | Residual Impact | FR4.2 |
| Drafts CRMP sheet — Additional Control column | Additional Control (compensating/preventive uplift) | FR5.1 |
| Drafts CRMP sheet — Due Date column | Action plan due date | FR4.5; M17 |
| Drafts CRMP sheet — Final Responsibility column | RACI accountable | FR3.2 |
| Drafts AMLCFT sheet — every row from AML/CFT/CPF Regulations 2022 (designated predicate offences, TFS, institutional framework, formal board approval, comprehensive programme, EDD, ongoing monitoring, record-keeping, CCO designation, etc.) | Operationalised across KYC, sanctions, AML, NFIU reporting | M06; M07; M08; M09; M10 |
| Drafts AMLCFT sheet — PEP Guidance Note rows | PEP screening and EDD | FR7.1; FR6.6 |
| Drafts AMLCFT sheet — Targeted Financial Sanctions Regulation 2022 rows | TFS handling; 24-hour reporting | FR7.5; AC7.4 |
| Drafts AMLCFT sheet — BVN Regulatory Framework rows | BVN verification at onboarding | FR6.3 |
| Drafts AMLCFT sheet — Three-Tiered KYC rows | Tier 1/2/3 onboarding limits | FR6.2 |
| Drafts AMLCFT sheet — NIN Mandatory Use rows | NIN verification | FR6.3 |
| Drafts AMLCFT sheet — INEC PVC acceptance rows | PVC acceptance | FR6.3 |
| Drafts AMLCFT sheet — MRCTD / Refugee ID rows | Refugee onboarding | FR6.1 |
| Drafts AMLCFT sheet — Uniform Account Opening Forms rows | Standard onboarding forms | FR6.11 |
| Drafts AMLCFT sheet — Authorised Signatories Verification Portal rows | Signatory verification | FR6.12 |
| Drafts AMLCFT sheet — Tier 1 Wallets / Mobile Money rows | Tiered digital onboarding | FR6.9 |
| Drafts AMLCFT sheet — Instant Payment additional functionalities rows | Real-time payment screening | FR7.3 |
| Drafts Corporate Governance sheet — CBN CG Guidelines rows (Board Structure, Roles, Officers, Independent Advice, Committees) | Corporate Governance CRMP | M25 — all FRs |
| Drafts Corporate Governance sheet — Status of CCO rows | CCO appointment workflow | FR25.13 |
| Drafts Corporate Governance sheet — Whistleblowing Guidelines rows | Whistleblowing | M13 |
| Drafts Corporate Governance sheet — Fiscal Responsibility Act rows | Fiscal Responsibility compliance | FR25.10 |
| Drafts Corporate Governance sheet — CAMA 2020 rows | Company secretarial / RPT / AGM | FR25.5; FR25.12 |
| Drafts Corporate Governance sheet — BOFIA 2020 rows | Banking-act governance | M25 |
| Drafts Corporate Governance sheet — SEC CG Guidelines rows | Listed-entity governance | FR25.12; M27 |
| Drafts Corporate Governance sheet — Nigerian Code of Corporate Governance 2018 rows | Code-of-Code compliance | M25 |
| Drafts Corporate Governance sheet — Approved Persons / Fit-and-Proper rows | Fit-and-proper workflow | FR25.2 |
| Drafts Corporate Governance sheet — Promotion-of-Top-Officials clearance rows | Prior clearance workflow | FR25.9 |
| Drafts Corporate Governance sheet — Shared Services Guidelines rows | Outsourcing governance | FR25.14; M14 |
| Drafts Corporate Governance sheet — Prudential Guidelines 2019 rows | Prudential governance | M25; (consumed by Risk modules outside scope) |
| Drafts Corporate Governance sheet — Trade Marks Act and Evidence Act rows | Legal / records | M19; FR25.4 |
| Drafts Data Protection sheet — NDPR 2019 rows (Governing Principles, lawful basis, accountability) | Data Protection CRMP | M12 |
| Drafts Data Protection sheet — NDPA 2023 rows | DSR, breach, RoPA, DPIA | M12 — all FRs |
| Drafts Data Protection sheet — NDPA GAID 2025 rows | Implementation directive | FR12.10 |
| Drafts Financial Reporting sheet — FRC Act rows | FRC compliance | M25; M21 |
| Drafts Financial Reporting sheet — SEC Guidance on ISA 2007 §60–63 rows | Capital-market reporting | M27 |
| Drafts Capital Market sheet — ISA 2025 rows | Capital Market CRMP | M27 — all FRs |
| Drafts Capital Market sheet — SEC Rules & Regulations 2013 rows | SEC continuous compliance | M27 |
| Drafts Capital Market sheet — NGX Rulebook rows | NGX compliance | M27 |
| Drafts Capital Market sheet — FMDQ rows | FMDQ compliance | FR27.8 |
| Drafts ESG sheet — Nigerian Sustainable Banking Principles rows | NSBP compliance | M26 |
| Drafts ESG sheet — Climate Change Act 2021 rows | NCCC reporting; emissions | FR26.5 |
| Drafts ESG sheet — NSE Sustainable Disclosure Requirements rows | NSE disclosure | FR26.7 |
| Drafts ESG sheet — FRC Sustainability Disclosure Standards rows | Sustainability disclosure | FR26.6 |
| Drafts Cybersecurity sheet — Cybercrime Act 2015 rows | Cyber compliance | NFR24 |
| Drafts Cybersecurity sheet — CBN Risk-Based Cyber Framework rows | Cyber CRMP | NFR20, NFR30 |
| Drafts Consumer Protection sheet — Revised Consumer Protection Regulations 2.0 Exposure Draft rows | Consumer Protection CRMP | M11 |
| Drafts Consumer Protection sheet — CBN Consumer Protection Framework + Regulations | M11 | M11 |
| Drafts Consumer Protection sheet — CCMS deployment row | CCMS integration | FR11.5 |
| Drafts Consumer Protection sheet — Display of Corporate Names on Websites row | Corporate-identity disclosure | M11 (controls) |
| Drafts Consumer Protection sheet — FCCPA 2018 row | Cross-sector compliance | M11 |
| Drafts Consumer Protection sheet — Industry Dispute Resolution row | Dispute resolution | FR11.6 |
| Drafts Consumer Protection sheet — Fair Treatment, Business Ethics, Sales Promotion, Unfair Contract Terms, Lending Practices, Debt Recovery rows | Operational controls per CRMP | FR11.8–FR11.12 |
| Drafts ABAC sheet — EFCC Act 2004 rows | EFCC workflow; freezing-order WF-07 | M24 — FR24.6; WF-07 |
| Drafts ABAC sheet — Corrupt Practices Act 2000 rows | ICPC compliance | FR24.7 |
| Drafts ABAC sheet — Nigeria Criminal Code 1990 rows | Criminal-law backdrop | M24 |
| Drafts Conduct Risk sheet — Pension Reform Act 2014 rows | Pension enrolment, remittance, group life | FR22.6 |
| Drafts Conduct Risk sheet — National Minimum Wage Act 2019 rows | HR compliance | M22 (controls) |
| Drafts Conduct Risk sheet — Trade Dispute Act / Trade Union Act rows | Labour-law compliance | M22 |
| Drafts Conduct Risk sheet — Nigeria Labour Act rows | Labour compliance | M22 |
| Drafts Conduct Risk sheet — Compliance with Bank Employees Declaration of Assets rows | Declaration of assets | FR22.1 |
| Drafts Conduct Risk sheet — Blacklisting Guidelines rows | Blacklisting workflow | FR22.3 |
| Drafts Conduct Risk sheet — Discontinuation of Death Benefits Account rows | Account management interplay | M29 |
| Drafts Conduct Risk sheet — National Housing Fund 2004 rows | Statutory remittance | M21 |
| Drafts Conduct Risk sheet — Employee Compensation Act 2010 rows | NSITF remittance | M22 |
| Drafts Conduct Risk sheet — CIBN Act 2007 rows | Certification verification | FR22.5 |
| Drafts Conduct Risk sheet — Immigration Act rows | Foreign-staff compliance | M22 |
| Drafts Conduct Risk sheet — NYSC Act rows | NYSC compliance | M22 (controls) |
| Drafts Conduct Risk sheet — Discrimination Against PWD Act rows | PWD inclusion controls | FR22.8 |
| Drafts Conduct Risk sheet — De-marketing of Banks rows | De-marketing register | FR22.4 |
| Drafts Conduct Risk sheet — Competency Framework for Nigerian Banking rows | Competency tracking | FR22.5 |
| Drafts Conduct Risk sheet — Re: Need for CBN Prior Clearance of Promotions rows | Prior-clearance workflow | FR25.9 |
| Drafts Account Management (Actmgt) sheet — Dormant Accounts Guidelines rows | Dormant-account workflow | FR29.1 |
| Drafts Actmgt — Vulnerable Persons accounts rows | Vulnerable-persons handling | FR29.2 |
| Drafts Actmgt — NDIC Act rows | Differential premium / deposit insurance | M10 |
| Drafts Actmgt — Financial & Technical Assistance Guidelines rows | Operational controls | M14 |
| Drafts Actmgt — Differentiated Banking Models Framework rows | Account taxonomies | FR29.8 |
| Drafts Actmgt — Guide to Charges by Banks rows | Charges enforcement | FR29.5 |
| Drafts Actmgt — Interest Rate on Savings Deposit rows | Interest-rate compliance | FR29.6 |
| Drafts Actmgt — ATM Transaction Charges rows | ATM charges | FR29.7 |
| Drafts Actmgt — e-Dividend Mandate rows | e-Dividend workflow | FR29.3 |
| Drafts Actmgt — Dishonoured Cheques (Offences) Act rows | Dud-cheque workflow | FR29.4 |
| Drafts Actmgt — Need to Dissuade Issuance of Dud Cheques rows | Dud-cheque controls | FR29.4 |
| Drafts Cash Management sheet — Clean Note Policy v0.1 rows | Note-quality workflow | FR30.1 |
| Drafts Cash Mgt — Counterfeit Banknotes Penalty rows | Counterfeit workflow | FR30.2 |
| Drafts Cash Mgt — Inappropriate Cash Disbursement Penalty rows | Cash-disbursement controls | FR30.3 |
| Drafts Compliance Monitoring Plan — Theme column | Theme tagging on monitoring activity | FR5.1 |
| Drafts Monitoring Plan — ID column | Monitoring activity ID | E13 |
| Drafts Monitoring Plan — Regulatory Requirement column | Regulatory requirement linkage | FR5.1 |
| Drafts Monitoring Plan — Compliance Area column | Compliance area | FR5.1 |
| Drafts Monitoring Plan — Risk Level column | Risk level | FR5.1 |
| Drafts Monitoring Plan — Compliance Control column | Control linkage | FR5.1 |
| Drafts Monitoring Plan — Monitoring Activity column | Activity description | FR5.1 |
| Drafts Monitoring Plan — Frequency column | Frequency | FR5.1 |
| Drafts Monitoring Plan — Responsible Officer column | Responsible officer | FR5.1 |
| Drafts Monitoring Plan — Due Date column | Due date; calendar | FR5.7; M17 |
| Drafts Monitoring Plan — Status column | Status workflow | FR5.7 |
| Drafts Monitoring Plan — Control Effectiveness Measure column | Effectiveness metric | FR5.1 |
| Drafts Returns and Remittance — S/N column | Sequence | E14 |
| Drafts Returns — Acts column | Source instrument linkage | FR10.1 |
| Drafts Returns — Type of Return / Obligation column | Return type | FR10.1 |
| Drafts Returns — Legal Basis (Section) column | Legal basis | FR10.1 |
| Drafts Returns — Description column | Description | FR10.1 |
| Drafts Returns — Timeline / Frequency column | Schedule | FR10.2 |
| Drafts Returns — Responsible Unit column | RACI | FR10.4 |
| Drafts Returns — Monthly AML compliance status to Board (s. 9(4)) row | Specific return | FR10.10 |
| Drafts Returns — Annual AML/CFT/CPF compliance report to CBN (s. 15(2)) row | Specific return | FR10.10 |
| Drafts Sanctions & Penalties — S/N | Sequence | E15 |
| Drafts Sanctions — Compliance Obligation Source column | Source linkage | FR28.1 |
| Drafts Sanctions — Section column | Section reference | FR28.1 |
| Drafts Sanctions — Offence / Obligation column | Offence text | FR28.1 |
| Drafts Sanctions — Sanction or Penalty column | Penalty text | FR28.1 |
| Drafts Sanctions — Implication for Commercial Banks column | Implication text | FR28.1 |
| Drafts Sanctions — Responsible Party column | Responsible party | FR28.1; §14 RBAC |
| Drafts Regulators sheet — 43 issuing bodies | Regulator reference taxonomy | FR1.11; §11.4 |
| Drafts Regulatory Item Types — 13 types | Item-type reference taxonomy | FR1.11; §11.4 |
| Drafts Status — 4 statuses | Status reference taxonomy | FR1.11; §11.4 |
| Drafts Risk Rating — H/M/L pivot | Risk-rating reference + dashboard | FR1.3; FR18.2 |
| Drafts Area of Focus — 29 areas | Area-of-focus reference taxonomy | FR1.11; §11.4 |

#### C.2 BRD-v1.0 Modules Carried Through

Every module from BRD v1.0 is retained as-is or extended; the table below confirms continuity.

| BRD v1.0 Module | BRD v2.0 Module | Change vs v1.0 |
|---|---|---|
| M01 Regulatory Library & Horizon Scanning | M01 | Extended — now operationalises the full 352-line Drafts Compliance Universe (vs 36 obligations in v1.0 seed) |
| M02 Policy & Procedure Management | M02 | Extended — every CRMP control / additional control routed to a policy linkage; taxonomy expanded |
| M03 Obligations Register & Control Mapping | M03 | Extended — adopts the CRMP 17-column schema |
| M04 RCSA / BRA | M04 | Extended — supports the Drafts 3×3 H/M/L matrix in addition to 5×5 |
| M05 Controls Testing & Continuous Monitoring | M05 | Extended — operationalises the full Drafts Compliance Monitoring Plan with all 12 columns + Control Effectiveness Measure |
| M06 KYC & CDD | M06 | Extended — adds INEC PVC, MRCTD/refugee onboarding, Authorised Signatories portal, Tier 1 wallets per the Drafts |
| M07 Sanctions & PEP | M07 | Extended — adds TFS 24-hour reporting workflow |
| M08 AML Transaction Monitoring | M08 | Carried |
| M09 NFIU goAML | M09 | Carried |
| M10 Returns Automation | M10 | Extended — operationalises the full Returns Register from the Drafts |
| M11 Consumer Protection | M11 | Extended — operationalises Fair Treatment / Business Ethics / Sales Promotion / Unfair Contract Terms / Lending / Debt Recovery / IDR per the Drafts |
| M12 NDPA | M12 | Extended — adds GAID 2025 specifics |
| M13 Whistleblowing | M13 | Carried |
| M14 TPRM | M14 | Extended — Shared Services Guidelines incorporated |
| M15 Training & Attestation | M15 | Carried |
| M16 Incident & Breach | M16 | Carried |
| M17 Compliance Calendar | M17 | Extended — calendar feeds from CRMP, Monitoring Plan, Returns Register |
| M18 Dashboards | M18 | Extended — reproduces every Drafts Compliance Risk Profile KPI and pivot |
| M19 Audit Trail | M19 | Carried |
| M20 FATCA & CRS | M20 | Carried |
| M21 Tax Cockpit | M21 | Extended — operationalises Financial Reporting CRMP |
| M22 Conduct Surveillance | M22 | Extended — operationalises the People & Conduct Risk CRMP in full |
| M23 Open Banking | M23 | Carried |
| — (new) | M24 ABAC | New — operationalises the ABAC CRMP |
| — (new) | M25 Corporate Governance | New — operationalises the Corporate Governance CRMP |
| — (new) | M26 ESG & Sustainable Banking | New — operationalises the ESG CRMP |
| — (new) | M27 Capital Market | New — operationalises the Capital Market CRMP |
| — (new) | M28 Sanctions & Penalties KB | New — operationalises the Sanctions & Penalties grid (417 lines) |
| — (new) | M29 Account Management | New — operationalises the Account Management CRMP |
| — (new) | M30 Cash Management | New — operationalises the Cash Management CRMP |

#### C.3 Sample Obligation Trace (Worked Example)

The table below shows a worked traceability example from a Drafts row to its BRD-side artefacts. The same trace applies to every one of the 352 obligations on Day 1.

| Drafts Row | Atheris Artefact |
|---|---|
| Compliance Universe row 3 — "Circular on Illicit International Money Remittances Through The Banking System" (CBN Circular, AML/CFT/CPF, Outdated, High) | E1 RegulatoryInstrument with all 17 attributes; status = Outdated; comment captures the supersession; FR1.10 audit trail; M01 |
| Risk Rating "High" | E7 RiskRating with explanation per FR1.3; surfaces in FR18.2 |
| Sanction "Not Specified" but supersession noted | E15 Sanction entry stub; M28 |
| Compliance Context: "FX compliance, transaction monitoring, account surveillance" | Mapped to controls in M07 (sanctions), M08 (transaction monitoring), M06 (account opening), and to the AMLCFT CRMP |
| CRMP row "Designated categories of predicate offences" (AML CFT) — Inherent H/H, Residual M/H | E10 CRMPRow; FR3.2; FR4.2; M08; M09; Control = "Implement automated transaction monitoring systems and red flag indicators…"; Responsibility = Compliance Department, AML/CFT Unit, Internal Audit, Transaction Monitoring; Additional Control = "Regular review of red flag indicators; quarterly audits of STR filings…" |
| Monitoring Plan row ABAC001 — EFCC Act 2004 §34(3) "Freezing Orders" — Immediate frequency — Branch Manager — Completed | E13 MonitoringActivity; FR5.1; FR5.7; Status workflow; cross-links WF-07; AC24.3 |
| Returns Register row — "Monthly AML compliance status report to Board" — Sec. 9(4) — Chief Compliance Officer | E14 Return; FR10.1; FR10.10 |

The full per-row trace for all 352 obligations, all 12 per-theme CRMP rows, all 236 Monitoring Plan rows, all 187 Returns Register rows and all 417 Sanctions Grid rows shall be auto-generated by the Day-1 import process and stored in M19 as the system-of-record traceability dataset; the import job emits a "trace report" listing the BRD module / feature ID against every imported row.

### Appendix D — Reference Standards and Frameworks Beyond the Drafts

- FATF 40 Recommendations (2012, updated).
- FATF Methodology for Assessing Compliance.
- GIABA Mutual Evaluation Procedures.
- Wolfsberg Group Principles (AML, ABAC, Sanctions).
- Basel Committee on Banking Supervision — Compliance and the Compliance Function in Banks (2005); Sound Management of Operational Risk (2011); Internal Audit Function in Banks (2012).
- ISO 27001 / 27002 (Information Security Management).
- ISO 22301 (Business Continuity).
- ISO 31000 (Risk Management).
- NIST Cybersecurity Framework (CSF).
- OECD CRS Standard for Automatic Exchange.
- IRS FATCA IGA Model 2 (Nigeria signatory).
- UN Conventions: Vienna 1988; Palermo 2000; Merida 2003.

### Appendix E — Sample API Catalogue (Indicative)

| API | Purpose | Module |
|---|---|---|
| POST /screening/realtime | Real-time sanctions/PEP screen | M07 |
| POST /onboarding/customer | Customer onboarding | M06 |
| GET /bvn/{bvn} | BVN validation via NIBSS | M06 |
| GET /nin/{nin} | NIN validation via NIMC | M06 |
| GET /cac/{rcNumber} | CAC corporate look-up | M06 |
| POST /alerts/aml | AML alert intake from external engine | M08 |
| POST /str/draft | Draft an STR | M09 |
| POST /str/submit | Submit STR via goAML | M09 |
| POST /returns/{returnId}/draft | Auto-draft a return | M10 |
| POST /returns/{returnId}/submit | Submit a return | M10 |
| POST /complaints | Log a complaint | M11 |
| POST /dsr | Submit DSR | M12 |
| POST /breach | Log breach (NDPC timer starts) | M12 |
| GET /sanctions/penalties?source=X | Query Sanctions KB | M28 |
| GET /universe/search?q= | Universe search | M01 |
| POST /universe/import | Bulk import | M01 |

### Appendix F — Delivery Phasing (Indicative)

| Phase | Duration | Modules | Outcomes |
|---|---|---|---|
| Phase 0 — Foundations | 6 weeks | Reference data; identity; platform NFRs | Cloud landing zone; SSO; reference taxonomies loaded; DR baseline |
| Phase 1 — Regulatory Backbone | 10 weeks | M01, M02, M03, M17, M18 (basic), M19 | Universe (352 obligations) loaded; policies migrated; obligations mapped; calendar live; audit trail in place |
| Phase 2 — Risk & Monitoring | 10 weeks | M04, M05, M28 | All 12 CRMPs operational; Monitoring Plan executing; Sanctions KB queryable |
| Phase 3 — Financial Crime | 12 weeks | M06, M07, M08, M09 | KYC + screening + AML monitoring + NFIU goAML submission live |
| Phase 4 — Returns & Reporting | 8 weeks | M10, M18 (full), M21 | Returns automation across CBN/NDIC/NFIU/SEC/NDPC/FIRS/PenCom; Board pack one-click |
| Phase 5 — Consumer / Conduct / Governance | 10 weeks | M11, M13, M22, M24, M25 | Complaints, whistleblowing, conduct, ABAC and CG operational |
| Phase 6 — Data / Cyber / Vendor | 8 weeks | M12, M14, M16 | NDPA operational; vendor lifecycle; incident management |
| Phase 7 — Capital, Cross-border, ESG, Open Banking | 10 weeks | M20, M23, M26, M27, M29, M30 | FATCA/CRS; Open Banking; ESG/sustainability; Capital Market; Account Mgmt; Cash Mgmt |
| Phase 8 — Hardening & Regulator Portal | 6 weeks | M18 (regulator portal), full NFR sweep | Pen-test pass; CBN cyber-self-assessment; regulator portal (where opted) |

[ASSUMPTION] The phasing assumes a single Tier-1 commercial bank deployment; smaller institutions may collapse Phases 5–7.

---

**End of Document**




---

## Appendix G — Architecture and Implementation Design Addendum (v2.1)

> This appendix documents the architectural and implementation decisions made during the engineering design session of 19 May 2026. It supplements the functional requirements of BRD v2.0 and should be read alongside the companion technical documents listed in §G.7.

---

### G.1 — Platform Architecture Decision: Distributed Multi-Tenant SaaS

The original BRD assumed a single-institution deployment. During the engineering design session, the architecture was revised to a **distributed multi-tenant SaaS model** — one central intelligence platform operated by Atheris, with isolated tenant environments per subscribing institution.

#### G.1.1 The Two-Layer Model

```
LAYER 1 — CENTRAL INTELLIGENCE PLATFORM (Atheris operates this)
  Responsibility: Regulatory intelligence, horizon scanning, OCR,
                  AI classification, applicability routing,
                  tenant registry, webhook delivery.
  Data owned: Regulators, instruments, obligations, sanctions,
              eligibility rules, tenant profiles.
  Who accesses it: Platform admins only.

LAYER 2 — TENANT ENVIRONMENT (one per institution)
  Responsibility: Obligation classification, control management,
                  control testing, findings, regulatory returns,
                  evidence vault, board dashboard.
  Data owned: Received obligations, controls, test results,
              findings, audit events, users.
  Who accesses it: The institution's compliance team only.
```

#### G.1.2 Why This Architecture

The original single-tenant design required every bank to maintain its own regulatory library — scraping the same regulator websites independently, running their own OCR pipeline, and classifying the same circulars in isolation. The SaaS model:

- Runs the scraper once centrally. All 43 regulator websites are monitored from one place.
- Classifies each circular once with AI. All eligible tenants receive the structured output.
- Reduces time-to-awareness from weeks (manual) to under 30 minutes from CBN publication.
- Scales to 500+ institutions without proportional infrastructure cost.
- Creates a regulatory intelligence moat: the platform accumulates structured Nigerian regulatory history that is difficult to replicate.

---

### G.2 — Revised Pain Point Analysis

The original BRD described the problem in regulatory and governance terms. This addendum restates it through the lens of a compliance analyst persona (Ngozi) to ground engineering decisions in concrete user behaviour.

#### G.2.1 The Six Pain Points and Their Solutions

| # | Pain Point | Current State | Atheris Solution |
|---|---|---|---|
| 1 | Finding new regulations | Manual website checks weekly. Circulars discovered days or weeks late. | Horizon scanner checks all 43 regulator sites nightly. New document detected, OCR'd, AI-classified, and pushed to tenant within 30 minutes. |
| 2 | 350+ obligations in Excel | 1,200-row spreadsheet with no enforced structure, no ownership, no audit trail. | `received_obligations` table per tenant. 17 structured fields. Every change logged in `audit_events`. Queryable by risk, owner, theme, gap status. |
| 3 | 187 return deadlines in a calendar | Shared calendar with no preparation workflow. Returns missed because deadlines silently moved. | `regulatory_returns` + `return_filing_instances` tables. Multi-stage workflow: Data Gathering → Draft → Review → Sign-off → Submitted. Auto-escalation. |
| 4 | Evidence takes 2 days to produce for examiners | Evidence scattered across email, SharePoint, laptops. | `audit_events` table: append-only, hash-chained, tamper-evident. Evidence documents in S3. Examiner portal (VIEWER role) gives read-only access without data export. |
| 5 | Chasing people by WhatsApp | Tasks assigned informally by email/WhatsApp. No tracking, no escalation, no audit. | Task system driven by `control_test_results` and `findings`. Assigned to named users. Auto-escalation via manager chain. Everything logged. |
| 6 | Board pack takes 4 days from stale data | Manual PowerPoint from multiple spreadsheets. Data 2 weeks old by presentation. | `dashboard_snapshots` computed nightly. Board pack generated on demand from live data. Zero manual assembly. |

#### G.2.2 What the Central Platform Solves

The central platform directly addresses **Pain Points 1 and the first half of 2**:

- **Pain Point 1** (finding regulations): Fully solved by the Horizon Scanner + AI Classifier + Webhook delivery pipeline.
- **Pain Point 2 — first half** (structuring obligations): The central platform classifies obligations into structured records with risk rating, area of focus, applicable licence types, specific duties, and sanctions. Tenants receive fully structured data — not raw PDFs.

**Pain Points 2 (second half), 3, 4, 5, and 6 are solved by the tenant application** — not yet fully designed as of v2.1. See §G.6 for what remains.

---

### G.3 — Horizon Scanner Service

The horizon scanner replaces the manual website-checking process described in BRD §3.2.1.

#### G.3.1 Two Operating Modes

| Mode | Purpose | Frequency | Priority |
|---|---|---|---|
| Incremental Monitoring | Detect only new documents | Every 15 minutes | HIGH |
| Historical Backfill | Import last 2-3 years of regulatory history | On-demand (admin-triggered) | LOW — never blocks monitoring |

#### G.3.2 Scraper Strategies

| Strategy | Technology | When Used |
|---|---|---|
| HTML scraper | JSoup | Static HTML sites (SEC, NDIC, NAICOM) |
| Headless browser | Playwright (Chromium) | JavaScript-rendered sites (CBN) |
| Manual upload | Admin REST endpoint | Sites that block scrapers or restructure |

**Playwright replaces Selenium entirely.** Playwright bundles its own Chromium, requires no ChromeDriver installation, uses deterministic `waitForSelector()` instead of `Thread.sleep()`, and is built for Docker/headless from day one.

#### G.3.3 Regulator Configuration (UI-Driven)

Every scraper parameter is stored in the `regulators` database table and configurable from the admin UI — no code changes required when a regulator restructures their website:

| Config Field | Example | Purpose |
|---|---|---|
| `publication_page_url` | `https://cbn.gov.ng/Out/Circulars` | Where to look |
| `scraper_strategy` | `html` / `headless` | Which technology to use |
| `pdf_link_selector` | `table.circulars a[href$='.pdf']` | CSS selector for PDF links |
| `scraper_frequency` | `daily` / `hourly` / `weekly` | How often to check |
| `pagination_enabled` | `true` | Whether to follow Next Page links |
| `pagination_strategy` | `NEXT_BUTTON` / `PAGE_PARAM` / `YEAR_FOLDERS` | How pagination works |
| `max_pdf_size_mb` | `100` | Per-regulator size limit |
| `request_headers` | `{"Referer": "..."}` | Custom HTTP headers |
| `scraper_enabled` | `true` / `false` | On/off switch |

#### G.3.4 Reliability Improvements

Four reliability improvements are mandatory before production:

1. **Stream PDFs** — `InputStream` → `DigestInputStream` (SHA256) → S3 multipart upload. Never loads full PDF into memory. Safe for 100MB+ files.
2. **Max size protection** — HEAD request checks `Content-Length` before downloading. Upload aborted mid-stream if size exceeded.
3. **Content-type + magic byte validation** — Both `Content-Type` header and `%PDF` magic bytes checked. Defence in depth against HTML error pages masquerading as PDFs.
4. **Retry with exponential backoff** — Resilience4j RetryConfig: 3 attempts, 2s/4s/8s backoff. Retries `IOException` and `TimeoutException`. Does not retry 4xx errors or invalid content.

Two short-term improvements:

5. **Provenance snapshots** — HTML snapshot of source page saved to S3 (`provenance/{regulator}/{date}/page.html`) as timestamped evidence that the document was published at that URL on that date.
6. **Anomaly detection** — Hourly cron checks for 3 consecutive zero-document runs or >90% volume drop per regulator. Sends platform admin alert.

#### G.3.5 Processing Pipeline (Cron-Based — No Kafka)

Kafka was evaluated and rejected for MVP. The regulatory document volume (≤10 new documents per day across all Nigerian regulators) does not justify a Kafka cluster. A PostgreSQL `job_queue` table with Spring `@Scheduled` processors provides equivalent guarantees at zero infrastructure cost.

```
Every 15 min   Horizon scanner runs → new PDFs enqueued in job_queue
Every 2 min    OCR processor → PDFBox (digital PDF) or Tesseract (scanned)
Every 5 min    AI classifier → Claude API → structured classification
Every 5 min    Applicability evaluator → matches tenants by licence type
Every 5 min    Webhook sender → HMAC-signed POST to each matched tenant
Every 30 min   Webhook retry → exponential backoff for failed deliveries
Every hour     Anomaly detector → alert on scraper failures
```

Upgrade path to Kafka exists if throughput demands it. The `job_queue` table schema is compatible with migration to a proper message queue without application logic changes.

---

### G.4 — Tenant Isolation Model

#### G.4.1 Schema-Per-Tenant

Each institution gets a dedicated PostgreSQL schema: `atheris_tenant_{tenant_id}`. All tenant tables (`received_obligations`, `controls`, `findings`, `audit_events`, etc.) live inside it. The central platform has no SELECT access to tenant schemas. Tenant A cannot see Tenant B's data even in the event of an application bug — a missing WHERE clause cannot cross schema boundaries.

#### G.4.2 Tenant Profile and Regulator Subscriptions

Each tenant maintains a `tenant_profile` row in their schema that records:

- Their `licence_type` (Commercial Bank, Fintech, PFA, etc.)
- Their `subscribed_regulators` (e.g. `['CBN', 'NDIC', 'NDPC']`) — the subset of regulators they want obligations from
- Their `product_lines` (e.g. `['Retail Banking', 'Consumer Credit']`) — used for fine-grained applicability

The central platform's `tenant_eligibility_rules` table uses these attributes to route obligations. A tenant only receives obligations from regulators they have subscribed to and that match their licence type and product lines.

#### G.4.3 Schema Provisioning

When a new tenant is onboarded by a platform admin, `TenantProvisioningService` automatically:
1. Creates the `atheris_tenant_{id}` schema
2. Runs Flyway migrations to create all tenant tables
3. Inserts the initial `tenant_profile` row

Deactivated tenants have their schema retained (for regulatory audit purposes) but `is_active = false` blocks all login.

---

### G.5 — User Management

#### G.5.1 User Roles

**Platform level:**

| Role | Access |
|---|---|
| `PLATFORM_ADMIN` | Manage regulators, tenants, instruments, jobs, webhooks |

**Tenant level:**

| Role | Access |
|---|---|
| `TENANT_ADMIN` | Manage own users, profile, webhook config |
| `CCO` | Approve findings, sign off returns, generate board pack |
| `ANALYST` | Classify obligations, test controls, manage findings |
| `AUDITOR` | Read-only + raise independent audit findings |
| `VIEWER` | Read-only (board members, CBN examiners) |

#### G.5.2 Invite Flow

New users are onboarded via a token-based invite:

```
1. TENANT_ADMIN invites user → POST /api/v1/users/invite
2. User record created (password_hash = NULL, invite_status = 'pending')
3. Cryptographically random 128-char token generated
4. SHA256 hash stored in invite_tokens table (raw token never stored)
5. Email sent: "Accept your invite" with link containing raw token
6. User clicks link → token validated (not expired, not used)
7. User sets password → hash saved, invite_tokens marked used
8. User logged in immediately — access token (15 min) + refresh token (30 days) issued
```

Token validity: 72 hours for invites, 1 hour for password resets.

#### G.5.3 Token Architecture

- **Access tokens:** JWT, 15-minute expiry, contains userId + email + role
- **Refresh tokens:** 128-char random, SHA256 hash stored in `refresh_tokens` table, 30-day expiry, rotated on each use
- **Account lockout:** 5 failed login attempts → 15-minute lockout
- **Password reset:** Revokes ALL refresh tokens (logs out all devices)

---

### G.6 — What Remains To Be Designed (Tenant Application)

As of v2.1, the central platform is fully specified. The tenant application modules covering Pain Points 2–6 are not yet designed:

| Module | Pain Point | Status |
|---|---|---|
| Obligation Classification UI + workflow | Pain Point 2 (second half) | Not yet designed |
| Controls Register + CRMP management | Pain Point 5 | Not yet designed |
| Control Testing + Task Management | Pain Point 5 | Not yet designed |
| Findings + Remediation workflow | Pain Point 5 | Not yet designed |
| Returns Calendar + Filing workflow | Pain Point 3 | Not yet designed |
| Evidence Vault + Examiner Portal | Pain Point 4 | Not yet designed |
| Board Dashboard + Board Pack generation | Pain Point 6 | Not yet designed |

These map to BRD modules M02–M05, M10, M17, M18, M19 and will be the subject of the next design session.

---

### G.7 — Companion Technical Documents (v2.1)

The following documents were produced during the engineering design session and are the companion technical specification to this BRD addendum:

| Document | Content |
|---|---|
| `atheris_central_intelligence_schema.md` | Full PostgreSQL schema for central platform — regulators, instruments, obligation_mappings, sanctions_and_penalties, tenant_eligibility_rules, regulatory_change_log |
| `atheris_tenant_data_model.md` | Full PostgreSQL schema for tenant environment — received_obligations, controls, control_test_results, findings, regulatory_returns, return_filing_instances, audit_events, dashboard_snapshots |
| `atheris_webhook_and_events.md` | Webhook delivery design — three webhook types, HMAC signing, retry logic, idempotency |
| `atheris_cron_based_events.md` | Job queue design — job_queue table, five cron processors, monitoring |
| `atheris_scraper_service.md` | Complete horizon scanner implementation — HtmlScraperStrategy (JSoup), PlaywrightHeadlessStrategy, streaming download, retry, provenance, anomaly detection, backfill |
| `atheris_complete_service_design.md` | Full Spring Boot service map — module structure, REST APIs, regulator admin endpoints, document upload endpoint, classification service, tenant management |
| `atheris_user_management_and_tenant_isolation.md` | Complete user management — invite flow, JWT, refresh tokens, RBAC, PostgreSQL schema-per-tenant isolation, TenantContextHolder, TenantProvisioningService |
| `Atheris_Compliance_Analyst_Problems_and_Solutions.md` | Human-centred pain point analysis — Ngozi persona, six problems, six solutions with data examples |

