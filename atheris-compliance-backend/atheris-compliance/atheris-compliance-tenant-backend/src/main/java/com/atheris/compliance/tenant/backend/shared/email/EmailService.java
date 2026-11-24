package com.atheris.compliance.tenant.backend.shared.email;

import com.atheris.compliance.tenant.backend.modules.settings.service.SmtpSettingsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Slf4j
public class EmailService {

    private static final String BRAND_NAVY = "#1A365D";
    private static final String BRAND_GOLD = "#D4AF37";
    private static final String LOGO_CID = "verityLogo";

    private final JavaMailSender fallbackSender;
    private final boolean fallbackEnabled;
    private final String fallbackFrom;
    private final String baseUrl;
    private final SmtpSettingsService smtpSettings;
    private final Resource logo = new ClassPathResource("email/verity-logo.png");

    public EmailService(JavaMailSender fallbackSender,
                        @Value("${spring.mail.host:}") String smtpHost,
                        @Value("${atheris.email.from:noreply@atheris.com}") String fallbackFrom,
                        @Value("${atheris.email.base-url:http://localhost:5174}") String baseUrl,
                        SmtpSettingsService smtpSettings) {
        this.fallbackSender = fallbackSender;
        this.fallbackFrom = fallbackFrom;
        this.baseUrl = baseUrl;
        this.smtpSettings = smtpSettings;
        this.fallbackEnabled = smtpHost != null && !smtpHost.isBlank();
        if (!fallbackEnabled) {
            log.info("Fallback email disabled (SMTP_HOST not set) — tenants may still configure their own SMTP");
        }
    }

    public boolean isEnabled() {
        return fallbackEnabled;
    }

    public String baseUrl() {
        return baseUrl;
    }

    /** What happened to a send — callers that tell the user "emailed" must check for {@code SENT}. */
    public enum Outcome { SENT, DISABLED, NO_RECIPIENT, FAILED }

    public String compose(String body, String link) {
        String full = link != null && !link.isBlank() ? body + "\n\n" + link + "\n" : body;
        return full + "\n— Verity Compliance Platform";
    }

    public Outcome send(String to, String subject, String body, String link) {
        return send(to, null, subject, body, link);
    }

    public Outcome send(String to, List<String> cc, String subject, String body, String link) {
        if (to == null || to.isBlank()) {
            log.warn("[email-skip] no recipient for subject={}", subject);
            return Outcome.NO_RECIPIENT;
        }

        String text = compose(body, link);

        SmtpSettingsService.Outbound outbound = resolveOutbound();
        if (outbound == null) {
            log.info("[email-skipped] to={} subject={}", to, subject);
            return Outcome.DISABLED;
        }

        String from = outbound.from() != null && !outbound.from().isBlank() ? outbound.from() : fallbackFrom;
        try {
            var message = outbound.sender().createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            if (cc != null) {
                String[] ccArray = cc.stream()
                    .filter(c -> c != null && !c.isBlank() && !c.equalsIgnoreCase(to))
                    .distinct().toArray(String[]::new);
                if (ccArray.length > 0) helper.setCc(ccArray);
            }
            helper.setSubject(subject);
            helper.setText(text, html(text, link));
            if (logo.exists()) helper.addInline(LOGO_CID, logo);
            outbound.sender().send(message);
            log.info("[email-sent] to={} cc={} subject={}", to, cc, subject);
            return Outcome.SENT;
        } catch (Exception e) {
            log.error("[email-failed] to={} subject={} error={}", to, subject, e.getMessage());
            return Outcome.FAILED;
        }
    }

    private String html(String text, String link) {
        String body = escapeHtml(text).replace("\r\n", "\n").replace("\n", "<br>");
        String cta = link != null && !link.isBlank()
            ? "<div style=\"margin:26px 0 6px;\"><a href=\"" + escapeHtml(link) + "\" "
                + "style=\"display:inline-block;background:" + BRAND_NAVY + ";color:#ffffff;text-decoration:none;"
                + "padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;\">Open in Verity</a></div>"
            : "";
        String header = logo.exists()
            ? "<img src=\"cid:" + LOGO_CID + "\" alt=\"Verity Compliance\" height=\"40\" style=\"height:40px;display:block;\" />"
            : "<span style=\"font-size:20px;font-weight:800;color:" + BRAND_NAVY + ";letter-spacing:-0.02em;\">Verity"
                + "<span style=\"color:" + BRAND_GOLD + ";\">Compliance</span></span>";
        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>"
            + "<body style=\"margin:0;padding:0;background:#ffffff;\">"
            + "<div style=\"background:#ffffff;padding:32px 16px;font-family:Figtree,'Segoe UI',Helvetica,Arial,sans-serif;\">"
            + "<div style=\"max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;\">"
            + "<div style=\"padding:24px 32px;border-bottom:3px solid " + BRAND_GOLD + ";\">" + header + "</div>"
            + "<div style=\"padding:32px;color:#2D3748;font-size:15px;line-height:1.7;\">" + body + cta + "</div>"
            + "<div style=\"padding:18px 32px;border-top:1px solid #EDF2F7;color:#A0AEC0;font-size:12px;line-height:1.6;\">"
            + "Verity Compliance Platform &middot; this is an automated message, please do not reply.</div>"
            + "</div></div></body></html>";
    }

    private static String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;");
    }

    private SmtpSettingsService.Outbound resolveOutbound() {
        try {
            SmtpSettingsService.Outbound tenant = smtpSettings.outbound();
            if (tenant != null) {
                return tenant;
            }
        } catch (Exception e) {
            log.warn("[email] tenant SMTP resolution failed, using fallback: {}", e.getMessage());
        }
        if (!fallbackEnabled) {
            return null;
        }
        return new SmtpSettingsService.Outbound(fallbackSender, fallbackFrom);
    }
}