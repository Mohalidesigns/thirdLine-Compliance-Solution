package com.atheris.compliance.intelligence.backend.shared.storage;

import com.atheris.compliance.common.Constants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "atheris.storage.provider", havingValue = "s3", matchIfMissing = true)
public class S3StorageService implements StorageService {

    private final S3Client s3Client;

    @Value("${atheris.storage.bucket}")
    private String bucket;

    private static final int CHUNK_SIZE = 8 * 1024 * 1024;

    @Override
    public String generatePresignedUrl(String key, int expirySeconds) {
        try (S3Presigner presigner = S3Presigner.create()) {
            PresignedGetObjectRequest presigned = presigner.presignGetObject(b -> b
                .signatureDuration(Duration.ofSeconds(expirySeconds))
                .getObjectRequest(r -> r.bucket(bucket).key(key)));
            return presigned.url().toString();
        }
    }

    @Override
    public String streamUpload(InputStream inputStream, String key,
                                String contentType, long maxBytes) throws IOException {
        CreateMultipartUploadResponse multipart = s3Client.createMultipartUpload(b ->
            b.bucket(bucket).key(key).contentType(contentType));

        String uploadId = multipart.uploadId();
        List<CompletedPart> parts = new ArrayList<>();
        int partNumber = 1;
        long totalBytes = 0;
        byte[] buffer = new byte[CHUNK_SIZE];
        int bytesRead;

        try {
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                totalBytes += bytesRead;
                if (totalBytes > maxBytes) {
                    s3Client.abortMultipartUpload(b ->
                        b.bucket(bucket).key(key).uploadId(uploadId));
                    throw new PdfTooLargeException(
                        "PDF stream exceeded maximum size of " + (maxBytes / 1024 / 1024) + "MB");
                }
                int pn = partNumber;
                UploadPartResponse part = s3Client.uploadPart(
                    b -> b.bucket(bucket).key(key).uploadId(uploadId).partNumber(pn),
                    RequestBody.fromBytes(Arrays.copyOf(buffer, bytesRead))
                );
                parts.add(CompletedPart.builder().partNumber(pn).eTag(part.eTag()).build());
                partNumber++;
            }
            s3Client.completeMultipartUpload(b -> b
                .bucket(bucket).key(key).uploadId(uploadId)
                .multipartUpload(m -> m.parts(parts)));
            log.info("Uploaded {} bytes to s3://{}/{}", totalBytes, bucket, key);
            return key;
        } catch (PdfTooLargeException e) {
            throw e;
        } catch (Exception e) {
            s3Client.abortMultipartUpload(b ->
                b.bucket(bucket).key(key).uploadId(uploadId));
            throw new IOException("S3 multipart upload failed: " + e.getMessage(), e);
        }
    }

    @Override
    public InputStream openReadStream(String key) throws IOException {
        return s3Client.getObject(b -> b.bucket(bucket).key(key));
    }

    @Override
    public void upload(byte[] bytes, String key, String contentType) {
        s3Client.putObject(b -> b.bucket(bucket).key(key).contentType(contentType),
            RequestBody.fromBytes(bytes));
    }

    @Override
    public void setMetadataHash(String key, String hash) {
        s3Client.copyObject(b -> b
            .sourceBucket(bucket).sourceKey(key)
            .destinationBucket(bucket).destinationKey(key)
            .metadata(Map.of(Constants.S3_METADATA_PDF_HASH, hash))
            .metadataDirective(MetadataDirective.REPLACE));
    }

    @Override
    public String getMetadataHash(String key) {
        return s3Client.headObject(b -> b.bucket(bucket).key(key))
            .metadata().getOrDefault(Constants.S3_METADATA_PDF_HASH, "");
    }

    @Override
    public byte[] readFirstBytes(String key, int numBytes) {
        return s3Client.getObjectAsBytes(b -> b.bucket(bucket).key(key)
            .range(Constants.S3_RANGE_PREFIX + (numBytes - 1))).asByteArray();
    }

    @Override
    public void delete(String key) {
        s3Client.deleteObject(b -> b.bucket(bucket).key(key));
    }
}
