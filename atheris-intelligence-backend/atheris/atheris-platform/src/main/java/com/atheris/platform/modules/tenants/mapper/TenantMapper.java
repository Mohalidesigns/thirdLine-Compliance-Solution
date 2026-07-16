package com.atheris.platform.modules.tenants.mapper;

import com.atheris.platform.modules.tenants.dto.TenantDto;
import com.atheris.platform.modules.tenants.dto.UpdateTenantRequest;
import com.atheris.platform.modules.tenants.entity.Tenant;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface TenantMapper {

    TenantDto toDto(Tenant tenant);

    @Mapping(target = "tenantId", ignore = true)
    @Mapping(target = "shortName", ignore = true)
    @Mapping(target = "licenceType", ignore = true)
    @Mapping(target = "licenceNumber", ignore = true)
    @Mapping(target = "regulatorAbbreviations", ignore = true)
    @Mapping(target = "employeeCount", ignore = true)
    @Mapping(target = "stateOfHq", ignore = true)
    @Mapping(target = "ccoName", ignore = true)
    @Mapping(target = "webhookSecret", ignore = true)
    @Mapping(target = "webhookEnabled", ignore = true)
    @Mapping(target = "subscriptionTier", ignore = true)
    @Mapping(target = "isActive", ignore = true)
    @Mapping(target = "onboardedBy", ignore = true)
    @Mapping(target = "onboardedAt", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateFromRequest(UpdateTenantRequest req, @MappingTarget Tenant tenant);
}
