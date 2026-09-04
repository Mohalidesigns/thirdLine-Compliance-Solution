# backend-scaffold

Sub-agent for any entity + repository + service + controller + DTOs + migration — new, refactored, or bugfixed.

## When to use
Any backend module work in `atheris-compliance-backend/atheris/atheris-compliance-tenant-backend/src/main/java/com/atheris/compliance/tenant/backend/modules/*` or `atheris-compliance-intelligence-backend`.

## Conventions
- Java 21, Spring Boot 3.2.
- `findBy` for simple lookups, native `@Query` for complex joins.
- `@Builder.Default` on all initialized fields.
- Thin controllers delegate to services.
- Avoid n+1 queries; `JpaSpecificationExecutor` for filtering.
- Avoid JPQL; when necessary use native query after prompting for approval.
- All `@Transactional` catch blocks must call `setRollbackOnly()`, catch `Throwable`, use `em.clear()` in catch blocks.

## Tools
MUST use this agent via `Task` tool. Coordinator MUST NOT implement directly.
