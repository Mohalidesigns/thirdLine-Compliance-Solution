package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.repository;

import com.atheris.compliance.intelligence.backend.modules.runbooktemplates.entity.RunbookTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RunbookTemplateRepository
        extends JpaRepository<RunbookTemplate, Long>, JpaSpecificationExecutor<RunbookTemplate> {

    Optional<RunbookTemplate> findByTemplateCode(String templateCode);

    Optional<RunbookTemplate> findByTemplateCodeAndStatus(String templateCode, String status);

    List<RunbookTemplate> findByStatusOrderByTemplateCodeAsc(String status);

    List<RunbookTemplate> findByTemplateCodeIn(Collection<String> templateCodes);
}
