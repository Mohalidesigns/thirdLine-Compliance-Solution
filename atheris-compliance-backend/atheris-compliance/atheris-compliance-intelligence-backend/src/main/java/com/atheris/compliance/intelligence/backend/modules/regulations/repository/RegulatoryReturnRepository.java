package com.atheris.compliance.intelligence.backend.modules.regulations.repository;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RegulatoryReturnRepository extends JpaRepository<RegulatoryReturn, Long>, JpaSpecificationExecutor<RegulatoryReturn> {
    List<RegulatoryReturn> findByActId(Long actId);
    long countByActId(Long actId);
    boolean existsByTitleAndActId(String title, Long actId);
}