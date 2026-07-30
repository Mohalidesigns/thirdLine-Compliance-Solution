package com.atheris.compliance.tenant.backend.shared.platform.client;

import com.atheris.compliance.tenant.backend.modules.onboarding.dto.RegulatorSummary;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.shared.platform.dto.*;
import com.atheris.compliance.tenant.backend.shared.util.CryptoUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Pageable;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component @Slf4j
public class PlatformApiClient {

    private final RestTemplate rest;
    private final ObjectMapper mapper;
    private final String baseUrl;
    private final TenantProfileRepository profiles;
    private final CryptoUtil crypto;

    public PlatformApiClient(
            @Value("${atheris.platform.base-url:http://localhost:9090}") String baseUrl,
            @Value("${atheris.tenant-id:1}") Long tenantId,
            TenantProfileRepository profiles,
            CryptoUtil crypto,
            RestTemplateBuilder builder) {
        this.baseUrl = baseUrl;
        this.profiles = profiles;
        this.crypto = crypto;
        this.rest = builder.build();
        this.mapper = new ObjectMapper();
    }

    private HttpHeaders headers() {
        HttpHeaders h = new HttpHeaders();
        Optional<TenantProfile> opt = profiles.findAll().stream().findFirst();
        if (opt.isPresent() && opt.get().getEncryptedApiKey() != null) {
            String decrypted = crypto.decrypt(opt.get().getEncryptedApiKey());
            log.debug("API key prefix: {}...", decrypted.substring(0, Math.min(12, decrypted.length())));
            h.set("X-Api-Key", decrypted);
        } else {
            log.warn("No API key available for platform calls (profile present: {}, encryptedKey null: {})",
                opt.isPresent(), opt.isPresent() ? opt.get().getEncryptedApiKey() == null : "N/A");
        }
        return h;
    }

    public void onboardTenant(Map<String, Object> tenantData) {
        try {
            HttpHeaders h = headers();
            h.setContentType(MediaType.APPLICATION_JSON);
            rest.postForEntity(
                baseUrl + "/api/v1/internal/tenants/onboard",
                new HttpEntity<>(tenantData, h), Map.class);
        } catch (Exception e) {
            log.error("Failed to onboard tenant on platform: {}", e.getMessage());
        }
    }

