package com.atheris.compliance.tenant.backend.shared.tenant;

import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Resolves this instance's tenant identity from its own database (the single tenant_profile
 * row), rather than from a configured numeric tenant id. The tenant learns its real id from
 * the platform at provisioning (license activation) and stores it in tenant_profile.
 *
 * Works on both HTTP and scheduler/startup threads — it does not depend on a request/session.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TenantIdentityService {

    private final TenantProfileRepository profiles;

    /**
     * Returns the tenant profile for this instance, if onboarding has been started and a
     * profile row exists. One-tenant-per-instance: the DB holds at most one tenant profile.
     */
    public Optional<TenantProfile> currentProfile() {
        return profiles.findAll().stream().findFirst();
    }

    /**
     * The platform-assigned tenant id persisted in tenant_profile, or null if not yet provisioned.
     */
    public Long currentTenantId() {
        return currentProfile().map(TenantProfile::getTenantId).orElse(null);
    }
}
