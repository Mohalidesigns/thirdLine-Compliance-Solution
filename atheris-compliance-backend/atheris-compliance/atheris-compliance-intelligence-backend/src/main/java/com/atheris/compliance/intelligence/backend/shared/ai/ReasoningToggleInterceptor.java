package com.atheris.compliance.intelligence.backend.shared.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

import java.io.IOException;

/**
 * Adds OpenRouter's unified reasoning switch — {@code "reasoning": {"enabled": <flag>}} —
 * to every chat-completions request body.
 *
 * Why an interceptor: Spring AI 1.1.0's {@code OpenAiChatOptions.extraBody} is dropped
 * when the options are merged into {@code ChatCompletionRequest} (ModelOptionsUtils.merge
 * keeps only {@code @JsonProperty} fields, and the request record's {@code extraBody}
 * component has none), so the option never reaches the wire. Verified against a local
 * capture server. A request that already carries a {@code reasoning} field is left alone.
 */
@Slf4j
public class ReasoningToggleInterceptor implements ClientHttpRequestInterceptor {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final boolean enabled;
    private final String completionsPath;

    public ReasoningToggleInterceptor(boolean enabled, String completionsPath) {
        this.enabled = enabled;
        this.completionsPath = completionsPath;
    }

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        if (HttpMethod.POST.equals(request.getMethod()) && body.length > 0
                && request.getURI().getPath().endsWith(completionsPath)) {
            byte[] rewritten = withReasoning(body, enabled);
            if (rewritten != body) {
                request.getHeaders().setContentLength(rewritten.length);
                return execution.execute(request, rewritten);
            }
        }
        return execution.execute(request, body);
    }

    /** Returns {@code body} with the reasoning switch added, or {@code body} itself when not JSON / already set. */
    static byte[] withReasoning(byte[] body, boolean enabled) {
        try {
            JsonNode node = MAPPER.readTree(body);
            if (!(node instanceof ObjectNode obj) || obj.has("reasoning")) return body;
            obj.putObject("reasoning").put("enabled", enabled);
            return MAPPER.writeValueAsBytes(obj);
        } catch (IOException e) {
            log.debug("[AiConfig] Chat request body is not JSON, reasoning switch not applied: {}", e.getMessage());
            return body;
        }
    }
}
