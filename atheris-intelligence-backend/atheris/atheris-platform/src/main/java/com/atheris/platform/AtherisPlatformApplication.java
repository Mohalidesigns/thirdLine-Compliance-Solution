package com.atheris.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AtherisPlatformApplication {
    public static void main(String[] args) {
        SpringApplication.run(AtherisPlatformApplication.class, args);
    }
}
