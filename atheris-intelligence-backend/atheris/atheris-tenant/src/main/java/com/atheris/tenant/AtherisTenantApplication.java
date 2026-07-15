package com.atheris.tenant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AtherisTenantApplication {
    public static void main(String[] args) {
        SpringApplication.run(AtherisTenantApplication.class, args);
    }
}
