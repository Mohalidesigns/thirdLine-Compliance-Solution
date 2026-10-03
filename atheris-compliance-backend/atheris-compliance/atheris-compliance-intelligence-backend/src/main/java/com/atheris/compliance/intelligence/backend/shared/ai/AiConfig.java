package com.atheris.compliance.intelligence.backend.shared.ai;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Primary + fallback chat models for {@link AiClient}.
 *
 * Both are derived from Spring AI's auto-configured OpenAI-compatible model
 * (pointed at OpenRouter via {@code spring.ai.openai.*}), so they share the API
 * key, base URL, temperature and token limit, and differ only in the model id
 * ({@code atheris.ai.primary-model} / {@code atheris.ai.fallback-model}, both
 * env-driven). Credentials live in env vars only.
 */
@Configuration
public class AiConfig {

    @Value("${atheris.ai.primary-model}")
    private String primaryModelName;

    @Value("${atheris.ai.fallback-model}")
    private String fallbackModelName;

    @Bean("primaryChatModel")
    @Primary
    public ChatModel primaryChatModel(OpenAiChatModel openAiChatModel) {
        return withModel(openAiChatModel, primaryModelName);
    }

    @Bean("fallbackChatModel")
    public ChatModel fallbackChatModel(OpenAiChatModel openAiChatModel) {
        return withModel(openAiChatModel, fallbackModelName);
    }

    private static ChatModel withModel(OpenAiChatModel base, String modelName) {
        OpenAiChatOptions options = ((OpenAiChatOptions) base.getDefaultOptions()).copy();
        options.setModel(modelName);
        return base.mutate().defaultOptions(options).build();
    }
}
