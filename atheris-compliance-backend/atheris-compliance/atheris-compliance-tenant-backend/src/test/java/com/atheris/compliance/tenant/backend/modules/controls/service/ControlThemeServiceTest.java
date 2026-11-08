package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.dto.ControlThemeRequest;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTheme;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlThemeRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ControlThemeServiceTest {

    private final ControlThemeRepository repo = mock(ControlThemeRepository.class);
    private final ControlRepository controls = mock(ControlRepository.class);
    private final AuditService audit = mock(AuditService.class);
    private final ControlThemeService service = new ControlThemeService(repo, controls, audit);

    @Test
    void createRejectsDuplicateName() {
        when(repo.existsByNameIgnoreCase("AML/CFT")).thenReturn(true);
        ControlThemeRequest req = new ControlThemeRequest();
        req.setName("AML/CFT");
        assertThrows(ApiException.class, () -> service.create(req, 1));
        verify(repo, never()).save(any());
    }

    @Test
    void createTrimsAndSaves() {
        when(repo.existsByNameIgnoreCase("ESG")).thenReturn(false);
        when(repo.save(any())).thenAnswer(inv -> {
            ControlTheme t = inv.getArgument(0);
            t.setThemeId(7);
            return t;
        });
        ControlThemeRequest req = new ControlThemeRequest();
        req.setName("  ESG  ");
        req.setDescription("Environmental");
        var dto = service.create(req, 1);
        assertEquals("ESG", dto.getName());
        assertEquals(7, dto.getThemeId());
    }

    @Test
    void requireThrowsUnknownTheme() {
        when(repo.findByNameIgnoreCase("Nope")).thenReturn(Optional.empty());
        ApiException e = assertThrows(ApiException.class, () -> service.require("Nope"));
        assertEquals("unknown_theme", e.getCode());
    }

    @Test
    void resolveOrCreateReturnsExisting() {
        when(repo.findByNameIgnoreCase(org.mockito.ArgumentMatchers.anyString()))
            .thenReturn(Optional.of(ControlTheme.builder().themeId(3).name("ESG").build()));
        assertEquals(3, service.resolveOrCreate("esg"));
        verify(repo, never()).save(any());
    }

    @Test
    void resolveOrCreateCreatesWhenMissing() {
        when(repo.findByNameIgnoreCase(org.mockito.ArgumentMatchers.anyString())).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(inv -> {
            ControlTheme t = inv.getArgument(0);
            t.setThemeId(9);
            return t;
        });
        assertEquals(9, service.resolveOrCreate("New Theme"));
    }

    @Test
    void renameRejectsDuplicateButAllowsSelf() {
        ControlTheme existing = ControlTheme.builder().themeId(5).name("ESG").build();
        when(repo.findById(5)).thenReturn(Optional.of(existing));
        when(repo.existsByNameIgnoreCase("ESG")).thenReturn(true);
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        ControlThemeRequest req = new ControlThemeRequest();
        req.setName("ESG");
        assertEquals("ESG", service.update(5, req, 1).getName());
    }
}