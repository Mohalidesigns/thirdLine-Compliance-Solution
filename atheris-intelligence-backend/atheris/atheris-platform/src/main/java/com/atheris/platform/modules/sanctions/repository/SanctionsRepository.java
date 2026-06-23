package com.atheris.platform.modules.sanctions.repository;

import com.atheris.platform.modules.sanctions.entity.SanctionsPenalty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SanctionsRepository extends JpaRepository<SanctionsPenalty, Long> {
    List<SanctionsPenalty> findByInstrumentId(Long instrumentId);
}
