package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.dto.ControlThemeDto;
import com.atheris.compliance.tenant.backend.modules.controls.dto.ControlThemeRequest;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTheme;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlThemeRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class ControlThemeService {

    private final ControlThemeRepository repo;
    private final ControlRepository controls;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<ControlThemeDto> list(boolean activeOnly) {
        List<ControlTheme> rows = activeOnly ? repo.findByIsActiveTrueOrderByNameAsc() : repo.findAllByOrderByNameAsc();
        return rows.stream()
            .map(t -> ControlThemeDto.builder()
                .themeId(t.getThemeId())
                .name(t.getName())
                .description(t.getDescription())
                .isActive(t.getIsActive())
                .usedBy(controls.countByControlThemeId(t.getThemeId()))
                .build())
            .toList();
    }

    @Transactional
    public ControlThemeDto create(ControlThemeRequest req, Integer userId) {
        String name = req.getName() == null ? "" : req.getName().trim();
        if (name.isBlank()) {
            throw ApiException.badRequest("name_required", "Theme name is required");
        }
        if (repo.existsByNameIgnoreCase(name)) {
            throw ApiException.conflict("theme_exists", "A theme named \"" + name + "\" already exists");
        }
        ControlTheme saved = repo.save(ControlTheme.builder()
            .name(name)
            .description(req.getDescription())
            .isActive(true)
            .build());
        audit.logCurrentUser("control_theme_created", "control_theme", saved.getThemeId().longValue(), Map.of("name", name));
        return toDto(saved);
    }

    @Transactional
    public ControlThemeDto update(Integer id, ControlThemeRequest req, Integer userId) {
        ControlTheme theme = repo.findById(id)
            .orElseThrow(() -> ApiException.notFound("Theme not found: " + id));
        if (req.getName() != null && !req.getName().trim().isBlank()) {
            String name = req.getName().trim();
            if (!name.equalsIgnoreCase(theme.getName()) && repo.existsByNameIgnoreCase(name)) {
                throw ApiException.conflict("theme_exists", "A theme named \"" + name + "\" already exists");
            }
            theme.setName(name);
        }
        if (req.getDescription() != null) {
            theme.setDescription(req.getDescription());
        }
        ControlTheme saved = repo.save(theme);
        audit.logCurrentUser("control_theme_updated", "control_theme", saved.getThemeId().longValue(),
            Map.of("name", saved.getName() == null ? "" : saved.getName()));
        return toDto(saved);
    }

    @Transactional
    public void disable(Integer id, Integer userId) {
        ControlTheme theme = repo.findById(id)
            .orElseThrow(() -> ApiException.notFound("Theme not found: " + id));
        theme.setIsActive(false);
        repo.save(theme);
        audit.logCurrentUser("control_theme_disabled", "control_theme", id.longValue(), Map.of());
    }

    @Transactional(readOnly = true)
    public Integer require(String name) {
        if (name == null || name.isBlank()) return null;
        return repo.findByNameIgnoreCase(name.trim())
            .map(ControlTheme::getThemeId)
            .orElseThrow(() -> ApiException.badRequest("unknown_theme", "Unknown control theme: " + name));
    }

    @Transactional
    public Integer resolveOrCreate(String name) {
        if (name == null || name.isBlank()) return null;
        String trimmed = name.trim();
        return repo.findByNameIgnoreCase(trimmed)
            .map(ControlTheme::getThemeId)
            .orElseGet(() -> {
                ControlTheme saved = repo.save(ControlTheme.builder().name(trimmed).isActive(true).build());
                log.info("[ControlTheme] registered theme from seed/import: {}", trimmed);
                return saved.getThemeId();
            });
    }

    @Transactional(readOnly = true)
    public Map<Integer, String> namesById(Collection<Integer> themeIds) {
        if (themeIds == null || themeIds.isEmpty()) return Map.of();
        Map<Integer, String> out = new HashMap<>();
        for (ControlTheme t : repo.findAllById(new HashSet<>(themeIds))) out.put(t.getThemeId(), t.getName());
        return out;
    }

    private static ControlThemeDto toDto(ControlTheme t) {
        return ControlThemeDto.builder()
            .themeId(t.getThemeId())
            .name(t.getName())
            .description(t.getDescription())
            .isActive(t.getIsActive())
            .build();
    }
}
