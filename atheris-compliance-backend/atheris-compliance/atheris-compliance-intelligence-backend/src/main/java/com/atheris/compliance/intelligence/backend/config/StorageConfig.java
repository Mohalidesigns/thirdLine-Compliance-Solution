package com.atheris.compliance.intelligence.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AnonymousCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class StorageConfig {

    @Value("${atheris.storage.region:${AWS_REGION:af-south-1}}")
    private String awsRegion;

    @Bean
    @ConditionalOnProperty(name = "atheris.storage.provider", havingValue = "s3", matchIfMissing = true)
    public S3Client s3Client() {
        return S3Client.builder()
            .region(Region.of(awsRegion))
            .credentialsProvider(AnonymousCredentialsProvider.create())
            .build();
    }
}
