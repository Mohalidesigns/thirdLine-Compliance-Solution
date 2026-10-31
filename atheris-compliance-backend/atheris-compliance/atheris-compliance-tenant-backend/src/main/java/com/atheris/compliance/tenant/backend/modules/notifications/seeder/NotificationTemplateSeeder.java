package com.atheris.compliance.tenant.backend.modules.notifications.seeder;

import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationTemplateService;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
@Order(21)
public class NotificationTemplateSeeder implements ApplicationRunner {

    private final NotificationTemplateService templates;

    private static final String ESCALATION_DETAILS = "Act/Obligation: {{actObligation}}\n"
        + "Regulator: {{regulator}}\n"
        + "Responsible person: {{responsiblePerson}}";

    private static final String CONTROL_DETAILS = "Control: {{controlName}} ({{controlNumber}})\n"
        + "Act/Regulation: {{actName}}\n"
        + "Regulator: {{regulator}}\n"
        + "Responsible person: {{responsiblePerson}}\n"
        + "Owner: {{ownerName}}\n"
        + "Due date: {{dueDate}}\n"
        + "Test frequency: {{testFrequency}}";

    private static final String FILING_DETAILS = "{{returnName}}\n"
        + "Act/Obligation: {{actObligation}}\n"
        + "Regulator: {{regulator}}\n"
        + "Responsible person: {{responsiblePerson}}\n"
        + "Due date: {{dueDate}}\n"
        + "Period: {{period}}\n";

    @Override
    public void run(ApplicationArguments args) {
        try {
            templates.ensure(EscalationConstants.KEY_RETURN_APPROACHING,
                "Upcoming filing: {{returnName}}",
                "Hi {{recipientName}},\n\n{{returnName}} ({{period}}) is due on {{dueDate}}, {{daysLeft}} day(s) away "
                    + "— please prepare and submit the filing.\n\n" + ESCALATION_DETAILS, true);
            templates.ensure(EscalationConstants.KEY_RETURN_FILING_REQUEST,
                "Action required: filing data for {{returnName}}",
                "Hi {{recipientName}},\n\n{{returnName}} ({{period}}) is due on {{dueDate}}{{timing}} "
                    + "— please prepare and submit the filing.\n\n" + ESCALATION_DETAILS, true);
            templates.ensure(EscalationConstants.KEY_RETURN_REMINDER,
                "Reminder: {{returnName}} due {{dueDate}}",
                "Hi {{recipientName}},\n\nThis is a reminder that {{returnName}} ({{period}}) is still due on {{dueDate}} "
                    + "({{daysLeft}} day(s) left) — please submit to avoid escalation.\n\n" + ESCALATION_DETAILS, true);
            templates.ensure(EscalationConstants.KEY_RETURN_OVERDUE,
                "[L{{level}}] Overdue filing: {{returnName}}",
                "{{returnName}} ({{period}}) was due on {{dueDate}} and is {{daysLate}} day(s) overdue.\n\n"
                    + ESCALATION_DETAILS + "\nEscalated to level {{level}}.", true);
            templates.upgrade(EscalationConstants.KEY_CONTROL_APPROACHING,
                "Hi {{recipientName}},\n\nA test of control \"{{controlName}}\" is due on {{dueDate}}, "
                    + "{{daysLeft}} day(s) away. Please perform the test.",
                "Upcoming control test: {{controlName}}",
                "Hi {{recipientName}},\n\nA test of control \"{{controlName}}\" is due on {{dueDate}} "
                    + "({{daysLeft}} day(s) left) — please perform the test.\n\n" + CONTROL_DETAILS, true);
            templates.require(EscalationConstants.KEY_CONTROL_REMINDER,
                "Reminder: test control {{controlName}}",
                "Hi {{recipientName}},\n\nThis is a reminder that the test of control \"{{controlName}}\" is still "
                    + "due on {{dueDate}} ({{daysLeft}} day(s) left) — please record the result.\n\n" + CONTROL_DETAILS, true);
            templates.require(EscalationConstants.KEY_CONTROL_REQUEST,
                "Action required: test control {{controlName}}",
                "Hi {{recipientName}},\n\nPlease perform the test of control \"{{controlName}}\" and record the "
                    + "result using the link below.\n\n" + CONTROL_DETAILS, true);
            templates.upgrade(EscalationConstants.KEY_CONTROL_OVERDUE,
                "The test of control \"{{controlName}}\" was due on {{dueDate}} and is {{daysLate}} day(s) overdue. "
                    + "Escalated to level {{level}}.",
                "[L{{level}}] Overdue control test: {{controlName}}",
                "The test of control \"{{controlName}}\" was due on {{dueDate}} and is {{daysLate}} day(s) overdue.\n\n"
                    + CONTROL_DETAILS + "\n\nEscalated to level {{level}}.", true);
            templates.require(EscalationConstants.KEY_CONTROL_DATA_REVIEW,
                "Control test submitted: {{controlName}}",
                CONTROL_DETAILS + "\n\nA test result ({{result}}) was submitted by {{responsiblePerson}} and is waiting "
                    + "for your review.", false);
            templates.require(EscalationConstants.KEY_CONTROL_DATA_RECEIPT,
                "Received: {{controlName}} test result",
                CONTROL_DETAILS + "\n\nYour test result has been recorded and is being reviewed.", false);
            templates.require(EscalationConstants.KEY_CONTROL_CHANGES_REQUESTED,
                "Changes requested: {{controlName}} test",
                CONTROL_DETAILS + "\n\n{{reviewNotes}}\n\nPlease review and record the test again using the link below.", false);
            templates.ensure(EscalationConstants.KEY_RETURN_REPORT_REVIEW,
                "Review required: {{returnName}}", FILING_DETAILS, false);
            templates.ensure(EscalationConstants.KEY_RETURN_DATA_REVIEW,
                "Filing data submitted: {{returnName}}", FILING_DETAILS, false);
            templates.ensure(EscalationConstants.KEY_RETURN_DATA_RECEIPT,
                "Received: {{returnName}} filing data",
                FILING_DETAILS + "\nYour submission has been received and is being reviewed.\n", false);
            templates.ensure(EscalationConstants.KEY_RETURN_CHANGES_REQUESTED,
                "Changes requested: {{returnName}}",
                FILING_DETAILS + "\nPlease review the requested changes and resubmit the draft.\n", false);
            log.info("[TemplateSeeder] notification templates ensured");
        } catch (Throwable e) {
            log.error("[TemplateSeeder] failed: {}", e.getMessage(), e);
        }
    }
}
