package com.atheris.compliance.intelligence.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class AtherisIntelligenceBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(AtherisIntelligenceBackendApplication.class, args);
    }
}
