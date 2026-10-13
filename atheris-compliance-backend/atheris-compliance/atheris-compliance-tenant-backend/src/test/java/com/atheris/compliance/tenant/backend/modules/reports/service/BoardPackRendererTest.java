package com.atheris.compliance.tenant.backend.modules.reports.service;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BoardPackRendererTest {

    private final BoardPackRenderer renderer = new BoardPackRenderer();

    private ComplianceMetricsDto metrics() {
        return ComplianceMetricsDto.builder()
            .periodFrom(LocalDate.of(2026, 1, 1)).periodTo(LocalDate.of(2026, 3, 31))
            .obligationsApplicable(353).obligationsHighRisk(47).obligationsWithGaps(12)
            .obligationsByRisk(Map.of("Critical", 5, "High", 42, "Moderate", 120, "Low", 186))
            .obligationsByArea(Map.of("AML/CFT", 80, "Consumer Protection", 40))
            .controlsTotal(200).controlsHighResidualRisk(9).controlCoverage(88.0).controlTestCompletion(91.0)
            .returnsSubmittedOnTime(30).returnsSubmittedLate(2).returnsPending(4).returnsOverdue(1).returnsOnTimePct(93.8)
            .findingsOpen(14).findingsHighSeverity(3).findingsOverdueRemediation(2).findingsWithinSlaPct(85.0)
            .findingsAgeing(List.of(ComplianceMetricsDto.FindingAge.builder().severity("High").count(3).averageAgeDays(6.2).build()))
            .penaltyExposureNaira(new BigDecimal("50000000"))
            .exposureByAct(Map.of("Banks and Other Financial Institutions Act", new BigDecimal("30000000")))
            .complianceScore(84.0)
            .attentionItems(List.of(
                ComplianceMetricsDto.AttentionItem.builder().category("returns").label("Overdue returns").count(1).severity("high").build(),
                ComplianceMetricsDto.AttentionItem.builder().category("obligations").label("High-risk obligations with no control").count(12).severity("medium").build()))
            .build();
    }

    @Test
    void rendersDraftPdf() {
        byte[] pdf = renderer.render("Mam Corp", "Commercial Bank", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31),
            metrics(), 81.0, List.of(), true, "Ngozi Eze");
        assertNotNull(pdf);
        assertTrue(pdf.length > 1000, "PDF should have content, got " + pdf.length + " bytes");
        // %PDF magic
        assertEquals('%', pdf[0]);
        assertEquals('P', pdf[1]);
        assertEquals('D', pdf[2]);
        assertEquals('F', pdf[3]);
    }

    @Test
    void rendersSignedOffPdfWithoutWatermark() {
        String draftHtml = renderer.buildHtml("Mam Corp", "Commercial Bank",
            LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), metrics(), 81.0, List.of(), true, "Ngozi");
        String finalHtml = renderer.buildHtml("Mam Corp", "Commercial Bank",
            LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), metrics(), 81.0, List.of(), false, "Ngozi");
        assertTrue(draftHtml.contains("DRAFT"));
        assertTrue(draftHtml.contains("watermark"));
        assertFalse(finalHtml.contains("class='watermark'"));
        assertTrue(finalHtml.contains("SIGNED OFF"));
    }
}