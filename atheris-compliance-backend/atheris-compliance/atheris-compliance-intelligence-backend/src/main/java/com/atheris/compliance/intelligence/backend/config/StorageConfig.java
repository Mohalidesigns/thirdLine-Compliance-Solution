package com.atheris.compliance.intelligence.backend.config;

import com.atheris.compliance.common.Constants;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AnonymousCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class StorageConfig {

    @Bean
    @ConditionalOnProperty(name = "atheris.storage.provider", havingValue = "s3", matchIfMissing = true)
    public S3Client s3Client() {
        return S3Client.builder()
            .region(Region.of(System.getProperty("aws.region", Constants.AWS_REGION)))
            .credentialsProvider(AnonymousCredentialsProvider.create())
            .build();
    }
}
