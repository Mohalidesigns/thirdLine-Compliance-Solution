package com.atheris.compliance.intelligence.backend.shared.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Component @Slf4j
public class ModelHealthTracker {

    @Value("${atheris.ai.cooldown-initial-ms:300000}")
    private long cooldownInitialMs;

    @Value("${atheris.ai.cooldown-max-ms:3600000}")
    private long cooldownMaxMs;

    @Value("${atheris.ai.cooldown-multiplier:3}")
    private int cooldownMultiplier;

    private final ConcurrentHashMap<String, ModelHealth> healthMap = new ConcurrentHashMap<>();

    public boolean isAvailable(String modelName) {
        ModelHealth health = healthMap.get(modelName);
        if (health == null) return true;
        if (health.active) return true;
        if (Instant.now().isAfter(health.inactiveUntil)) {
            log.info("[ModelHealth] Model {} cooldown EXPIRED → available again", modelName);
            health.active = true;
            health.consecutiveFailures = 0;
            return true;
        }
        long remainingMs = Instant.now().until(health.inactiveUntil, java.time.temporal.ChronoUnit.MILLIS);
        log.info("[ModelHealth] Model {} INACTIVE (cooldown {}s remaining)", modelName, remainingMs / 1000);
        return false;
    }

    public void recordSuccess(String modelName) {
        ModelHealth health = healthMap.computeIfAbsent(modelName, k -> new ModelHealth());
        health.active = true;
        health.consecutiveFailures = 0;
        health.inactiveUntil = null;
        log.info("[ModelHealth] Model {} → ACTIVE", modelName);
    }

    public void recordRateLimit(String modelName) {
        ModelHealth health = healthMap.computeIfAbsent(modelName, k -> new ModelHealth());
        health.consecutiveFailures++;
        long cooldown = calculateCooldown(health.consecutiveFailures);
        health.inactiveUntil = Instant.now().plusMillis(cooldown);
        health.active = false;
        log.warn("[ModelHealth] Model {} → INACTIVE (rate limit, cooldown={}min, failure #{})",
            modelName, cooldown / 60000, health.consecutiveFailures);
    }

    public void recordError(String modelName) {
        ModelHealth health = healthMap.computeIfAbsent(modelName, k -> new ModelHealth());
        health.consecutiveFailures++;
        long cooldown = Math.min(cooldownInitialMs, cooldownMaxMs);
        health.inactiveUntil = Instant.now().plusMillis(cooldown);
        health.active = false;
        log.warn("[ModelHealth] Model {} → INACTIVE (error, cooldown={}min, failure #{})",
            modelName, cooldown / 60000, health.consecutiveFailures);
    }

    public List<String> getAvailableModels(List<String> priority) {
        List<String> available = new ArrayList<>();
        for (String name : priority) {
            if (isAvailable(name)) {
                available.add(name);
            }
        }
        return available;
    }

    private long calculateCooldown(int consecutiveFailures) {
        long cooldown = cooldownInitialMs;
        for (int i = 1; i < consecutiveFailures; i++) {
            cooldown *= cooldownMultiplier;
            if (cooldown >= cooldownMaxMs) {
                cooldown = cooldownMaxMs;
                break;
            }
        }
        return cooldown;
    }

    private static class ModelHealth {
        volatile boolean active = true;
        volatile Instant inactiveUntil;
        volatile int consecutiveFailures = 0;
    }
}
