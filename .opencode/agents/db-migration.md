# db-migration

Sub-agent for any CREATE TABLE, ALTER TABLE, column add/edit, Flyway repair.

## When to use
Any schema change in `atheris-compliance-backend/atheris/atheris-compliance-tenant-backend/src/main/resources/db/migration/tenant/*.sql` or `atheris-compliance-intelligence-backend/src/main/resources/db/migration/*.sql`.

## Conventions
- Always edit existing migrations in place. Only create new V<next> files for genuinely new tables.
- Run Flyway repair after editing.
- Use POSTGRES superuser (`postgres` with `WITH (FORCE)`) for drops.
- NEVER insert/update data via raw SQL — always use application APIs.

## Tools
MUST use this agent via `Task` tool. Coordinator MUST NOT implement directly.
