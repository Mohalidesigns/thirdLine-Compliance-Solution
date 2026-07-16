package com.atheris.compliance.tenant.backend.modules.webhook;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/webhooks")
@Slf4j
@RequiredArgsConstructor
public class WebhookReceiverController {

    private final WebhookReceiverService service;

    @PostMapping("/receive")
    public ResponseEntity<Map<String, String>> receive(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Atheris-Signature", required = false) String signature,
            @RequestHeader(value = "X-Webhook-Event-ID", required = false) String eventId) {
        Map<String, String> result = service.process(rawBody, signature, eventId);
        if (result.containsKey("error")) {
            return ResponseEntity.status(result.get("error").equals("Invalid signature") ? 401 : 500)
                .body(result);
        }
        return ResponseEntity.ok(result);
    }
}
