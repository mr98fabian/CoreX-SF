# Misión 15 — RLS en Supabase (proyecto CoreX, producción), 2026-11-25

Solo lectura de catálogo vía MCP de Supabase. Ningún dato de usuario leído.

## Consulta 1 — RLS, políticas y privilegios por tabla
```sql
select n.nspname as schema, c.relname as tabla, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls,
 (select count(*) from pg_policies p where p.schemaname=n.nspname and p.tablename=c.relname) as politicas,
 has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
 has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname='public' order by 2;
```

| tabla | rls | políticas | anon SELECT | authenticated SELECT |
|---|---|---|---|---|
| access_codes | ✅ | 0 | no | no |
| access_grants | ✅ | 0 | no | no |
| accounts | ✅ | 0 | no | no |
| alembic_version | ✅ | 0 | no | no |
| api_token_audit | ✅ | 0 | no | no |
| api_tokens | ✅ | 0 | no | no |
| cashflow_items | ✅ | 0 | no | no |
| coach_profiles | ✅ | 0 | no | no |
| cut_history | ✅ | 0 | no | no |
| **email_log** | ✅ | 0 | no | no |
| engagement_points | ✅ | 0 | no | no |
| goals | ✅ | 0 | no | no |
| house_goals | ✅ | 0 | no | no |
| league_weeks | ✅ | 0 | no | no |
| movement_log | ✅ | 0 | no | no |
| oauth_clients | ✅ | 0 | no | no |
| oauth_codes | ✅ | 0 | no | no |
| oauth_refresh_tokens | ✅ | 0 | no | no |
| **push_devices** | ✅ | 0 | no | no |
| **push_log** | ✅ | 0 | no | no |
| recurring_subscriptions | ✅ | 0 | no | no |
| subscriptions | ✅ | 0 | no | no |
| sync_state | ✅ | 0 | no | no |
| transactions | ✅ | 0 | no | no |
| user_settings | ✅ | 0 | no | no |
| users | ✅ | 0 | no | no |
| webauthn_challenges | ✅ | 0 | no | no |
| webauthn_credentials | ✅ | 0 | no | no |

28/28 con RLS. Cero políticas = **deny-by-default correcto** para este diseño (el backend entra
como `postgres`, que salta RLS; el frontend solo usa Supabase Auth). Doble barrera: además de RLS,
`anon` y `authenticated` no tienen ni el privilegio SELECT.

## Consulta 2 — vistas, funciones, buckets y otros esquemas expuestos
```sql
-- vistas en public; funciones en public (SECURITY DEFINER / EXECUTE de anon); buckets de storage;
-- tablas de otros esquemas sin RLS legibles por anon
```
Resultado: 0 vistas, 0 funciones en `public`, 0 buckets, 0 tablas de otros esquemas sin RLS
legibles por `anon`.

## Advisor de seguridad de Supabase
- `rls_enabled_no_policy` (INFO) ×28 — esperado, es el diseño deny-by-default.
- `auth_leaked_password_protection` (WARN) — **desactivada**. → hallazgo H-07.

## Llave service-role
- Código: solo `backend/supabase_admin.py` la lee (`SUPABASE_SERVICE_ROLE_KEY`, en tiempo de llamada, nunca se loguea).
- Cliente: `frontend/src` solo usa `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  `grep -rn "SERVICE_ROLE|service_role" frontend/ (sin node_modules)` → 0 coincidencias.
- Barrido de secretos (secretos.txt): ningún JWT ni `sb_secret_` en árbol ni historial.
