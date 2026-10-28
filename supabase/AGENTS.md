# Supabase migration security

- Every migration that creates a table must define its access permissions in the same migration. Do not rely on automatic/default grants, including on fresh databases, preview branches, or local resets.
- For each table, determine which roles actually need SELECT, INSERT, UPDATE, and DELETE; grant only those operations explicitly to `anon`, `authenticated`, and/or `service_role`. Do not copy blanket CRUD grants to every role.
- For tables in an exposed schema, enable RLS and define appropriate policies before granting client access. GRANT controls access to the object; RLS controls access to rows. Neither replaces the other.
- Backend-only tables must not receive client grants. Explicitly revoke access from `PUBLIC`, `anon`, and `authenticated` where needed to avoid inherited legacy defaults, and grant only the required backend privileges. RLS bypass does not replace object privileges for `service_role`.
- Grant sequence privileges only when the role needs them for generated IDs. Review view access and function EXECUTE permissions separately, especially SECURITY DEFINER functions; do not expose internal helpers automatically.
- Verify intended allowed and denied operations for each relevant role. Do not run a destructive database reset against a linked/live project to test migrations.
- Do not rewrite already-applied migrations merely to change live permissions. Use a new narrowly scoped corrective migration when an existing access issue is confirmed.

Reference: https://supabase.com/docs/guides/api/securing-your-api
