package com.atheris.compliance.tenant.backend.modules.demo.service;

import static com.atheris.compliance.common.Constants.*;
import com.atheris.compliance.tenant.backend.modules.auth.dto.AuthTokens;
import com.atheris.compliance.tenant.backend.modules.auth.service.JwtService;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class DemoDataSeeder {

    private final UserRepository users;
    private final ControlRepository controls;
    private final ControlTestResultRepository testResults;
    private final FindingRepository findings;
    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final TenantProfileRepository profiles;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @Value("${atheris.tenant-id:1}")
    private Long tenantId;

    private Integer demoUserId;
    private static final String DEMO_EMAIL = "demo@atheris.ng";
    private static final String DEMO_PASSWORD = "Demo@123";

    @Transactional
    public AuthTokens seedAndLogin() {
        User demo = users.findByEmail(DEMO_EMAIL).orElse(null);
        if (demo == null) {
            demo = User.builder().email(DEMO_EMAIL).fullName("Ngozi Eze")
                .role("CCO").jobTitle("Chief Compliance Officer").department("Compliance")
                .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                .isActive(true).emailVerified(true).inviteStatus("active")
                .passwordChangedAt(Instant.now()).build();
            demo = users.save(demo);
            log.info("Created demo user: {}", demo.getUserId());
        }
        demoUserId = demo.getUserId();

        seedLicense();

        if (controls.count() == 0) seedControls();
        if (findings.count() == 0) seedFindings();
        if (returns.count() == 0) seedReturns();

        String access = jwtService.generateAccessToken(demo.getUserId(), demo.getEmail(), demo.getRole());
        return AuthTokens.builder()
            .accessToken(access).refreshToken("demo-refresh")
            .accessTokenExpiresIn(1440).tokenType("Bearer")
            .user(AuthTokens.UserSummary.builder()
                .userId(demo.getUserId()).email(demo.getEmail())
                .fullName(demo.getFullName()).role(demo.getRole()).build())
            .build();
    }

    void seedLicense() {
        TenantProfile profile = profiles.findByTenantId(tenantId)
            .orElse(TenantProfile.builder().tenantId(tenantId).build());
        if (profile.getLicenseKey() == null) {
            profile.setLicenseKey("DEMO-LICENSE-KEY");
            profile.setLicenseStatus(LICENSE_ACTIVE);
            profile.setLicenseActivatedAt(Instant.now());
            profile.setLicenseExpiresAt(Instant.now().plus(java.time.Duration.ofDays(365)));
            profile.setOnboardingStep(6);
            profile.setOnboardingCompletedAt(Instant.now());
            profiles.save(profile);
            log.info("Seeded demo license for tenant {}", tenantId);
        }
    }

    void seedControls() {
        List<Control> list = List.of(
            Control.builder().controlNumber("CTRL-001").name("ATM Cash Replenishment Monitoring")
                .theme("Operational").controlType("Detective").whatItDoes("Monitors daily ATM cash levels across all branches and alerts when replenishment is needed.")
                .howTested("Review ATM cash reports and verify replenishment logs against threshold breaches.")
                .controlOwnerUserId(demoUserId).controlOwnerName("Ngozi Eze")
                .testFrequency("Monthly").testFrequencyDays(30).inherentRisk("High").residualRisk("Medium").status("Active").createdByUserId(demoUserId).build(),
            Control.builder().controlNumber("CTRL-002").name("AML Transaction Screening")
                .theme("Compliance").controlType("Preventive").whatItDoes("Screens all transactions above N5m against CBN AML watchlist before processing.")
                .howTested("Sample 20 screened transactions monthly and verify screening accuracy.")
                .controlOwnerUserId(demoUserId).controlOwnerName("Ngozi Eze")
                .testFrequency("Monthly").testFrequencyDays(30).inherentRisk("High").residualRisk("Low").status("Active").createdByUserId(demoUserId).build(),
            Control.builder().controlNumber("CTRL-003").name("Financial Reconciliation")
                .theme("Financial").controlType("Detective").whatItDoes("Daily reconciliation of GL accounts with subsidiary ledgers.")
                .howTested("Verify reconciliation reports for 5 random days each quarter.")
                .controlOwnerUserId(demoUserId).controlOwnerName("Ngozi Eze")
                .testFrequency("Quarterly").testFrequencyDays(90).inherentRisk("Medium").residualRisk("Low").status("Active").createdByUserId(demoUserId).build(),
            Control.builder().controlNumber("CTRL-004").name("IT Access Review")
                .theme("IT").controlType("Detective").whatItDoes("Quarterly review of all user access rights to core banking systems.")
                .howTested("Review access audit logs and verify terminated employees have been removed.")
                .controlOwnerUserId(demoUserId).controlOwnerName("Ngozi Eze")
                .testFrequency("Quarterly").testFrequencyDays(90).inherentRisk("High").residualRisk("High").status("Active").createdByUserId(demoUserId).build(),
            Control.builder().controlNumber("CTRL-005").name("NDPC Data Protection Compliance")
                .theme("Legal").controlType("Preventive").whatItDoes("Ensures all personal data processing complies with NDPC requirements.")
                .howTested("Audit data processing register and verify consent records.")
                .controlOwnerUserId(demoUserId).controlOwnerName("Ngozi Eze")
                .testFrequency("Annual").testFrequencyDays(365).inherentRisk("Medium").residualRisk("Medium").status("Active").createdByUserId(demoUserId).build()
        );
        controls.saveAll(list);
        log.info("Seeded {} controls", list.size());
    }

    void seedFindings() {
        List<Finding> list = List.of(
            Finding.builder().findingType("Control Failure").severity("High")
                .description("CTRL-004 (IT Access Review) failed — Q2 2026. Terminated employee access not revoked for 14 days.")
                .rootCause("HR termination notification not reaching IT team in time.")
                .triggeredByTestId(1L).triggerReason("Control test failed")
                .assignedToUserId(demoUserId).assignedToName("Ngozi Eze")
                .assignedAt(Instant.now().minus(5, java.time.temporal.ChronoUnit.DAYS))
                .remediationDeadline(LocalDate.now().plus(9, java.time.temporal.ChronoUnit.DAYS))
                .slaDays(14).status("Open").createdByUserId(demoUserId).build(),
            Finding.builder().findingType("Gap").severity("High")
                .description("NDPC DPO not yet appointed as required by NDPC Data Protection Compliance Framework.")
                .rootCause("Obligation classified as applicable but action not taken.")
                .triggerReason("Manual discovery")
                .assignedToUserId(demoUserId).assignedToName("Ngozi Eze")
                .assignedAt(Instant.now().minus(10, java.time.temporal.ChronoUnit.DAYS))
                .remediationDeadline(LocalDate.now().plus(4, java.time.temporal.ChronoUnit.DAYS))
                .slaDays(14).status("In Remediation").createdByUserId(demoUserId).build(),
            Finding.builder().findingType("Control Failure").severity("Medium")
                .description("CTRL-001 (ATM Cash Monitoring) failed — Kano branch. Cash below threshold for 3 consecutive days.")
                .rootCause("Scheduled cash delivery missed due to logistic issue.")
                .triggeredByTestId(2L).triggerReason("Control test failed")
                .assignedToUserId(demoUserId).assignedToName("Ngozi Eze")
                .assignedAt(Instant.now().minus(20, java.time.temporal.ChronoUnit.DAYS))
                .remediationDeadline(LocalDate.now().minus(6, java.time.temporal.ChronoUnit.DAYS))
                .slaDays(14).status("Remediated")
                .remediationNotes("Cash delivery rescheduled. Kano branch now compliant.")
                .remediationEvidenceUrl("https://docs.google.com/document/d/demo-remediation")
                .remediationSubmittedAt(Instant.now().minus(5, java.time.temporal.ChronoUnit.DAYS))
                .createdByUserId(demoUserId).build(),
            Finding.builder().findingType("Process Weakness").severity("Low")
                .description("Monthly reconciliation report for March 2026 submitted 2 days late.")
                .rootCause("Team lead was on leave with no backup.")
                .triggerReason("Manual discovery")
                .assignedToUserId(demoUserId).assignedToName("Ngozi Eze")
                .assignedAt(Instant.now().minus(45, java.time.temporal.ChronoUnit.DAYS))
                .remediationDeadline(LocalDate.now().minus(31, java.time.temporal.ChronoUnit.DAYS))
                .slaDays(60).status("Closed")
                .ccoSignOffUserId(demoUserId).ccoSignOffAt(Instant.now().minus(25, java.time.temporal.ChronoUnit.DAYS))
                .closedAt(Instant.now().minus(25, java.time.temporal.ChronoUnit.DAYS))
                .createdByUserId(demoUserId).build()
        );
        findings.saveAll(list);
        log.info("Seeded {} findings", list.size());
    }

    void seedReturns() {
        RegulatoryReturn cbn = returns.save(RegulatoryReturn.builder()
            .returnName("CBN Monetary Policy Return").filingRegulator("CBN")
            .returnType("Prudential").frequency("Monthly")
            .filingDueDayOfMonth(10).filingDeadlineOffsetDays(5)
            .filingChannel("CBN Portal").returnOwnerUserId(demoUserId)
            .returnOwnerName("Ngozi Eze").build());
        RegulatoryReturn ndic = returns.save(RegulatoryReturn.builder()
            .returnName("NDIC Premium Return").filingRegulator("NDIC")
            .returnType("Premium").frequency("Quarterly")
            .filingDueDayOfMonth(15).filingDeadlineOffsetDays(7)
            .filingChannel("NDIC e-Filing").returnOwnerUserId(demoUserId)
            .returnOwnerName("Ngozi Eze").build());
        RegulatoryReturn aml = returns.save(RegulatoryReturn.builder()
            .returnName("AML Suspicious Transaction Report").filingRegulator("NFIU")
            .returnType("AML/CFT").frequency("Monthly")
            .filingDueDayOfMonth(30).filingDeadlineOffsetDays(3)
            .filingChannel("NFIU Portal").returnOwnerUserId(demoUserId)
            .returnOwnerName("Ngozi Eze").build());

        String doneStage = "{\"Data Gathering\":{\"completedAt\":\"" + Instant.now().minus(25, java.time.temporal.ChronoUnit.DAYS) + "\",\"completedByName\":\"Ngozi Eze\"},\"Draft\":{\"completedAt\":\"" + Instant.now().minus(20, java.time.temporal.ChronoUnit.DAYS) + "\",\"completedByName\":\"Ngozi Eze\"},\"Review\":{\"completedAt\":\"" + Instant.now().minus(15, java.time.temporal.ChronoUnit.DAYS) + "\",\"completedByName\":\"Ngozi Eze\"},\"Sign-off\":{\"completedAt\":\"" + Instant.now().minus(10, java.time.temporal.ChronoUnit.DAYS) + "\",\"completedByName\":\"Ngozi Eze\"}}";

        instances.save(ReturnFilingInstance.builder()
            .returnId(cbn.getReturnId()).period("2026-06")
            .dueDate(LocalDate.of(2026, 6, 10)).prepStartDate(LocalDate.of(2026, 6, 5))
            .currentStage("Submitted").status("Submitted Late")
            .filingChannel("CBN Portal").submittedDate(LocalDate.of(2026, 6, 12))
            .submittedByUserId(demoUserId).submissionEvidenceUrl("https://docs.google.com/document/d/demo-cbn-jun")
            .daysLate(2).stageData(doneStage).build());
        instances.save(ReturnFilingInstance.builder()
            .returnId(cbn.getReturnId()).period("2026-07")
            .dueDate(LocalDate.of(2026, 7, 10)).prepStartDate(LocalDate.of(2026, 7, 5))
            .currentStage("Review").status("In Progress")
            .filingChannel("CBN Portal").stageOwnerUserId(demoUserId)
            .stageData("{\"Data Gathering\":{\"completedAt\":\"" + Instant.now().minus(5, java.time.temporal.ChronoUnit.DAYS) + "\",\"completedByName\":\"Ngozi Eze\"},\"Draft\":{\"completedAt\":\"" + Instant.now().minus(2, java.time.temporal.ChronoUnit.DAYS) + "\",\"completedByName\":\"Ngozi Eze\"}}").build());
        instances.save(ReturnFilingInstance.builder()
            .returnId(ndic.getReturnId()).period("2026-Q2")
            .dueDate(LocalDate.of(2026, 6, 15)).prepStartDate(LocalDate.of(2026, 6, 8))
            .currentStage("Not Started").status("Not Started")
            .filingChannel("NDIC e-Filing").build());
        instances.save(ReturnFilingInstance.builder()
            .returnId(aml.getReturnId()).period("2026-07")
            .dueDate(LocalDate.of(2026, 7, 30)).prepStartDate(LocalDate.of(2026, 7, 27))
            .currentStage("Data Gathering").status("In Progress")
            .filingChannel("NFIU Portal").stageOwnerUserId(demoUserId).build());

        log.info("Seeded {} returns with instances", 3);
    }
}
