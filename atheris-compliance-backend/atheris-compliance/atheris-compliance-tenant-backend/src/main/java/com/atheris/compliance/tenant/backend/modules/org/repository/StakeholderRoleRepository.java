package com.atheris.compliance.tenant.backend.modules.org.repository;

import com.atheris.compliance.tenant.backend.modules.org.entity.StakeholderRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface StakeholderRoleRepository extends JpaRepository<StakeholderRole, Integer> {
    Optional<StakeholderRole> findByCode(String code);
    List<StakeholderRole> findAllByOrderBySortOrderAsc();
    List<StakeholderRole> findByIsActiveTrueOrderBySortOrderAsc();
}
