package com.atheris.compliance.tenant.backend.shared.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final boolean enabled;
    private final String fromAddress;
    private final String baseUrl;

    public EmailService(JavaMailSender mailSender,
                        @Value("${spring.mail.host:}") String smtpHost,
                        @Value("${atheris.email.from:noreply@atheris.com}") String fromAddress,
                        @Value("${atheris.email.base-url:http://localhost:5174}") String baseUrl) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.baseUrl = baseUrl;
        this.enabled = smtpHost != null && !smtpHost.isBlank();
        if (!enabled) {
            log.info("Email sending disabled (SMTP_HOST not set) — sends will be logged and skipped");
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String baseUrl() {
        return baseUrl;
    }

    public void send(String to, String subject, String body, String link) {
        if (!enabled) {
            log.info("[email-skipped] to={} subject={}", to, subject);
            return;
        }
        if (to == null || to.isBlank()) {
            log.warn("[email-skip] no recipient for subject={}", subject);
            return;
        }
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            String full = link != null && !link.isBlank() ? body + "\n\n" + link + "\n" : body;
            helper.setText(full + "\n— The Atheris Platform", false);
            mailSender.send(message);
            log.info("[email-sent] to={} subject={}", to, subject);
        } catch (Exception e) {
            log.error("[email-failed] to={} subject={} error={}", to, subject, e.getMessage());
        }
    }
}