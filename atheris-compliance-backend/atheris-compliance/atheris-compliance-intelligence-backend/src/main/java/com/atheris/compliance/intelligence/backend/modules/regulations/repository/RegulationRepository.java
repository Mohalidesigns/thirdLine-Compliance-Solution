package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RegulationRepository extends JpaRepository<Regulation, Long>, JpaSpecificationExecutor<Regulation> {
    Optional<Regulation> findByName(String name);
    List<Regulation> findByRegulatorId(Integer regulatorId);
    List<Regulation> findByNameContainingIgnoreCase(String q);
}