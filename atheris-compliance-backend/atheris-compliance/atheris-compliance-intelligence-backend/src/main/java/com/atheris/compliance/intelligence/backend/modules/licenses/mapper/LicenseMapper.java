package com.atheris.compliance.intelligence.backend.modules.licenses.mapper;

import com.atheris.compliance.intelligence.backend.modules.licenses.dto.LicenseDto;
import com.atheris.compliance.intelligence.backend.modules.licenses.dto.UpdateLicenseRequest;
import com.atheris.compliance.intelligence.backend.modules.licenses.entity.License;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface LicenseMapper {

    @Mapping(target = "legalName", ignore = true)
    @Mapping(target = "deviceCount", ignore = true)
    @Mapping(target = "devices", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    LicenseDto toDto(License license);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "tenantId", ignore = true)
    @Mapping(target = "licenseKey", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "activatedAt", ignore = true)
    @Mapping(target = "gracePeriodEnd", ignore = true)
    @Mapping(target = "issuedBy", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateFromRequest(UpdateLicenseRequest req, @MappingTarget License license);
}
