package com.atheris.compliance.tenant.backend.shared.email;

import com.atheris.compliance.tenant.backend.modules.settings.service.SmtpSettingsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.List;

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

    public void send(String to, String subject, String body, String link) {
        send(to, null, subject, body, link);
    }

    public void send(String to, List<String> cc, String subject, String body, String link) {
        if (to == null || to.isBlank()) {
            log.warn("[email-skip] no recipient for subject={}", subject);
            return;
        }

        String full = link != null && !link.isBlank() ? body + "\n\n" + link + "\n" : body;
        String text = full + "\n— The Atheris Platform";

        SmtpSettingsService.Outbound outbound = resolveOutbound();
        if (outbound == null) {
            log.info("[email-skipped] to={} subject={}", to, subject);
            return;
        }

        String from = outbound.from() != null && !outbound.from().isBlank() ? outbound.from() : fallbackFrom;
        try {
            var message = outbound.sender().createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            if (cc != null) {
                String[] ccArray = cc.stream()
                    .filter(c -> c != null && !c.isBlank() && !c.equalsIgnoreCase(to))
                    .distinct().toArray(String[]::new);
                if (ccArray.length > 0) helper.setCc(ccArray);
            }
            helper.setSubject(subject);
            helper.setText(text, false);
            outbound.sender().send(message);
            log.info("[email-sent] to={} cc={} subject={}", to, cc, subject);
        } catch (Exception e) {
            log.error("[email-failed] to={} subject={} error={}", to, subject, e.getMessage());
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