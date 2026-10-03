---
name: db-migration
description: Make a database schema change in the Atheris compliance codebase (Flyway migrations in atheris-compliance-intelligence-backend or atheris-compliance-tenant-backend). Use for any CREATE TABLE, ALTER TABLE, column add/edit, or Flyway repair. Carries the in-place edit rule, V<next> file rules, POSTGRES superuser drop rules, and the no-raw-SQL-data-mutation rule.
---

# db-migration

Make schema changes in the Atheris compliance codebase — CREATE TABLE, ALTER TABLE, column add/edit, Flyway repair.

## When to use

Any schema change in `atheris-compliance-intelligence-backend/src/main/resources/db/migration/*.sql` or `atheris-compliance-tenant-backend/src/main/resources/db/migration/tenant/*.sql`.

## Conventions

- **Edit existing migrations in place.** When the migration that created the table is the one that needs to change, edit that file rather than adding a new ALTER migration. Only create new `V<next>` files for genuinely new tables/features added later.
- **Run Flyway repair after editing** a migration whose checksums changed against an already-applied DB:
  ```bash
  mvn org.flywaydb:flyway-maven-plugin:10.12.0:repair -Dflyway.xxx ...
  ```
  (flyway-maven-plugin is not in the module pom — invoke with the fully-qualified goal plus `-Dflyway.` properties.)
- **Use POSTGRES superuser for drops** — drops need elevated privileges (e.g. `postgres` user with `WITH (FORCE)` / terminate connections before drop).
- **NEVER insert/update data via raw SQL** — always use the application APIs (controllers/endpoints) to create or modify data. Direct SQL mutations bypass business logic, validation, and audit trails, and will produce incorrect test results.
- Column/store choices: `BIGINT` for IDs, `TEXT` for long strings, `VARCHAR(n)` for bounded strings, `JSONB` for flexible structured data.
- When a JSONB/enum default exists in BOTH a migration and an entity `@Builder.Default`, they must agree — the entity always wins for JPA-created rows, so a correct column default is no protection if the entity supplies its own.

## After editing

- Optionally drop and recreate the affected table/DB with the POSTGRES superuser, then prompt the user to start the backends and run manual onboarding before testing.
- Re-seed if needed (toolkit import; tenant license/profile/regulators) — via the application APIs, never SQL.
- Verify both modules still compile: `mvn clean compile` from `atheris-compliance-backend/atheris-compliance`.
