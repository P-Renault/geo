# GEOTRACIA v0.3 — Backend operativo y proyectos

## Archivos del patch
- `app.js`: añade el módulo Proyectos conectado a Supabase: lectura, creación, edición y archivado (sin borrar el histórico), selector de organización inicial y mensajes de errores de permisos/migración.
- `auth.js`: emite el evento `geotracia:session` al confirmar una sesión para permitir refrescar módulos dependientes de autenticación.
- `supabase/migrations/202610190002_backend_projects.sql`: RPC para crear la organización propia de forma atómica, políticas RLS de proyectos y permiso de inserción de auditoría.

## Instalación
1. Aplicar primero la migración base `202610190001_initial_geotracia.sql`.
2. Ejecutar `202610190002_backend_projects.sql` desde Supabase SQL Editor.
3. Reemplazar `app.js` y `auth.js` en la ruta que usa GitHub Pages.
4. Mantener `index.html`, `styles.css`, `auth.css`, `supabase-config.js`, logos y archivos de módulos existentes sin cambios.
5. Iniciar sesión, abrir Proyectos, crear organización si aún no hay una, y luego crear/editar/archivar un proyecto.

## Alcance real de esta versión
- Los proyectos se leen y escriben en PostgreSQL mediante Supabase.
- La organización y sus proyectos están sujetos a RLS; el frontend no es el control de seguridad.
- Se intenta registrar auditoría de creación/actualización/archivo; el registro de auditoría no bloquea el guardado si falla.
- Los demás módulos operativos y KPIs del dashboard siguen siendo demostrativos/locales y no se deben presentar como datos reales todavía.

## Validación pendiente en el proyecto desplegado
No se ha ejecutado esta migración en la instancia Supabase del usuario ni se han probado sesiones de dos organizaciones distintas desde este entorno. Debe verificarse antes de producción.
