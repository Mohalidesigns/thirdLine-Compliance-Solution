package com.atheris.platform.modules.instruments.repository;

import com.atheris.platform.modules.instruments.entity.Instrument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface InstrumentRepository extends JpaRepository<Instrument, Long>, JpaSpecificationExecutor<Instrument> {
    boolean existsByPdfHash(String pdfHash);
    boolean existsBySourceUrl(String sourceUrl);
    Optional<Instrument> findByPdfHash(String pdfHash);
    Page<Instrument> findByStatus(String status, Pageable pageable);
    Page<Instrument> findByRegulatorIdAndStatus(Integer regulatorId, String status, Pageable pageable);
    List<Instrument> findByRegulatorIdOrderByDiscoveredAtDesc(Integer regulatorId);
}
