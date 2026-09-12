package com.atheris.compliance.intelligence.backend.shared.ai;

import com.google.genai.Client;
import io.micrometer.observation.ObservationRegistry;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class AiConfig {

    @Value("${atheris.ai.primary-model:gemini-3.1-flash-lite}")
    private String primaryModelName;

    @Value("${atheris.ai.fallback-model:gemini-3.5-flash-lite}")
    private String fallbackModelName;

    @Bean("primaryChatModel")
    public GoogleGenAiChatModel primaryChatModel(ObservationRegistry observationRegistry) {
        String apiKey = System.getenv("GEMINI_API_KEY");
        Client client = Client.builder().apiKey(apiKey).build();

        return new GoogleGenAiChatModel(
            client,
            GoogleGenAiChatOptions.builder()
                .model(primaryModelName)
                .temperature(0.0)
                .maxOutputTokens(3500)
                .build(),
            ToolCallingManager.builder().build(),
            new RetryTemplate(),
            observationRegistry);
    }

    @Bean("fallbackChatModel")
    @Primary
    public GoogleGenAiChatModel fallbackChatModel(ObservationRegistry observationRegistry) {
        String apiKey = System.getenv("GEMINI_API_KEY");
        Client client = Client.builder().apiKey(apiKey).build();

        return new GoogleGenAiChatModel(
            client,
            GoogleGenAiChatOptions.builder()
                .model(fallbackModelName)
                .temperature(0.0)
                .maxOutputTokens(3500)
                .build(),
            ToolCallingManager.builder().build(),
            new RetryTemplate(),
            observationRegistry);
    }
}
