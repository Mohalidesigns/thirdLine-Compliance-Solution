package com.atheris.compliance.tenant.backend.modules.org.repository;

import com.atheris.compliance.tenant.backend.modules.org.entity.StakeholderAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface StakeholderAssignmentRepository extends JpaRepository<StakeholderAssignment, Long> {
    List<StakeholderAssignment> findBySubjectTypeAndSubjectId(String subjectType, Long subjectId);
    List<StakeholderAssignment> findByStakeholderId(Integer stakeholderId);
    List<StakeholderAssignment> findByStakeholderIdIn(Collection<Integer> stakeholderIds);
    Optional<StakeholderAssignment> findBySubjectTypeAndSubjectIdAndStakeholderIdAndRoleId(
        String subjectType, Long subjectId, Integer stakeholderId, Integer roleId);
    void deleteBySubjectTypeAndSubjectIdAndStakeholderIdAndRoleId(
        String subjectType, Long subjectId, Integer stakeholderId, Integer roleId);
    long countByStakeholderIdAndRoleId(Integer stakeholderId, Integer roleId);
}
