package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlacementService {

    private final OwnerRepository stakeholders;

    @Transactional(readOnly = true)
    public Owner requirePlaced(Integer stakeholderId) {
        Owner s = stakeholders.findById(stakeholderId)
            .orElseThrow(() -> ApiException.badRequest("stakeholder_not_found",
                "Stakeholder not found: " + stakeholderId));
        if (s.getDepartmentId() == null || s.getEmail() == null || s.getEmail().isBlank()) {
            throw ApiException.conflict("stakeholder_not_placed",
                s.getFullName() + " has no email or department. Add them before assigning work.");
        }
        return s;
    }
}
