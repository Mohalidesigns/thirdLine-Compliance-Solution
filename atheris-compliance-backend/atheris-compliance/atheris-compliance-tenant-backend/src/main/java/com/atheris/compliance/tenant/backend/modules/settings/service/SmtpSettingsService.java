package com.atheris.compliance.tenant.backend.modules.settings.service;

import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.settings.dto.SmtpConfigRequest;
import com.atheris.compliance.tenant.backend.modules.settings.dto.SmtpConfigResponse;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import com.atheris.compliance.tenant.backend.shared.util.CryptoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

@Service
@Slf4j
@RequiredArgsConstructor
public class SmtpSettingsService {

    private static final int DEFAULT_PORT = 587;

    private final TenantIdentityService tenantIdentity;
    private final TenantProfileRepository profiles;
    private final CryptoUtil crypto;

    public record Outbound(JavaMailSender sender, String from) {}

    public SmtpConfigResponse get() {
        TenantProfile p = tenantIdentity.currentProfile().orElse(null);
        if (p == null) {
            return SmtpConfigResponse.builder().auth(false).starttls(false).passwordSet(false).build();
        }
        return SmtpConfigResponse.builder()
            .host(p.getSmtpHost())
            .port(p.getSmtpPort())
            .username(p.getSmtpUsername())
            .from(p.getSmtpFrom())
            .auth(Boolean.TRUE.equals(p.getSmtpAuth()))
            .starttls(Boolean.TRUE.equals(p.getSmtpStarttls()))
            .passwordSet(p.getSmtpPasswordEncrypted() != null && !p.getSmtpPasswordEncrypted().isBlank())
            .build();
    }

    @Transactional
    public void save(SmtpConfigRequest req) {
        TenantProfile p = tenantIdentity.currentProfile()
            .orElseThrow(() -> new IllegalStateException("Tenant profile not found"));
        p.setSmtpHost(trim(req.getHost()));
        p.setSmtpPort(req.getPort());
        p.setSmtpUsername(trim(req.getUsername()));
        p.setSmtpAuth(Boolean.TRUE.equals(req.getAuth()));
        p.setSmtpStarttls(Boolean.TRUE.equals(req.getStarttls()));
        p.setSmtpFrom(trim(req.getFrom()));
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            p.setSmtpPasswordEncrypted(crypto.encrypt(req.getPassword()));
        }
        profiles.save(p);
    }

    public Map<String, Object> test(SmtpConfigRequest req) {
        String host = trim(req.getHost());
        if (host == null) {
            return result(false, "Host is required");
        }
        int port = req.getPort() != null ? req.getPort() : DEFAULT_PORT;

        String password = req.getPassword();
        if (password == null || password.isBlank()) {
            password = storedPassword();
        }

        String to = trim(req.getTestTo()) != null ? trim(req.getTestTo()) : trim(req.getFrom());
        if (to == null) {
            return result(false, "A from address (or test recipient) is required to send the test email");
        }

        try {
            JavaMailSenderImpl sender = build(host, port, trim(req.getUsername()), password,
                Boolean.TRUE.equals(req.getAuth()), Boolean.TRUE.equals(req.getStarttls()));
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(trim(req.getFrom()) != null ? trim(req.getFrom()) : to);
            message.setTo(to);
            message.setSubject("Atheris SMTP test");
            message.setText("This is a test email confirming your SMTP configuration works.");
            sender.send(message);
            return result(true, "Connection successful — test email sent to " + to);
        } catch (Exception e) {
            log.warn("SMTP test failed for host {}: {}", host, e.getMessage());
            return result(false, e.getMessage());
        }
    }

    public Outbound outbound() {
        TenantProfile p = tenantIdentity.currentProfile().orElse(null);
        if (p == null || p.getSmtpHost() == null || p.getSmtpHost().isBlank()) {
            return null;
        }
        int port = p.getSmtpPort() != null ? p.getSmtpPort() : DEFAULT_PORT;
        String password = p.getSmtpPasswordEncrypted() != null && !p.getSmtpPasswordEncrypted().isBlank()
            ? crypto.decrypt(p.getSmtpPasswordEncrypted()) : null;
        JavaMailSenderImpl sender = build(p.getSmtpHost(), port, p.getSmtpUsername(), password,
            Boolean.TRUE.equals(p.getSmtpAuth()), Boolean.TRUE.equals(p.getSmtpStarttls()));
        return new Outbound(sender, p.getSmtpFrom());
    }

    private String storedPassword() {
        return tenantIdentity.currentProfile()
            .map(TenantProfile::getSmtpPasswordEncrypted)
            .filter(enc -> !enc.isBlank())
            .map(crypto::decrypt)
            .orElse(null);
    }

    private static JavaMailSenderImpl build(String host, int port, String username, String password,
                                            boolean auth, boolean starttls) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        if (username != null && !username.isBlank()) {
            sender.setUsername(username);
        }
        if (password != null && !password.isBlank()) {
            sender.setPassword(password);
        }
        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", String.valueOf(auth));
        props.put("mail.smtp.starttls.enable", String.valueOf(starttls));
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "10000");
        return sender;
    }

    private static Map<String, Object> result(boolean ok, String message) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", ok);
        out.put("message", message);
        return out;
    }

    private static String trim(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }
}
