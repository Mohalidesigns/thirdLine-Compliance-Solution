package com.atheris.compliance.tenant.backend.shared.platform.client;

import com.atheris.compliance.tenant.backend.modules.onboarding.dto.RegulatorSummary;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.shared.platform.dto.*;
import com.atheris.compliance.tenant.backend.shared.util.CryptoUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
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
            CryptoUtil crypto) {
        this.baseUrl = baseUrl;
        this.profiles = profiles;
        this.crypto = crypto;
        this.rest = new RestTemplate();
        this.mapper = new ObjectMapper();
    }

    private HttpHeaders headers() {
        HttpHeaders h = new HttpHeaders();
        Optional<TenantProfile> opt = profiles.findAll().stream().findFirst();
        if (opt.isPresent() && opt.get().getEncryptedApiKey() != null) {
            String decrypted = crypto.decrypt(opt.get().getEncryptedApiKey());
            h.set("X-Api-Key", decrypted);
        } else {
            log.warn("No API key available for platform calls");
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
            body.add("tenant_regulator_id", String.valueOf(tenantRegulatorId));
            body.add("tenant_id", String.valueOf(tenantId));
            if (platformRegulatorId != null)
                body.add("platform_regulator_id", String.valueOf(platformRegulatorId));
            if (title != null) body.add("title", title);
            if (dateIssued != null) body.add("date_issued", dateIssued);

            HttpHeaders h = headers();
            h.setContentType(MediaType.MULTIPART_FORM_DATA);

            ResponseEntity<IngestResponseDto> resp = rest.exchange(
                baseUrl + "/api/v1/internal/instruments/ingest",
                HttpMethod.POST, new HttpEntity<>(body, h), IngestResponseDto.class);
            return resp.getBody() != null ? resp.getBody() : IngestResponseDto.builder()
                .error("Empty response from platform").build();
        } catch (Exception e) {
            log.error("Failed to call platform ingest: {}", e.getMessage());
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