    public IngestResponseDto ingestDocument(MultipartFile file, Long tenantRegulatorId,
                                             Long tenantId, Integer platformRegulatorId,
                                             String title, String dateIssued) {
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override public String getFilename() { return file.getOriginalFilename(); }
            });
            if (platformRegulatorId != null)
                body.add("regulatorId", String.valueOf(platformRegulatorId));
            if (tenantId != null)
                body.add("tenantId", String.valueOf(tenantId));
            if (title != null) body.add("title", title);

            HttpHeaders h = headers();
            h.setContentType(MediaType.MULTIPART_FORM_DATA);

            log.debug("Ingest POST to {} with {} parts (API key set: {})",
                baseUrl + "/api/v1/internal/uploads", body.size(), h.containsKey("X-Api-Key"));

            ResponseEntity<Map> resp = rest.exchange(
                baseUrl + "/api/v1/internal/uploads",
                HttpMethod.POST, new HttpEntity<>(body, h), Map.class);

            Map<String, Object> map = resp.getBody();
            if (map == null) return IngestResponseDto.builder().error("Empty response from platform").build();

            String err = (String) map.get("errorMessage");
            if (err != null && !err.isBlank()) {
                return IngestResponseDto.builder().error(err).build();
            }
            Number idNum = (Number) map.get("id");
            Number instNum = (Number) map.get("instrumentId");
            return IngestResponseDto.builder()
                .uploadId(idNum != null ? idNum.longValue() : null)
                .instrumentId(instNum != null ? instNum.longValue() : null)
                .status((String) map.get("status"))
                .build();
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            String respBody = e.getResponseBodyAsString();
            log.error("Platform ingest HTTP {} {}: responseHeaders={}, body='{}'",
                e.getStatusCode(), e.getStatusText(), e.getResponseHeaders(), respBody);
            return IngestResponseDto.builder().error(respBody != null && !respBody.isEmpty() ? respBody : e.getStatusText()).build();
        } catch (Exception e) {
            log.error("Failed to call platform ingest: {}", e.getMessage(), e);
            return IngestResponseDto.builder().error(e.getMessage()).build();
        }
    }

    public IngestResponseDto getUploadStatus(Long uploadRecordId) {
        try {
            HttpHeaders h = headers();
            ResponseEntity<Map> resp = rest.exchange(
                baseUrl + "/api/v1/internal/uploads/record/" + uploadRecordId,
                HttpMethod.GET, new HttpEntity<>(h), Map.class);
            Map<String, Object> map = resp.getBody();
            if (map == null) return IngestResponseDto.builder().error("Empty response").build();

            String err = (String) map.get("errorMessage");
            if (err != null && !err.isBlank()) {
                return IngestResponseDto.builder().error(err).build();
            }
            Number idNum = (Number) map.get("id");
            Number instNum = (Number) map.get("instrumentId");
            return IngestResponseDto.builder()
                .uploadId(idNum != null ? idNum.longValue() : null)
                .instrumentId(instNum != null ? instNum.longValue() : null)
                .status((String) map.get("status"))
                .build();
        } catch (Exception e) {
            log.error("Failed to fetch upload status: {}", e.getMessage());
            return IngestResponseDto.builder().error(e.getMessage()).build();
        }
    }

    public PlatformInstrumentDetail getInstrumentDetail(Long instrumentId) {
        try {
            HttpHeaders h = headers();
            ResponseEntity<PlatformInstrumentDetail> resp = rest.exchange(
                baseUrl + "/api/v1/internal/instruments/" + instrumentId + "/detail",
                HttpMethod.GET, new HttpEntity<>(h), PlatformInstrumentDetail.class);
            return resp.getBody();
        } catch (Exception e) {
            log.error("Failed to fetch instrument detail: {}", e.getMessage());
            return null;
        }
    }

    public List<RegulatorSummary> fetchRegulators() {
        try {
            HttpHeaders h = headers();
            ResponseEntity<List<RegulatorSummary>> resp = rest.exchange(
                baseUrl + "/api/v1/internal/regulators",
                HttpMethod.GET, new HttpEntity<>(h),
                new ParameterizedTypeReference<List<RegulatorSummary>>() {});
            return resp.getBody() != null ? resp.getBody() : List.of();
        } catch (Exception e) {
            log.error("Failed to fetch regulators from platform: {}", e.getMessage());
            return List.of();
        }
    }

    public PagedResponse<PlatformInstrumentSummary> searchInstruments(String q, List<Integer> regulatorIds, Pageable pageable) {
        try {
            StringBuilder url = new StringBuilder(baseUrl + "/api/v1/internal/instruments/search")
                .append("?q=").append(java.net.URLEncoder.encode(q != null ? q : "", "UTF-8"))
                .append("&page=").append(pageable.getPageNumber())
                .append("&size=").append(pageable.getPageSize());
            if (regulatorIds != null) {
                for (Integer id : regulatorIds) {
                    url.append("&regulatorIds=").append(id);
                }
            }
            HttpHeaders h = headers();
            ResponseEntity<PagedResponse<PlatformInstrumentSummary>> resp = rest.exchange(
                url.toString(), HttpMethod.GET, new HttpEntity<>(h),
                new ParameterizedTypeReference<PagedResponse<PlatformInstrumentSummary>>() {});
            return resp.getBody() != null ? resp.getBody() : new PagedResponse<>(List.of(), 0, 0, pageable.getPageSize(), pageable.getPageNumber());
        } catch (Exception e) {
            log.error("Failed to search instruments: {}", e.getMessage());
            return new PagedResponse<>(List.of(), 0, 0, pageable.getPageSize(), pageable.getPageNumber());
        }
    }

    public List<PlatformInstrumentSummary> findRecentInstruments(Long tenantId, List<Integer> regulatorIds,
                                                                   String licenceType, LocalDate since) {
        try {
            StringBuilder url = new StringBuilder(baseUrl + "/api/v1/internal/instruments/recent")
                .append("?tenantId=").append(tenantId)
                .append("&licenceType=").append(licenceType)
                .append("&size=20");
            if (since != null) url.append("&since=").append(since.toString());
            for (Integer id : regulatorIds) {
                url.append("&regulatorIds=").append(id);
            }

            HttpHeaders h = headers();
            ResponseEntity<PagedResponse<PlatformInstrumentSummary>> resp = rest.exchange(
                url.toString(), HttpMethod.GET, new HttpEntity<>(h),
                new ParameterizedTypeReference<PagedResponse<PlatformInstrumentSummary>>() {});

            if (resp.getBody() != null && resp.getBody().getContent() != null) {
                return resp.getBody().getContent();
            }
            return List.of();
        } catch (Exception e) {
            log.error("Failed to fetch recent instruments: {}", e.getMessage());
            return List.of();
        }
    }
}
