package com.atheris.compliance.tenant.backend.modules.acts.repository;

import com.atheris.compliance.tenant.backend.modules.acts.entity.Act;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ActRepository extends JpaRepository<Act, Integer>, JpaSpecificationExecutor<Act> {
    Optional<Act> findByRegulationId(Long regulationId);
    List<Act> findAllByOrderByNameAsc();
    List<Act> findByRegulatorIdIn(Collection<Integer> regulatorIds);
}
