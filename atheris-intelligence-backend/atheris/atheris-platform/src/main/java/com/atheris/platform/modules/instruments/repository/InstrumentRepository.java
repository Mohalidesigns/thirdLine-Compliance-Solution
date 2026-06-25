package com.atheris.platform.modules.instruments.repository;

import com.atheris.platform.modules.instruments.entity.Instrument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface InstrumentRepository extends JpaRepository<Instrument, Long> {
    boolean existsByPdfHash(String pdfHash);
    boolean existsBySourceUrl(String sourceUrl);
    Optional<Instrument> findByPdfHash(String pdfHash);
    Page<Instrument> findByStatus(String status, Pageable pageable);
    Page<Instrument> findByRegulatorIdAndStatus(Integer regulatorId, String status, Pageable pageable);
    @Query("SELECT i FROM Instrument i WHERE i.status = 'Published' AND " +
           "(:regulator IS NULL OR i.regulatorId = :regulator) AND " +
           "(:riskRating IS NULL OR i.riskRating = :riskRating)")
    Page<Instrument> search(@Param("regulator") Integer regulator, @Param("riskRating") String riskRating, Pageable pageable);

    @Query("SELECT i.regulatorId, COUNT(i), MAX(i.discoveredAt) FROM Instrument i GROUP BY i.regulatorId")
    List<Object[]> getInstrumentStats();
}
