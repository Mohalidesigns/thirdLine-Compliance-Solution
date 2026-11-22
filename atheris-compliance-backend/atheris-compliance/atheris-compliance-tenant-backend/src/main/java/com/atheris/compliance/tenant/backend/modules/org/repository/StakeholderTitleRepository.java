package com.atheris.compliance.tenant.backend.modules.org.repository;

import com.atheris.compliance.tenant.backend.modules.org.entity.StakeholderTitle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StakeholderTitleRepository extends JpaRepository<StakeholderTitle, Integer> {

    List<StakeholderTitle> findAllByOrderBySortOrderAscNameAsc();

    List<StakeholderTitle> findByIsActiveTrueOrderBySortOrderAscNameAsc();

    Optional<StakeholderTitle> findFirstByNameIgnoreCase(String name);
}
