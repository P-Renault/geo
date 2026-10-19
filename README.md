# GEOTRACIA Framework v0.2 — backend y autenticación

## Incluye
- Login real con Supabase Auth: correo/contraseña, sesión persistente, cierre de sesión y recuperación de contraseña.
- Pantalla de configuración si no se han pegado las credenciales.
- Migración PostgreSQL con organizaciones, miembros, roles, proyectos, caminos, tramos, inspecciones, activos, incidencias, archivos y auditoría.
- Políticas RLS para aislar datos por organización y limitar operaciones por rol.
- Framework visual v0.1 preservado.

## Despliegue
1. En Supabase crea un proyecto y guarda la URL y la clave `anon`/`publishable` del proyecto. Nunca uses `service_role` en frontend.
2. En Supabase → SQL Editor ejecuta `supabase/migrations/202610190001_initial_geotracia.sql`. Comprueba que termine sin errores.
3. En Authentication → URL Configuration configura la URL de Cloudflare Pages en Site URL y Redirect URLs. Para recuperación añade exactamente la URL de tu despliegue.
4. Edita `supabase-config.js`: sustituye `https://TU-PROYECTO.supabase.co` y `PEGA_AQUI_TU_CLAVE_ANON_O_PUBLISHABLE`. Estos valores son públicos por diseño; RLS protege la base. No subas secretos de servidor.
5. Publica el contenido de esta carpeta en Cloudflare Pages. La carga de Supabase JS se hace desde jsDelivr.
6. En Supabase → Authentication → Users crea un usuario inicial (o habilita el registro solo si quieres auto-registro). Si creas el usuario por dashboard, la migración crea su perfil, pero no crea automáticamente una organización; para ese primer usuario puedes crear organización y membresía con SQL usando su UUID.

## Crear el primer espacio de trabajo
Después de crear un usuario en Authentication → Users, copia su UUID y ejecuta en SQL Editor, reemplazando ambos valores:

```sql
insert into public.organizations (name, created_by)
values ('Mi organización', 'UUID-DEL-USUARIO')
returning id;
```

Usa el `id` retornado para ejecutar:

```sql
insert into public.members (organization_id, user_id, role)
values ('UUID-DE-LA-ORGANIZACION', 'UUID-DEL-USUARIO', 'owner');
```

## Roles iniciales
- `owner`: propietario del espacio.
- `admin`: administración del espacio.
- `manager`: gestión operativa.
- `inspector`: crea y actualiza datos de terreno.
- `viewer`: consulta.

## Límites importantes de esta entrega
- El login sí usa Supabase Auth cuando configuras el proyecto.
- El esquema y las políticas RLS sí quedan definidos en PostgreSQL al ejecutar la migración.
- Los módulos del framework visual todavía muestran datos demostrativos y sus formularios aún no están conectados a estas tablas. Este ZIP no debe presentarse como sistema operativo completo.
- Aún faltan: registro/invitación de usuarios desde panel, selector real de organización/proyecto, CRUD conectado tabla por tabla, auditoría mediante triggers/Edge Functions, políticas y pruebas de Storage privado, cartografía real, sincronización offline, pruebas automatizadas y revisión de seguridad antes de producción.
- La migración activa PostGIS en el esquema `extensions`; valida que esté disponible en tu instancia Supabase.

## Seguridad
No desactives RLS. No coloques `service_role` en archivos frontend. Antes de producción revisa las políticas con cuentas de cada rol y dos organizaciones distintas.
