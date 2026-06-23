package com.atheris.platform.shared.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Component;

@Component @Slf4j @RequiredArgsConstructor
public class AiClient {

    private final ChatModel chatModel;

    public String complete(String promptText) {
        try {
            Prompt prompt = new Prompt(promptText);
            ChatResponse response = chatModel.call(prompt);
            return response.getResult().getOutput().getText();
        } catch (Exception e) {
            log.error("AI call failed: {}", e.getMessage());
            throw new RuntimeException("AI classification failed", e);
        }
    }
}
