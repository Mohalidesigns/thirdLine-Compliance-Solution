package com.atheris.platform.modules.obligations.repository;

import com.atheris.platform.modules.obligations.entity.ObligationMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ObligationMappingRepository extends JpaRepository<ObligationMapping, Long>, JpaSpecificationExecutor<ObligationMapping> {
    List<ObligationMapping> findByInstrumentId(Long instrumentId);
    void deleteByInstrumentId(Long instrumentId);
}
