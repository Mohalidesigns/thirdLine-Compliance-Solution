# frontend-page

Sub-agent for any MUI table page — new, modified, or bugfixed (KPIs, filters, drawer, pagination).

## When to use
Any frontend page work in `atheris-compliance-frontend/atheris-compliance-tenant-frontend/src/pages/*` or `atheris-compliance-intelligence-frontend/src/features/*`.

## Read this first
Full pattern, per-app conventions and the verified trap catalogue live in
`.claude/skills/atheris-register-page/` (SKILL.md + references/). Read it before
starting — it carries the things that are not visible from the code you are editing,
and `scripts/check_dto_binding.py` there catches the most common defect in this repo.

## Conventions
- React 19, Vite 8, MUI 7.
- Pages follow stats cards → filters → sortable table → detail drawer. Max 5 columns.
- API via `services/api.js`.
- Use TanStack Query (`@tanstack/react-query`) for data fetching — never raw useEffect + fetch.
  **This applies to the TENANT frontend only.** The intelligence frontend has no
  react-query dependency and no provider; there, match `RegulationExplorerPage.jsx`'s raw
  useEffect idiom. Do not add the dependency.
- Wrap fetch calls in AbortController to prevent race conditions on unmounted components.
- In tables MUST use similar styling as the obligations register pages. Max 5 columns. Card stats MUST have dropdown.

## Tools
MUST use this agent via `Task` tool with `subagent_type: "general"` and prompt describing frontend-page work. Coordinator MUST NOT implement directly.
