# api-sync

Sub-agent for verifying frontend api.js matches backend @RestController endpoints after adding/changing endpoints.

## When to use
After adding or changing any `@RestController` endpoint in `atheris-compliance-backend` or any `services/api.js` file in `atheris-compliance-frontend`.

## Conventions
- Scans all `@RestController` classes vs all `api.js` files.
- Reports missing frontend calls, dead calls, parameter/auth/shape mismatches.

## Tools
MUST use this agent via `Task` tool. Coordinator MUST NOT implement directly.
