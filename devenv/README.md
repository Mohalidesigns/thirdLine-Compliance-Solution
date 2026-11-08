# Atheris local test environment

Runs the two external services the workflow features depend on, without touching any real
mail server or corporate directory.

## Start

```bash
docker compose -f devenv/docker-compose.testenv.yml up -d
```

| Service       | Endpoint                     | Credentials |
|---------------|------------------------------|-------------|
| Mailpit SMTP  | `localhost:1025`             | none (auth accepted, ignored) |
| Mailpit inbox | http://localhost:8025        | — |
| OpenLDAP      | `ldap://localhost:1389`      | `cn=admin,dc=atheris,dc=test` / `adminpassword` |
| phpLDAPadmin  | http://localhost:8080        | login DN `cn=admin,dc=atheris,dc=test` |

## Stop / reset

```bash
docker compose -f devenv/docker-compose.testenv.yml down        # stop, keep data
docker compose -f devenv/docker-compose.testenv.yml down -v     # stop, wipe volumes
```

OpenLDAP is seeded from `devenv/ldif/atheris.ldif` on first start. To re-apply after editing
the LDIF, recreate the volume: `down -v` then `up -d`.

## Wire the tenant backend to the test bed

Add to your environment (e.g. `~/.zshrc`) — the tenant app reads these on start:

```bash
# Outbound email -> Mailpit
export SMTP_HOST=localhost
export SMTP_PORT=1025
export SMTP_AUTH=false
export SMTP_STARTTLS=false
export EMAIL_FROM=noreply@atheris.test
export PLATFORM_BASE_URL=http://localhost:5174
```

Email is optional: if `SMTP_HOST` is unset the app logs-and-skips every send.

## LDAP onboarding values

On the **User Setup** onboarding step choose **LDAP** and enter:

| Field | Value |
|-------|-------|
| LDAP URL | `ldap://localhost:1389` |
| Bind DN | `cn=admin,dc=atheris,dc=test` |
| Bind password | `adminpassword` |
| User search base | `ou=people,dc=atheris,dc=test` |
| Search attribute | `mail` |
| Full-name attribute | `cn` |

Then click **Test connection**. On success, provision the CCO and Analyst identities (their
emails must match directory entries) and set a **break-glass** local Tenant Admin.

## Seeded identities (directory password `Passw0rd!`)

Every department from `tools/toolkit-ownership/org_vocab.json` gets a **head** plus **one officer
per unit**, all under the flat `ou=people` (so the onboarding search base is unchanged). 42
identities total.

| Email | Role in tests |
|-------|---------------|
| `cco@atheris.test` | chief compliance officer — escalation L3, board-pack sign-off |
| `analyst@atheris.test` | control tester / remediation reviewer |

Department heads (org-chart escalation targets):

| Email | Department |
|-------|------------|
| `headofcompliance@` | Compliance |
| `headofrisk@` | Risk Management |
| `headofit@` | Information Technology |
| `headofoperations@` | Operations |
| `headoffinance@` | Finance & Treasury |
| `chiefauditexecutive@` | Internal Audit |
| `headoflegal@` | Legal & Company Secretariat |
| `headofhr@` | Human Resources |

Plus one officer per unit (e.g. `regulatorycompliance@`, `dataprotection@`, `aml@`,
`monitoringtesting@`, `conductethics@`, `enterpriserisk@`, `operationalrisk@`, `creditrisk@`,
`marketliquidityrisk@`, `corebanking@`, `dba@`, `network@`, `sysadmin@`, `itsecurity@`,
`branchoperations@`, `cashmanagement@`, `transactionprocessing@`, `tradeservices@`,
`customerservice@`, `financialcontrol@`, `treasury@`, `regulatoryreporting@`, `tax@`,
`procurement@`, `auditoperations@`, `auditassurance@`, `legaladvisory@`, `companysecretariat@`,
`litigationdisputes@`, `hroperations@`, `learningdevelopment@`, `recruitment@`).

Every identity is **directory-only** — none are tenant app accounts (no `users` row, no role).
Use them to pick the CCO/Analyst at onboarding, as owners, or as extra reviewers in SoD tests. An
owner **without** a directory entry (e.g. `contractor@atheris.test`) exercises the public
remediation-link flow — they receive the link by email in Mailpit (http://localhost:8025) and
never sign in.