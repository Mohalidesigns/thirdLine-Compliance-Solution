package com.atheris.compliance.tenant.backend.modules.ldap.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/** Response for {@code GET /ldap/users}: whether directory mode is on, plus matching entries. */
@Data
@Builder
public class LdapDirectoryResponse {
    /** True when the tenant authenticates against LDAP and a directory search is meaningful. */
    private boolean enabled;
    private List<LdapDirectoryUser> users;
}
