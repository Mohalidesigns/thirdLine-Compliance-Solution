package com.atheris.compliance.tenant.backend.modules.returns.repository;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnResponsibleStakeholder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface ReturnResponsibleStakeholderRepository extends JpaRepository<ReturnResponsibleStakeholder, Long> {
    List<ReturnResponsibleStakeholder> findByReturnId(Long returnId);
    List<ReturnResponsibleStakeholder> findByReturnIdIn(Collection<Long> returnIds);
    List<ReturnResponsibleStakeholder> findByStakeholderId(Integer stakeholderId);
    void deleteByReturnId(Long returnId);
}
