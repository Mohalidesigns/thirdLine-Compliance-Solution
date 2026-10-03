package com.atheris.compliance.intelligence.backend.shared.ai;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class ReasoningToggleInterceptorTest {

    @Test
    void addsReasoningSwitch() {
        byte[] out = ReasoningToggleInterceptor.withReasoning(
            "{\"model\":\"m\",\"messages\":[]}".getBytes(StandardCharsets.UTF_8), false);
        String json = new String(out, StandardCharsets.UTF_8);
        assertTrue(json.contains("\"reasoning\":{\"enabled\":false}"), json);
        assertTrue(json.contains("\"model\":\"m\""), json);
    }

    @Test
    void leavesExistingReasoningAndNonJsonAlone() {
        byte[] withReasoning = "{\"reasoning\":{\"effort\":\"low\"}}".getBytes(StandardCharsets.UTF_8);
        assertSame(withReasoning, ReasoningToggleInterceptor.withReasoning(withReasoning, false));
        byte[] notJson = "hello".getBytes(StandardCharsets.UTF_8);
        assertSame(notJson, ReasoningToggleInterceptor.withReasoning(notJson, false));
    }

    @Test
    void flagParsing() {
        assertNull(AiConfig.parseFlag(null));
        assertNull(AiConfig.parseFlag(" "));
        assertEquals(Boolean.FALSE, AiConfig.parseFlag("false"));
        assertEquals(Boolean.TRUE, AiConfig.parseFlag("TRUE"));
        assertThrows(IllegalStateException.class, () -> AiConfig.parseFlag("off"));
    }
}
