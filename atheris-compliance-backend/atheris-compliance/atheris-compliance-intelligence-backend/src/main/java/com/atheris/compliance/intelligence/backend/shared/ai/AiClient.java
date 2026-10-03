package com.atheris.compliance.intelligence.backend.shared.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;

/**
 * Provider-agnostic AI entry point (Spring AI {@link ChatModel}; currently an
 * OpenAI-compatible client pointed at OpenRouter — see {@link AiConfig}).
 *
 * Tries the primary model, then the fallback. A model that is rate-limited
 * (429/503) or errors goes into an exponential cooldown tracked by
 * {@link ModelHealthTracker}; while every model is cooling down, calls fail fast
 * with {@link #COOLDOWN_MESSAGE} so queue processors can defer the job instead of
 * burning a retry attempt.
 */
@Component @Slf4j
public class AiClient {

    /** Message of the exception thrown when every model is in cooldown. */
    public static final String COOLDOWN_MESSAGE = "All AI models inactive (cooldown active)";

    private final ChatModel primaryModel;
    private final ChatModel fallbackModel;
    private final ModelHealthTracker tracker;
    private final String primaryName;
    private final String fallbackName;

    @Value("${atheris.ai.fallback-enabled:true}")
    private boolean fallbackEnabled;

    public AiClient(
            @Qualifier("primaryChatModel") ChatModel primaryModel,
            @Qualifier("fallbackChatModel") ChatModel fallbackModel,
            ModelHealthTracker tracker,
            @Value("${atheris.ai.primary-model}") String primaryName,
            @Value("${atheris.ai.fallback-model}") String fallbackName) {
        this.primaryModel = primaryModel;
        this.fallbackModel = fallbackModel;
        this.tracker = tracker;
        this.primaryName = primaryName;
        this.fallbackName = fallbackName;
    }

    /** True when at least one model is outside its cooldown window. */
    public boolean hasAvailableModel() {
        return !tracker.getAvailableModels(modelPriority()).isEmpty();
    }

    /** True when {@code e} (or any cause) is the all-models-in-cooldown failure. */
    public static boolean isCooldown(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t.getMessage() != null && t.getMessage().contains(COOLDOWN_MESSAGE)) return true;
        }
        return false;
    }

    public String complete(String promptText) {
        List<String> available = tracker.getAvailableModels(modelPriority());
        if (available.isEmpty()) {
            throw new RuntimeException(COOLDOWN_MESSAGE);
        }

        log.info("[AiClient] Calling models: {}", available);
        Exception lastException = null;
        for (String modelName : available) {
            ChatModel model = resolveModel(modelName);
            if (model == null) {
                log.warn("[AiClient] Model {} not configured, skipping", modelName);
                continue;
            }
            try {
                log.info("[AiClient] Trying {}", modelName);
                String result = callModel(model, promptText, modelName);
                tracker.recordSuccess(modelName);
                log.info("[AiClient] {} succeeded", modelName);
                return result;
            } catch (Exception e) {
                lastException = e;
                recordFailure(modelName, e, "");
            }
        }
        log.error("AI call failed: {}", lastException != null ? lastException.getMessage() : "no model configured");
        throw new RuntimeException("All AI models unavailable", lastException);
    }

    public <T> T completeEntity(String promptText, Class<T> responseType) {
        List<String> available = tracker.getAvailableModels(modelPriority());
        if (available.isEmpty()) {
            throw new RuntimeException(COOLDOWN_MESSAGE);
        }

        log.info("[AiClient] Calling models (structured): {}", available);
        BeanOutputConverter<T> converter = new BeanOutputConverter<>(responseType);
        Exception lastException = null;
        for (String modelName : available) {
            ChatModel model = resolveModel(modelName);
            if (model == null) {
                log.warn("[AiClient] Model {} not configured, skipping", modelName);
                continue;
            }
            try {
                log.info("[AiClient] Trying {} (structured)", modelName);
                // Exactly ONE model call: append the converter's format instructions
                // ourselves (what ChatClient's ChatModelCallAdvisor would do) and convert
                // the single completion. ChatClient's CallResponseSpec.content() and
                // .entity() each issue their own HTTP request in Spring AI 1.1.0.
                String raw = callModel(model, promptText + System.lineSeparator() + converter.getFormat(), modelName);
                log.debug("[AiClient] {} raw (first 500): {}", modelName,
                    raw.substring(0, Math.min(raw.length(), 500)));
                T result = converter.convert(raw);
                if (result == null) {
                    throw new RuntimeException(modelName + " returned a completion that did not convert to "
                        + responseType.getSimpleName());
                }
                tracker.recordSuccess(modelName);
                log.info("[AiClient] {} succeeded (structured)", modelName);
                return result;
            } catch (Exception e) {
                lastException = e;
                recordFailure(modelName, e, " (structured)");
            }
        }
        log.error("AI structured call failed: {}", lastException != null ? lastException.getMessage() : "no model configured");
        throw new RuntimeException("All AI models unavailable", lastException);
    }

    private List<String> modelPriority() {
        if (!fallbackEnabled || fallbackName == null || fallbackName.isBlank()
                || fallbackName.equals(primaryName)) {
            return List.of(primaryName);
        }
        return List.of(primaryName, fallbackName);
    }

    private ChatModel resolveModel(String modelName) {
        if (modelName.equals(primaryName)) return primaryModel;
        if (modelName.equals(fallbackName)) return fallbackModel;
        return null;
    }

    private void recordFailure(String modelName, Exception e, String kind) {
        if (isRateLimit(e)) {
            tracker.recordRateLimit(modelName);
            log.warn("[AiClient] {} RATE-LIMITED (503/429){}, going inactive: {}", modelName, kind, e.getMessage());
        } else {
            tracker.recordError(modelName);
            log.warn("[AiClient] {} FAILED{}: {}", modelName, kind, e.getMessage());
        }
    }

    private String callModel(ChatModel model, String promptText, String modelName) {
        Prompt prompt = new Prompt(promptText);
        ChatResponse response = model.call(prompt);
        String text = response == null || response.getResult() == null || response.getResult().getOutput() == null
            ? null : response.getResult().getOutput().getText();
        if (text == null || text.isBlank()) {
            // A model can return an empty completion (content filter, token
            // limit reached while still emitting reasoning, provider hiccup).
            // Fail loudly here rather than handing null to every caller.
            throw new RuntimeException(modelName + " returned an empty completion");
        }
        return text;
    }

    private boolean isRateLimit(Exception e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof RestClientResponseException http) {
                int code = http.getStatusCode().value();
                if (code == 429 || code == 503) return true;
            }
        }
        String msg = e.getMessage();
        if (msg == null) return false;
        String lower = msg.toLowerCase();
        return lower.contains("429") || lower.contains("503")
            || lower.contains("rate limit") || lower.contains("high demand")
            || lower.contains("quota exceeded") || lower.contains("resource exhausted");
    }
}
