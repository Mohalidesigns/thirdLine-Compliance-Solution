package com.atheris.compliance.intelligence.backend.shared.email;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.notifications.entity.ObligationChange;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service @Slf4j @RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${atheris.email.from:" + Constants.EMAIL_FROM + "}")
    private String fromAddress;

    @Value("${atheris.email.base-url:" + Constants.EMAIL_BASE_URL + "}")
    private String baseUrl;

    /**
     * Alert platform admin when a scraper behaves abnormally.
     * Trigger: 3 consecutive zero-document runs, or >90% volume drop.
     */
    public void sendScraperAlert(String toEmail, String regulatorName,
                                  String publicationUrl, String reason) {
        String subject = "Scraper Alert: " + regulatorName + " — action required";
        String body = """
            Hi,

            The Atheris horizon scanner has detected an issue with the %s scraper.

            Issue: %s
            Publication URL: %s

            Please check the website and update the PDF selector in the Admin UI if needed.

            %s/admin/regulators

            — Atheris Platform
            """.formatted(regulatorName, reason, publicationUrl, baseUrl);

        send(toEmail, subject, body);
    }

    /**
     * Notify a tenant user that an obligation they classified has changed.
     * Trigger: ClassificationService detects a diff after re-classification.
     */
    public void sendChangeNotification(String toEmail, String toName,
                                        String instrumentTitle, ObligationChange change,
                                        String currentClassification, String reviewLink) {
        String subject = "Update: " + instrumentTitle + " — action may be required";
        String body = """
            Hi %s,

            A regulatory obligation you have classified has been updated on the Atheris platform.

            Obligation: %s
            Your classification: %s
            Change severity: %s

            What changed:
            %s

            Please review your classification and confirm it is still correct.

            Review update: %s

            — The Atheris Platform
            """.formatted(toName, instrumentTitle, currentClassification,
                change.getChangeSeverity(), change.getChangeSummary(), reviewLink);

        send(toEmail, subject, body);
    }

    /**
     * Notify a tenant when an obligation they classified has been superseded.
     * Trigger: obligation.superseded webhook event.
     */
    public void sendSupersededNotification(String toEmail, String toName,
                                            String oldTitle, String newTitle,
                                            String reviewLink) {
        String subject = "Regulatory update: " + oldTitle + " has been superseded";
        String body = """
            Hi %s,

            An obligation you have classified has been withdrawn and replaced.

            Old: %s
            New: %s

            You may wish to:
              1. Review your classification against the new obligation
              2. Update any controls linked to the old obligation

            Review new obligation: %s

            — The Atheris Platform
            """.formatted(toName, oldTitle, newTitle, reviewLink);

        send(toEmail, subject, body);
    }

    private void send(String to, String subject, String body) {
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(message);
            log.info("Email sent to {}: {}", to, subject);
        } catch (Exception e) {
            // Email must never crash the main operation
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }
}
