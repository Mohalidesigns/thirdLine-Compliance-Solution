package com.atheris.compliance.tenant.backend.modules.ldap.dto;

import lombok.Builder;
import lombok.Data;

/**
 * A tenant's LDAP connection settings, as persisted (bind password encrypted) in
 * {@code tenant_profile.ldap_config}. This is the decrypted, ready-to-use view.
 */
@Data
@Builder
public class LdapSettings {

    /** e.g. {@code ldap://localhost:1389} or {@code ldaps://dc01.example.com:636}. */
    private String url;
    /** The service account DN used to search the directory, e.g. {@code cn=admin,dc=atheris,dc=test}. */
    private String bindDn;
    /** The service account's password (decrypted). Never returned to the client. */
    private String bindPassword;
    /** The subtree searched for a user, e.g. {@code ou=people,dc=atheris,dc=test}. */
    private String userSearchBase;
    /** The attribute matched against the login email, e.g. {@code mail} or {@code uid}. */
    private String userSearchFilterAttribute;
    /** The attribute holding the user's full name, e.g. {@code cn}. */
    private String fullNameAttribute;
}