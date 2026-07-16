package com.atheris.platform.modules.auth.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public class UserPrincipal {
    private final Long userId;
    private final Long tenantId;

    @Override
    public String toString() {
        return userId.toString();
    }
}
