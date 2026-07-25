package com.atheris.compliance.tenant.backend.modules.demo.controller;

import com.atheris.compliance.tenant.backend.modules.auth.dto.AuthTokens;
import com.atheris.compliance.tenant.backend.modules.demo.service.DemoDataSeeder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/demo")
@RequiredArgsConstructor
public class DemoController {

    private final DemoDataSeeder seeder;

    @PostMapping("/login")
    public ResponseEntity<AuthTokens> demoLogin() {
        return ResponseEntity.ok(seeder.seedAndLogin());
    }
}
