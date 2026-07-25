package com.atheris.compliance.tenant.backend.modules.evidence.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.nio.file.*;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${evidence.storage.path:${user.home}/atheris-evidence}")
    private String storagePath;

    @PostConstruct
    void init() throws IOException {
        Files.createDirectories(Path.of(storagePath));
    }

    public String store(MultipartFile file) throws IOException {
        String ext = "";
        String original = file.getOriginalFilename();
        if (original != null && original.contains("."))
            ext = original.substring(original.lastIndexOf("."));
        String storedName = UUID.randomUUID() + ext;
        Path target = Path.of(storagePath, storedName);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return target.toAbsolutePath().toString();
    }

    public byte[] load(String storagePath) throws IOException {
        return Files.readAllBytes(Path.of(storagePath));
    }

    public void delete(String storagePath) throws IOException {
        Files.deleteIfExists(Path.of(storagePath));
    }
}
