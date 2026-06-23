package com.atheris.platform.shared.storage;

import java.io.IOException;
import java.io.InputStream;

public interface StorageService {
    String generatePresignedUrl(String key, int expirySeconds);
    String streamUpload(InputStream inputStream, String key, String contentType, long maxBytes) throws IOException;
    void upload(byte[] bytes, String key, String contentType);
    void setMetadataHash(String key, String hash);
    String getMetadataHash(String key);
    byte[] readFirstBytes(String key, int numBytes);
    void delete(String key);
}
