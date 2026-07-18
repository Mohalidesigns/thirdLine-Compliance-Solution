package com.atheris.compliance.tenant.backend.modules.subscriptions.mapper;

import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.CreateRegulatorRequest;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.TenantRegulatorDto;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UpdateRegulatorRequest;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import org.mapstruct.*;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface TenantRegulatorMapper {

    TenantRegulatorDto toDto(TenantRegulator entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "tenantId", ignore = true)
    @Mapping(target = "isActive", constant = "true")
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    TenantRegulator toEntity(CreateRegulatorRequest req);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "tenantId", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateEntity(@MappingTarget TenantRegulator entity, UpdateRegulatorRequest req);
}
