package com.atheris.platform.modules.notifications.repository;

import com.atheris.platform.modules.notifications.entity.ObligationChange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ObligationChangeRepository extends JpaRepository<ObligationChange, Long> {
    List<ObligationChange> findByInstrumentIdOrderByCreatedAtDesc(Long instrumentId);
}
