package com.atheris.compliance.tenant.backend.modules.reports.repository;

import com.atheris.compliance.tenant.backend.modules.reports.entity.BoardPack;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BoardPackRepository extends JpaRepository<BoardPack, Long> {
    Page<BoardPack> findAllByOrderByGeneratedAtDesc(Pageable p);
    Optional<BoardPack> findFirstByOrderByPeriodToDescBoardPackIdDesc();
    long countByStatus(String status);
}