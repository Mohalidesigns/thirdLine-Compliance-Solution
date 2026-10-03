# Field naming across Atheris modules

Read this before binding to a DTO or copying a block between pages. The same concept is
spelled differently depending on which module you are in, and the differences are exactly
the kind that produce a blank column rather than an error.

## The drift table — same concept, different names

| Concept | Where | Field |
|---|---|---|
| Sanction amount | tenant `InstrumentDetailResponse.SanctionItem` | **`amountNaira`** |
| Sanction amount | tenant `ObligationRegisterItem` / `ObligationDetailView` / `SanctionListItem` | **`sanctionAmountNaira`** |
| Sanction amount | intel `SanctionsPenalty` | **`sanctionAmountNaira`** |
| Obligation section | tenant obligation DTOs | **`sectionReference`** |
| Obligation section | intel `ObligationMapping` | **`specificSectionReference`** |
| Sanction section | everywhere | `sourceSectionReference` |
| Act FK | intel `ObligationMapping`, `SanctionsPenalty` | `regulationId` → DB column **`act_id`** |
| Act FK | intel `RegulatoryReturn`, `ComplianceControl` | **`actId`** directly |
| Act name | intel `ComplianceControl` | **denormalised column** — join-free, and sortable |
| Act name | intel obligations / sanctions / returns | **service-resolved** — not sortable |

Two traps follow directly from the last two rows: copying a sanctions block between the
instruments page and any obligations page silently blanks the amount, and making the Act
column sortable throws `PropertyReferenceException` on every entity except
`ComplianceControl`.

## Tenant enriched obligation fields

Carried by `ReviewDetail.ReviewObligationDto`, `InstrumentDetailResponse.ObligationItem`,
`ObligationRegisterItem` and `ObligationDetailView` — these largely agree:

`obligationId`, `obligationNumber`, `title`, `description` (**verbatim**),
`plainEnglishStatement` (**interpreted / plain English**), `sectionReference`,
`areaOfFocus`, `obligationType`, `recurringDeadlineType`, `riskDescription`,
`inherentLikelihood`, `inherentImpact`, `inherentRiskRating`, `controlOwner`,
`regulationId`, `actName`, `effectiveDate`, `status`

`description` and `plainEnglishStatement` are the verbatim/interpreted pair the UI shows
side by side. Do not collapse them into one block — separating them is the point of the
harmonization work.

## Intel admin explorer stats

Produced by the four `Admin*Service.stats()` methods. Bind only to keys the service
actually puts in the map:

- **obligations** — `totalObligations`, `byRiskRating`, `byAreaOfFocus`, `byObligationType`,
  `riskRatings`, `areasOfFocus`, `obligationTypes`, `highRiskCount` (Critical+Extreme+High),
  `areaCount`
- **sanctions** — `total`, `byType`, `sanctionTypes`, `enforced`, `notEnforced`,
  `highSeverity`, `totalExposure` (BigDecimal — coerce with `Number(x) || 0`, since Jackson
  may emit a number or a string), `actNames`
- **returns** — `totalReturns`, `frequencyTypeCount`, `responsibleUnitCount`,
  `unassignedCount`, `byFrequencyType`, `byResponsibleUnit`, `frequencyTypes`,
  `responsibleUnits`
- **controls** — `totalControls`, `byRiskLevel`, `byStatus`, `byTheme`, `themes`,
  `riskLevels`, `statuses`, `complianceAreas`
- **acts** — `totalActs`, `totalInstruments`, `totalObligations`, `totalSanctions`,
  `totalReturns` (built in `RegulationService.stats()`, not an `AdminActService`)

## Risk vocabulary

The canonical scale, per `ObligationClassification.computeInherentRisk` and the V28 column
defaults — these two agree and are the source of truth:

- impact: `Insignificant`, `Minor`, `Moderate`, `Major`, `Severe`
- likelihood: `Rare`, `Unlikely`, `Possible`, `Likely`, `Almost Certain`
- bands: score `>= 18` Critical, `>= 12` High, `>= 6` Moderate, else Low

Ratings surfaced on obligations are `Critical | High | Moderate | Low` (with `Extreme`
appearing in some risk-profile aggregates). UI chip colouring used throughout:
Critical/Extreme/High → `error`, Moderate/Medium → `warning`, Low → `success`.

Beware two other vocabularies in the tenant UI that are **not** the same scale:
`impactRating ∈ {Critical, High, Medium, Low}` and
`likelihoodRating ∈ {Almost Certain, Likely, Possible, Unlikely, Rare}` come from
`RiskAssessmentModal` / `ReviewEditPage`. Mismatching these against a configured axis is
what made the risk heatmap render all zeros.

## Backend endpoint shapes

Admin explorer endpoints follow `AdminRegulationController`: `GET /api/v1/admin/<entity>`
(paginated + filters), `/stats`, `/{id}`, all under
`@PreAuthorize("hasRole('PLATFORM_ADMIN')")`, thin controller delegating to a service.

Resolve a parent act name by collecting the page's distinct act ids into a `Set` and
issuing one `findAllById` — never one query per row.
