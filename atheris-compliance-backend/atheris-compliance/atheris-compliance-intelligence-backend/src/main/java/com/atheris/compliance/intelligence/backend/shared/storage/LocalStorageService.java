package com.atheris.compliance.intelligence.backend.shared.storage;

import com.atheris.compliance.common.Constants;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

@Service
@Slf4j
@ConditionalOnProperty(name = "atheris.storage.provider", havingValue = "local")
public class LocalStorageService implements StorageService {

    @Value("${atheris.storage.local-path:./data/storage}")
    private String localPath;

    private Path storageDir;
    private Path metaDir;

    @PostConstruct
    void init() throws IOException {
        storageDir = Path.of(localPath).toAbsolutePath().normalize();
        metaDir = storageDir.resolve(".meta");
        Files.createDirectories(storageDir);
        Files.createDirectories(metaDir);
        log.info("Local storage initialized at {}", storageDir);
    }

    private Path resolve(String key) {
        Path p = storageDir.resolve(key).normalize();
        if (!p.startsWith(storageDir)) {
            throw new IllegalArgumentException("Invalid key: " + key);
        }
        return p;
    }

    private Path metaFile(String key) {
        try {
            String hash = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8)));
            return metaDir.resolve(hash + ".meta");
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public String generatePresignedUrl(String key, int expirySeconds) {
        return resolve(key).toUri().toString();
    }

    @Override
    public InputStream openReadStream(String key) throws IOException {
        return Files.newInputStream(resolve(key));
    }

    @Override
    public String streamUpload(InputStream inputStream, String key,
                                String contentType, long maxBytes) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        long totalBytes;
        try (OutputStream out = Files.newOutputStream(target)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            totalBytes = 0;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                totalBytes += bytesRead;
                if (totalBytes > maxBytes) {
                    Files.deleteIfExists(target);
                    throw new PdfTooLargeException(
                        "Stream exceeded maximum size of " + (maxBytes / 1024 / 1024) + "MB");
                }
                out.write(buffer, 0, bytesRead);
            }
        }
        log.info("Stored {} bytes at {}", totalBytes, target);
        return key;
    }

    @Override
    public void upload(byte[] bytes, String key, String contentType) {
        try {
            Path target = resolve(key);
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
            log.info("Stored {} bytes at {}", bytes.length, target);
        } catch (IOException e) {
            throw new RuntimeException("Local storage write failed: " + e.getMessage(), e);
        }
    }

    @Override
    public void setMetadataHash(String key, String hash) {
        try {
            Path meta = metaFile(key);
            Files.writeString(meta, hash);
        } catch (IOException e) {
            log.warn("Failed to write metadata for key {}", key);
        }
    }

    @Override
    public String getMetadataHash(String key) {
        try {
            Path meta = metaFile(key);
            return Files.exists(meta) ? Files.readString(meta).trim() : "";
        } catch (IOException e) {
            return "";
        }
    }

    @Override
    public byte[] readFirstBytes(String key, int numBytes) {
        try {
            Path target = resolve(key);
            if (!Files.exists(target)) return new byte[0];
            byte[] all = Files.readAllBytes(target);
            return Arrays.copyOf(all, Math.min(numBytes, all.length));
        } catch (IOException e) {
            throw new RuntimeException("Local storage read failed: " + e.getMessage(), e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Path target = resolve(key);
            Files.deleteIfExists(target);
            Files.deleteIfExists(metaFile(key));
        } catch (IOException e) {
            log.warn("Failed to delete {}", key);
        }
    }
}
