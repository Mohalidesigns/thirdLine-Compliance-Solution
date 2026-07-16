package com.atheris.platform.modules.tenants.repository;

import com.atheris.platform.modules.tenants.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, Long>, JpaSpecificationExecutor<Tenant> {
    List<Tenant> findByIsActiveTrue();
    Optional<Tenant> findByCcoEmail(String email);
}
