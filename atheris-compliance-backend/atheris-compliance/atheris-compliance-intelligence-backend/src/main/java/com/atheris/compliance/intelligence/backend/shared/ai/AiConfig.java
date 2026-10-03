package com.atheris.compliance.intelligence.backend.shared.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestClient;

/**
 * Primary + fallback chat models for {@link AiClient}.
 *
 * Both are derived from Spring AI's auto-configured OpenAI-compatible model
 * (pointed at OpenRouter via {@code spring.ai.openai.*}), so they share the API
 * key, base URL, temperature and token limit, and differ only in the model id
 * ({@code atheris.ai.primary-model} / {@code atheris.ai.fallback-model}, both
 * env-driven). Credentials live in env vars only.
 *
 * {@code atheris.ai.reasoning-enabled} ({@code AI_REASONING_ENABLED}): unset sends
 * nothing (provider default); {@code true}/{@code false} adds OpenRouter's
 * {@code "reasoning": {"enabled": ...}} to every request of both models — see
 * {@link ReasoningToggleInterceptor} for why this is not done via {@code extraBody}.
 */
@Configuration @Slf4j
public class AiConfig {

    @Value("${atheris.ai.primary-model}")
    private String primaryModelName;

    @Value("${atheris.ai.fallback-model}")
    private String fallbackModelName;

    @Value("${atheris.ai.reasoning-enabled:}")
    private String reasoningEnabled;

    @Bean("primaryChatModel")
    @Primary
    public ChatModel primaryChatModel(OpenAiChatModel openAiChatModel, OpenAiApi openAiApi,
                                      ObjectProvider<RestClient.Builder> restClientBuilder) {
        return withModel(openAiChatModel, apiFor(openAiApi, restClientBuilder), primaryModelName);
    }

    @Bean("fallbackChatModel")
    public ChatModel fallbackChatModel(OpenAiChatModel openAiChatModel, OpenAiApi openAiApi,
                                       ObjectProvider<RestClient.Builder> restClientBuilder) {
        return withModel(openAiChatModel, apiFor(openAiApi, restClientBuilder), fallbackModelName);
    }

    /** The auto-configured API, or a copy whose RestClient adds the reasoning switch when configured. */
    private OpenAiApi apiFor(OpenAiApi base, ObjectProvider<RestClient.Builder> restClientBuilder) {
        Boolean flag = parseFlag(reasoningEnabled);
        if (flag == null) return null;
        log.info("[AiConfig] Sending \"reasoning\": {\"enabled\": {}} on every chat request", flag);
        RestClient.Builder builder = restClientBuilder.getIfAvailable(RestClient::builder)
            .requestInterceptor(new ReasoningToggleInterceptor(flag, "/chat/completions"));
        return base.mutate().restClientBuilder(builder).build();
    }

    static Boolean parseFlag(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim();
        if ("true".equalsIgnoreCase(v)) return Boolean.TRUE;
        if ("false".equalsIgnoreCase(v)) return Boolean.FALSE;
        throw new IllegalStateException("atheris.ai.reasoning-enabled must be true, false or unset, got: " + raw);
    }

    private static ChatModel withModel(OpenAiChatModel base, OpenAiApi api, String modelName) {
        OpenAiChatOptions options = ((OpenAiChatOptions) base.getDefaultOptions()).copy();
        options.setModel(modelName);
        OpenAiChatModel.Builder builder = base.mutate().defaultOptions(options);
        if (api != null) builder.openAiApi(api);
        return builder.build();
    }
}
