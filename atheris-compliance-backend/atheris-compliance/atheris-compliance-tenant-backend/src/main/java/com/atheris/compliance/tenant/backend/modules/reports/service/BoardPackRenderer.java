package com.atheris.compliance.tenant.backend.modules.reports.service;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Renders a board pack to PDF from HTML/CSS. Charts are plain HTML bars so no image
 * rendering is needed. The same HTML drives the DRAFT (watermarked) and signed-off PDFs.
 */
@Component
public class BoardPackRenderer {

    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final NumberFormat MONEY = NumberFormat.getNumberInstance(Locale.of("en", "NG"));

    public byte[] render(String institution, String licenceType, LocalDate from, LocalDate to,
                         ComplianceMetricsDto m, Double previousScore, List<String> sections,
                         boolean draft, String generatedBy) {
        String html = buildHtml(institution, licenceType, from, to, m, previousScore, sections, draft, generatedBy);
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(os);
            builder.run();
            return os.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Board pack PDF rendering failed: " + e.getMessage(), e);
        }
    }

    public String buildHtml(String institution, String licenceType, LocalDate from, LocalDate to,
                            ComplianceMetricsDto m, Double previousScore, List<String> sections,
                            boolean draft, String generatedBy) {
        Set<String> s = (sections == null || sections.isEmpty()) ? Set.of("all") : Set.copyOf(sections);
        boolean all = s.contains("all");
        StringBuilder b = new StringBuilder();
        b.append("<!DOCTYPE html><html><head><meta charset='utf-8'/><style>").append(css()).append("</style></head><body>");

        if (draft) {
            b.append("<div class='watermark'>DRAFT</div>");
        }

        // Cover / header
        b.append("<div class='cover'>");
        b.append("<div class='brand'>Atheris</div>");
        b.append("<h1>Board Compliance Pack</h1>");
        b.append("<div class='sub'>").append(esc(institution)).append("</div>");
        if (licenceType != null && !licenceType.isBlank())
            b.append("<div class='sub small'>Licence: ").append(esc(licenceType)).append("</div>");
        b.append("<div class='period'>Reporting period: ").append(from.format(D)).append(" &#8211; ").append(to.format(D)).append("</div>");
        b.append("<div class='sub small'>Generated ").append(LocalDate.now().format(D))
         .append(generatedBy != null ? " by " + esc(generatedBy) : "").append("</div>");
        b.append("<div class='status'>Status: ").append(draft ? "DRAFT (not signed off)" : "SIGNED OFF").append("</div>");
        b.append("</div>");

        // Executive summary
        if (all || s.contains("summary")) {
            b.append("<h2>Executive Summary</h2>");
            b.append("<div class='kpis'>");
            kpi(b, "Compliance Score", m.getComplianceScore() != null ? fmt(m.getComplianceScore()) + "%" : "&#8211;",
                change(m.getComplianceScore(), previousScore));
            kpi(b, "Obligations Tracked", String.valueOf(m.getObligationsApplicable()), null);
            kpi(b, "Critical/High Obligations", m.getObligationsHighRisk() + " (" + m.getObligationsWithGaps() + " with open gaps)", null);
            kpi(b, "Control Coverage", fmt(m.getControlCoverage()) + "%", null);
            kpi(b, "Controls Tested", pctOrNa(m.getControlTestCompletion()), null);
            kpi(b, "Returns On Time", pctOrNa(m.getReturnsOnTimePct()), null);
            kpi(b, "Open Findings", m.getFindingsOpen() + " (" + m.getFindingsHighSeverity() + " high)", null);
            kpi(b, "Penalty Exposure", "&#8358;" + MONEY.format(m.getPenaltyExposureNaira() == null ? BigDecimal.ZERO : m.getPenaltyExposureNaira()), null);
            b.append("</div>");
        }

        // Board attention
        if ((all || s.contains("attention")) && m.getAttentionItems() != null && !m.getAttentionItems().isEmpty()) {
            b.append("<h2>Board Attention Items</h2><ul class='attention'>");
            for (ComplianceMetricsDto.AttentionItem a : m.getAttentionItems()) {
                b.append("<li><span class='sev ").append(a.getSeverity()).append("'>").append(esc(a.getSeverity().toUpperCase())).append("</span> ")
                 .append(esc(a.getLabel())).append(": <b>").append(a.getCount()).append("</b></li>");
            }
            b.append("</ul>");
        }

        // Risk profile
        if (all || s.contains("risk")) {
            b.append("<h2>Risk Profile</h2>");
            b.append(barTable(b, "Obligations by Risk Band", m.getObligationsByRisk()));
            b.append(barTable(b, "Exposure by Act (&#8358;)", m.getExposureByAct()));
        }

        // Coverage
        if (all || s.contains("coverage")) {
            b.append("<h2>Control Coverage</h2>");
            b.append(barTable(b, "Obligations by Area of Focus", m.getObligationsByArea()));
        }

        // Returns
        if (all || s.contains("returns")) {
            b.append("<h2>Regulatory Returns</h2>");
            b.append("<table class='grid'><tr><th>Filed on time</th><th>Filed late</th><th>Pending</th><th>Overdue</th></tr><tr>")
             .append("<td>").append(m.getReturnsSubmittedOnTime()).append("</td>")
             .append("<td>").append(m.getReturnsSubmittedLate()).append("</td>")
             .append("<td>").append(m.getReturnsPending()).append("</td>")
             .append("<td class='bad'>").append(m.getReturnsOverdue()).append("</td></tr></table>");
        }

        // Findings
        if (all || s.contains("findings")) {
            b.append("<h2>Findings &amp; Remediation</h2>");
            if (m.getFindingsAgeing() != null && !m.getFindingsAgeing().isEmpty()) {
                b.append("<table class='grid'><tr><th>Severity</th><th>Open</th><th>Avg age (days)</th></tr>");
                for (ComplianceMetricsDto.FindingAge f : m.getFindingsAgeing()) {
                    b.append("<tr><td>").append(esc(f.getSeverity())).append("</td><td>").append(f.getCount())
                     .append("</td><td>").append(fmt(f.getAverageAgeDays())).append("</td></tr>");
                }
                b.append("</table>");
            } else {
                b.append("<p class='muted'>No open findings.</p>");
            }
        }

        // Sanctions
        if (all || s.contains("sanctions")) {
            b.append("<h2>Sanctions &amp; Penalty Exposure</h2>");
            b.append("<p>Total exposure on applicable obligations: <b>&#8358;")
             .append(MONEY.format(m.getPenaltyExposureNaira() == null ? BigDecimal.ZERO : m.getPenaltyExposureNaira()))
             .append("</b></p>");
            b.append(barTable(b, "Exposure by Act (&#8358;)", m.getExposureByAct()));
        }

        b.append("<div class='footer'>Generated by Atheris Compliance &#183; ")
         .append(LocalDate.now().format(D)).append(draft ? " &#183; DRAFT" : " &#183; SIGNED OFF")
         .append("</div>");
        b.append("</body></html>");
        return b.toString();
    }

    private void kpi(StringBuilder b, String label, String value, String delta) {
        b.append("<div class='kpi'><div class='kv'>").append(value).append("</div><div class='kl'>").append(esc(label));
        if (delta != null) b.append("<span class='delta'>").append(delta).append("</span>");
        b.append("</div></div>");
    }

    /** A metric with an empty denominator renders as N/A, never 0%. */
    private String pctOrNa(Double v) {
        return v == null ? "N/A" : fmt(v) + "%";
    }

    private String change(Double current, Double previous) {
        if (current == null || previous == null) return null;
        double d = current - previous;
        String arrow = d >= 0 ? "&#9650;" : "&#9660;";
        return arrow + " " + fmt(Math.abs(d)) + " pts vs prior";
    }

    private <K> String barTable(StringBuilder b, String title, Map<K, ?> map) {
        if (map == null || map.isEmpty()) return "<p class='muted'>" + esc(title) + ": no data.</p>";
        Object maxObj = map.values().stream().map(v -> v instanceof Number n ? n.doubleValue() : 0d)
            .max(Double::compareTo).orElse(1d);
        double max = Math.max(1d, ((Number) maxObj).doubleValue());
        StringBuilder t = new StringBuilder("<div class='panel'><div class='ptitle'>").append(title).append("</div><table class='bars'>");
        map.entrySet().stream()
            .sorted((a, c2) -> Double.compare(num(c2.getValue()), num(a.getValue())))
            .limit(12)
            .forEach(e -> {
                double v = num(e.getValue());
                double pct = Math.min(100, v / max * 100);
                t.append("<tr><td class='barlabel'>").append(esc(String.valueOf(e.getKey())))
                 .append("</td><td class='bartrack'><div class='barfill' style='width:").append((int) pct).append("%'></div></td>")
                 .append("<td class='barval'>").append(esc(fmtVal(e.getValue()))).append("</td></tr>");
            });
        t.append("</table></div>");
        return t.toString();
    }

    private static double num(Object v) { return v instanceof Number n ? n.doubleValue() : 0d; }

    private static String fmtVal(Object v) {
        if (v instanceof BigDecimal bd) return MONEY.format(bd);
        if (v instanceof Number n) return String.valueOf(n.longValue());
        return String.valueOf(v);
    }

    private static String fmt(double v) { return String.valueOf(Math.round(v * 10) / 10.0); }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#39;");
    }

    private static String css() {
        return """
            @page { size: A4; margin: 18mm 14mm; }
            body { font-family: Helvetica, Arial, sans-serif; color: #1a2332; font-size: 10px; }
            h1 { font-size: 22px; margin: 0 0 2px; color: #0b3d91; }
            h2 { font-size: 13px; margin: 18px 0 6px; color: #0b3d91; border-bottom: 1px solid #d5dbe6; padding-bottom: 3px; }
            .cover { margin-bottom: 10px; }
            .brand { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #6b7a90; }
            .sub { color: #47536b; margin: 2px 0; }
            .small { font-size: 9px; }
            .period { margin-top: 6px; font-weight: bold; }
            .status { margin-top: 4px; font-size: 10px; color: #b45309; }
            .kpis { width: 100%; }
            .kpi { display: inline-block; width: 46%; vertical-align: top; border: 1px solid #e2e8f0; border-radius: 4px; padding: 7px 8px; margin: 0 1% 8px 0; }
            .kv { font-size: 16px; font-weight: bold; color: #0b3d91; }
            .kl { font-size: 9px; color: #64748b; }
            .delta { font-size: 8px; color: #16a34a; }
            table.grid { width: 100%; border-collapse: collapse; margin: 4px 0; }
            table.grid th, table.grid td { border: 1px solid #d5dbe6; padding: 5px 7px; text-align: left; font-size: 10px; }
            table.grid th { background: #f1f5f9; }
            .bad { color: #b91c1c; font-weight: bold; }
            .attention { list-style: none; padding: 0; margin: 4px 0; }
            .attention li { padding: 4px 0; border-bottom: 1px solid #eef2f7; }
            .sev { font-size: 8px; font-weight: bold; padding: 1px 5px; border-radius: 3px; color: #fff; }
            .sev.high { background: #dc2626; }
            .sev.medium { background: #d97706; }
            .sev.low { background: #0284c7; }
            .panel { margin: 6px 0 10px; }
            .ptitle { font-size: 10px; font-weight: bold; margin-bottom: 4px; color: #334155; }
            table.bars { width: 100%; border-collapse: collapse; }
            table.bars td { padding: 2px 4px; font-size: 9px; vertical-align: middle; }
            .barlabel { width: 45%; color: #47536b; }
            .bartrack { width: 40%; background: #eef2f7; }
            .barfill { background: #0b3d91; height: 8px; }
            .barval { width: 15%; text-align: right; color: #334155; }
            .muted { color: #94a3b8; font-size: 9px; }
            .footer { margin-top: 20px; border-top: 1px solid #d5dbe6; padding-top: 5px; font-size: 8px; color: #94a3b8; text-align: center; }
            .watermark { position: fixed; top: 45%; left: 5%; font-size: 90px; color: rgba(220,38,38,0.10);
                         font-weight: bold; transform: rotate(-30deg); letter-spacing: 12px; }
            """;
    }
}