---
name: api-sync
description: Verify the frontend api.js client matches the backend @RestController endpoints after adding or changing any endpoint in the Atheris compliance codebase (atheris-compliance-backend or any services/api.js in atheris-compliance-frontend). Use whenever endpoints change — reports missing frontend calls, dead calls, and parameter/auth/shape mismatches before shipping a route.
---

# api-sync

Verify the frontend `api.js` client matches the backend `@RestController` endpoints after adding/changing endpoints.

## When to use

After adding or changing any `@RestController` endpoint in `atheris-compliance-backend` or any `services/api.js` file in `atheris-compliance-frontend` (both the intelligence frontend at `src/services/api.js` and the tenant frontend at `src/services/api.js`).

## How to run the check

1. **Scan all controllers** — find every `@RestController`/`@Controller` class in both backend modules (`atheris-compliance-intelligence-backend`, `atheris-compliance-tenant-backend`). For each, list:
   - HTTP method (`@GetMapping`/`@PostMapping`/`@PutMapping`/`@DeleteMapping`)
   - full path (`@RequestMapping` base + method path)
   - request parameters / body shape
   - auth annotation (`@PreAuthorize` role)

2. **Scan all `api.js` files** — for each frontend, list every client method: the path it calls, params it passes, and expected response shape.

3. **Diff** and report:
   - **Missing frontend calls** — a backend endpoint with no corresponding `api.js` method (may be intentional for internal-only endpoints; call that out).
   - **Dead calls** — an `api.js` method hitting a path with no backend route (usually a removed endpoint that was forgotten).
   - **Parameter mismatches** — path variables, query params, or body fields the frontend sends but the backend doesn't accept (or vice versa).
   - **Auth mismatches** — frontend assumes a role/route the `@PreAuthorize` doesn't grant, or a public route the frontend calls with a token (falls into a 403).

## Conventions
- Scan all `@RestController` classes vs all `api.js` files — do not eyeball one pair.
- Report missing frontend calls, dead calls, parameter/auth/shape mismatches.
- Note which endpoints are intentionally internal (`/api/v1/internal/...` server-to-server) and have no frontend path — these are expected dead-ends, not bugs.
- After this check passes, rebuild: `npm run build:tenant` / `npm run build:intelligence` and `mvn -q clean compile -DskipTests`.
