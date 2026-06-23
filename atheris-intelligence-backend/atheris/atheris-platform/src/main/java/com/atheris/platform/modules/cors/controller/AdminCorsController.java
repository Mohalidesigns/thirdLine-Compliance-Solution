package com.atheris.platform.modules.cors.controller;

import com.atheris.platform.modules.cors.dto.CorsWhitelistDto;
import com.atheris.platform.modules.cors.entity.CorsWhitelist;
import com.atheris.platform.modules.cors.repository.CorsWhitelistRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/cors")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminCorsController {

    private final CorsWhitelistRepository repo;

    @GetMapping
    public ResponseEntity<List<CorsWhitelistDto>> list() {
        return ResponseEntity.ok(repo.findAll().stream().map(this::toDto).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CorsWhitelistDto> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(toDto(repo.findById(id)
            .orElseThrow(() -> new RuntimeException("CORS entry not found: " + id))));
    }

    @PostMapping
    public ResponseEntity<CorsWhitelistDto> create(@Valid @RequestBody CreateCorsRequest req) {
        if (repo.existsByOrigin(req.getOrigin())) {
            throw new RuntimeException("Origin already exists: " + req.getOrigin());
        }
        CorsWhitelist entry = CorsWhitelist.builder()
            .origin(req.getOrigin())
            .description(req.getDescription())
            .isActive(req.getIsActive() != null ? req.getIsActive() : true)
            .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(repo.save(entry)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CorsWhitelistDto> update(
            @PathVariable Long id,
            @Valid @RequestBody CreateCorsRequest req) {
        CorsWhitelist entry = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("CORS entry not found: " + id));
        entry.setOrigin(req.getOrigin());
        entry.setDescription(req.getDescription());
        if (req.getIsActive() != null) entry.setIsActive(req.getIsActive());
        return ResponseEntity.ok(toDto(repo.save(entry)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private CorsWhitelistDto toDto(CorsWhitelist c) {
        return CorsWhitelistDto.builder()
            .id(c.getId())
            .origin(c.getOrigin())
            .description(c.getDescription())
            .isActive(c.getIsActive())
            .createdAt(c.getCreatedAt())
            .build();
    }
}

@Data
class CreateCorsRequest {
    @NotBlank private String origin;
    private String description;
    private Boolean isActive;
}
