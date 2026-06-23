package com.atheris.platform.modules.tenants.repository;

import com.atheris.platform.modules.tenants.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, String> {
    List<Tenant> findByIsActiveTrue();
    Optional<Tenant> findByCcoEmail(String email);

    @Query(value = """
        SELECT * FROM tenants
        WHERE is_active = true
        AND :regulator = ANY(regulators::text[])
        AND licence_type = ANY(:licenceTypes)
        """, nativeQuery = true)
    List<Tenant> findEligibleTenants(@Param("regulator") String regulator, @Param("licenceTypes") String[] licenceTypes);
}
