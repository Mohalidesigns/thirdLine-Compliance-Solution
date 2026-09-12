package com.atheris.compliance.intelligence.backend.shared.ai;

import com.google.genai.errors.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.ChatModelCallAdvisor;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component @Slf4j
public class AiClient {

    private final ChatModel primaryModel;
    private final ChatModel fallbackModel;
    private final ModelHealthTracker tracker;
    private final List<String> modelPriority;

    @Value("${atheris.ai.fallback-enabled:true}")
    private boolean fallbackEnabled;

    public AiClient(
            @Qualifier("primaryChatModel") ChatModel primaryModel,
            @Qualifier("fallbackChatModel") ChatModel fallbackModel,
            ModelHealthTracker tracker,
            @Value("${atheris.ai.primary-model:gemini-3.1-flash-lite}") String primaryName,
            @Value("${atheris.ai.fallback-model:gemini-3.5-flash-lite}") String fallbackName) {
        this.primaryModel = primaryModel;
        this.fallbackModel = fallbackModel;
        this.tracker = tracker;
        this.modelPriority = List.of(primaryName, fallbackName);
    }

    public String complete(String promptText) {
        List<String> available = tracker.getAvailableModels(modelPriority);
        if (available.isEmpty()) {
            throw new RuntimeException("All AI models inactive (cooldown active)");
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
                if (isRateLimit(e)) {
                    tracker.recordRateLimit(modelName);
                    log.warn("[AiClient] {} RATE-LIMITED (503/429), going inactive: {}", modelName, e.getMessage());
                } else {
                    tracker.recordError(modelName);
                    log.warn("[AiClient] {} FAILED: {}", modelName, e.getMessage());
                }
            }
        }
        throw new RuntimeException("All AI models unavailable", lastException);
    }

    public <T> T completeEntity(String promptText, Class<T> responseType) {
        List<String> available = tracker.getAvailableModels(modelPriority);
        if (available.isEmpty()) {
            throw new RuntimeException("All AI models inactive (cooldown active)");
        }

        log.info("[AiClient] Calling models (structured): {}", available);
        Exception lastException = null;
        for (String modelName : available) {
            ChatModel model = resolveModel(modelName);
            if (model == null) {
                log.warn("[AiClient] Model {} not configured, skipping", modelName);
                continue;
            }
            try {
                log.info("[AiClient] Trying {} (structured)", modelName);
                ChatClient client = ChatClient.builder(model)
                    .defaultAdvisors(ChatModelCallAdvisor.builder().chatModel(model).build())
                    .build();
                ChatClient.CallResponseSpec responseSpec = client.prompt().user(promptText).call();
                String raw = responseSpec.content();
                log.debug("[AiClient] {} raw (first 500): {}", modelName,
                    raw != null ? raw.substring(0, Math.min(raw.length(), 500)) : "null");
                T result = responseSpec.entity(responseType);
                tracker.recordSuccess(modelName);
                log.info("[AiClient] {} succeeded (structured)", modelName);
                return result;
            } catch (Exception e) {
                lastException = e;
                if (isRateLimit(e)) {
                    tracker.recordRateLimit(modelName);
                    log.warn("[AiClient] {} RATE-LIMITED (503/429), going inactive: {}", modelName, e.getMessage());
                } else {
                    tracker.recordError(modelName);
                    log.warn("[AiClient] {} FAILED (structured): {}", modelName, e.getMessage());
                }
            }
        }
        throw new RuntimeException("All AI models unavailable", lastException);
    }

    private ChatModel resolveModel(String modelName) {
        if (modelName.equals(modelPriority.get(0))) return primaryModel;
        if (modelName.equals(modelPriority.get(1))) return fallbackModel;
        return null;
    }

    private String callModel(ChatModel model, String promptText, String modelName) {
        Prompt prompt = new Prompt(promptText);
        ChatResponse response = model.call(prompt);
        String text = response.getResult().getOutput().getText();
        if (text == null || text.isBlank()) {
            throw new RuntimeException(modelName + " returned empty response");
        }
        return text;
    }

    private boolean isRateLimit(Exception e) {
        if (e instanceof ApiException apiEx) {
            int code = apiEx.code();
            if (code == 429 || code == 503) return true;
        }
        Throwable cause = e.getCause();
        while (cause != null) {
            if (cause instanceof ApiException apiEx) {
                int code = apiEx.code();
                if (code == 429 || code == 503) return true;
            }
            cause = cause.getCause();
        }
        String msg = e.getMessage();
        if (msg == null) return false;
        String lower = msg.toLowerCase();
        return lower.contains("429") || lower.contains("503")
            || lower.contains("rate limit") || lower.contains("high demand")
            || lower.contains("quota exceeded") || lower.contains("resource exhausted");
    }
}
