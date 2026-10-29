package com.atheris.compliance.tenant.backend.modules.org.service;

import com.atheris.compliance.tenant.backend.modules.ldap.service.LdapAuthService;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PersonDirectoryService {

    public record Entry(String name, String email, Integer userId) {
        public boolean hasEmail() {
            return email != null && !email.isBlank();
        }
    }

    private final UserRepository users;
    private final OwnerRepository owners;
    private final LdapAuthService ldap;

    @Transactional(readOnly = true)
    public List<Entry> entries() {
        Map<String, Entry> byName = new java.util.LinkedHashMap<>();
        for (User u : users.findByIsActiveTrue()) {
            if (u.getFullName() == null || u.getFullName().isBlank()) continue;
            byName.putIfAbsent(key(u.getFullName()), new Entry(u.getFullName(), u.getEmail(), u.getUserId()));
        }
        for (Owner o : owners.findAll()) {
            if (!Boolean.TRUE.equals(o.getIsActive()) || o.getFullName() == null || o.getFullName().isBlank()) continue;
            byName.putIfAbsent(key(o.getFullName()), new Entry(o.getFullName(), o.getEmail(), o.getUserId()));
        }
        if (ldap.isLdapEnabled()) {
            for (LdapAuthService.DirectoryUser u : ldap.searchUsers("")) {
                if (u.fullName() == null || u.fullName().isBlank()) continue;
                if (u.email() == null || u.email().isBlank()) continue;
                byName.putIfAbsent(key(u.fullName()), new Entry(u.fullName(), u.email(), null));
            }
        }
        return new ArrayList<>(byName.values());
    }

    @Transactional(readOnly = true)
    public Entry find(String nameOrEmail) {
        if (nameOrEmail == null || nameOrEmail.isBlank()) return null;
        String needle = key(nameOrEmail);
        for (Entry e : entries()) {
            if (key(e.name()).equals(needle)) return e;
            if (e.hasEmail() && key(e.email()).equals(needle)) return e;
        }
        if (nameOrEmail.contains("@")) return new Entry(nameOrEmail.trim(), nameOrEmail.trim(), null);
        return null;
    }

    @Transactional(readOnly = true)
    public List<String> emailsFor(List<String> names) {
        return resolve(names).stream().map(Entry::email).toList();
    }

    @Transactional(readOnly = true)
    public List<Entry> resolve(List<String> names) {
        if (names == null || names.isEmpty()) return List.of();
        List<Entry> all = entries();
        Map<String, Entry> byName = all.stream().collect(Collectors.toMap(
            e -> key(e.name()), Function.identity(), (a, b) -> a));
        Map<String, Entry> byEmail = all.stream().filter(Entry::hasEmail).collect(Collectors.toMap(
            e -> key(e.email()), Function.identity(), (a, b) -> a));
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<Entry> out = new ArrayList<>();
        for (String name : names) {
            if (name == null || name.isBlank()) continue;
            Entry match = byName.get(key(name));
            if (match == null) match = byEmail.get(key(name));
            if (match == null && name.contains("@")) match = new Entry(name.trim(), name.trim(), null);
            if (match == null || !match.hasEmail()) continue;
            if (seen.add(key(match.email()))) out.add(match);
        }
        return out;
    }

    private static String key(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
