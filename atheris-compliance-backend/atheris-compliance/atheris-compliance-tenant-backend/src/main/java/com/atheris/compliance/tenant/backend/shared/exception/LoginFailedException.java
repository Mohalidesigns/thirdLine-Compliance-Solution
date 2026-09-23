package com.atheris.compliance.tenant.backend.shared.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * A login attempt that was refused. {@code invalidCredentials} maps to 401;
 * {@code blocked} (deactivated, invite pending, locked) maps to 403.
 */
@Getter
public class LoginFailedException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    private LoginFailedException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static LoginFailedException invalidCredentials() {
        return new LoginFailedException(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Invalid email or password");
    }

    public static LoginFailedException blocked(String message) {
        return new LoginFailedException(HttpStatus.FORBIDDEN, "login_blocked", message);
    }
}
