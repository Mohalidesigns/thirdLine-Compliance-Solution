package com.atheris.compliance.tenant.backend.modules.ldap.dto;

import lombok.Builder;
import lombok.Data;

/** A directory entry returned to the person picker. The DN is deliberately not exposed. */
@Data
@Builder
public class LdapDirectoryUser {
    private String email;
    private String fullName;
}
