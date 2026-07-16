package com.atheris.compliance.intelligence.backend.modules.licenses.repository;

import com.atheris.compliance.intelligence.backend.modules.licenses.entity.LicenseDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LicenseDeviceRepository extends JpaRepository<LicenseDevice, Integer>, JpaSpecificationExecutor<LicenseDevice> {
    List<LicenseDevice> findByLicenseId(Integer licenseId);
    int countByLicenseId(Integer licenseId);
    Optional<LicenseDevice> findByLicenseIdAndDeviceFingerprint(Integer licenseId, String deviceFingerprint);
    boolean existsByLicenseIdAndDeviceFingerprint(Integer licenseId, String deviceFingerprint);
    void deleteByLicenseIdAndDeviceFingerprint(Integer licenseId, String deviceFingerprint);
}
