package com.atheris.compliance.tenant.backend.shared.email;

import com.atheris.compliance.tenant.backend.modules.settings.service.SmtpSettingsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender fallbackSender;
    private final boolean fallbackEnabled;
    private final String fallbackFrom;
    private final String baseUrl;
    private final SmtpSettingsService smtpSettings;

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

    public Outcome send(String to, String subject, String body, String link) {
        if (to == null || to.isBlank()) {
            log.warn("[email-skip] no recipient for subject={}", subject);
            return Outcome.NO_RECIPIENT;
        }

        String full = link != null && !link.isBlank() ? body + "\n\n" + link + "\n" : body;
        String text = full + "\n— The Atheris Platform";

        SmtpSettingsService.Outbound outbound = resolveOutbound();
        if (outbound == null) {
            log.info("[email-skipped] to={} subject={}", to, subject);
            return Outcome.DISABLED;
        }

        String from = outbound.from() != null && !outbound.from().isBlank() ? outbound.from() : fallbackFrom;
        try {
            var message = outbound.sender().createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, false);
            outbound.sender().send(message);
            log.info("[email-sent] to={} subject={}", to, subject);
            return Outcome.SENT;
        } catch (Exception e) {
            log.error("[email-failed] to={} subject={} error={}", to, subject, e.getMessage());
            return Outcome.FAILED;
        }
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