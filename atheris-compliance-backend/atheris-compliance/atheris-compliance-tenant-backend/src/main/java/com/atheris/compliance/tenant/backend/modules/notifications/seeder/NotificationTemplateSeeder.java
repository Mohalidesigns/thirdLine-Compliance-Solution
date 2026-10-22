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

    @Override
    public void run(ApplicationArguments args) {
        try {
            templates.ensure(EscalationConstants.KEY_RETURN_APPROACHING,
                "Upcoming filing: {{returnName}}",
                "Hi {{recipientName}},\n\n{{returnName}} ({{period}}) is due on {{dueDate}}, {{daysLeft}} day(s) away. "
                    + "Please start gathering the data and submit the filing.\n\nRegulator: {{regulator}}\nAct: {{actName}}", true);
            templates.ensure(EscalationConstants.KEY_RETURN_REMINDER,
                "Reminder: {{returnName}} due {{dueDate}}",
                "Hi {{recipientName}},\n\nThis is a reminder that {{returnName}} ({{period}}) is still due on {{dueDate}} "
                    + "({{daysLeft}} day(s) left). Please submit to avoid escalation.", true);
            templates.ensure(EscalationConstants.KEY_RETURN_OVERDUE,
                "[L{{level}}] Overdue filing: {{returnName}}",
                "{{returnName}} ({{period}}) was due on {{dueDate}} and is {{daysLate}} day(s) overdue. "
                    + "Escalated to level {{level}}.", true);
            templates.ensure(EscalationConstants.KEY_RETURN_GATHERING,
                "Action required: prepare {{returnName}}",
                "Hi {{recipientName}},\n\nPlease prepare the filing for {{returnName}} ({{period}}), due on {{dueDate}}. "
                    + "Share the data with the compliance team using the link below.\n\n"
                    + "Regulator: {{regulator}}\nAct: {{actName}}", true);
            templates.ensure(EscalationConstants.KEY_CONTROL_APPROACHING,
                "Upcoming control test: {{controlName}}",
                "Hi {{recipientName}},\n\nA test of control \"{{controlName}}\" is due on {{dueDate}}, "
                    + "{{daysLeft}} day(s) away. Please perform the test.", true);
            templates.ensure(EscalationConstants.KEY_CONTROL_OVERDUE,
                "[L{{level}}] Overdue control test: {{controlName}}",
                "The test of control \"{{controlName}}\" was due on {{dueDate}} and is {{daysLate}} day(s) overdue. "
                    + "Escalated to level {{level}}.", true);
            log.info("[TemplateSeeder] notification templates ensured");
        } catch (Throwable e) {
            log.error("[TemplateSeeder] failed: {}", e.getMessage(), e);
        }
    }
}
