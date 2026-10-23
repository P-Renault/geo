# Geotracia — Motores de lectura y escritura del espacio personal v1

## Incluido

- Lectura del usuario autenticado desde Supabase Auth.
- Lectura/escritura de `user_metadata.display_name` y `user_metadata.phone` mediante `auth.updateUser`.
- Lectura y escritura de preferencias en `public.geotracia_user_preferences`.
- Consulta de eventos propios desde `public.geotracia_user_audit_events`.
- Consulta complementaria de eventos de `public.audit_logs` filtrados por `actor_id`, si la tabla y sus políticas permiten la lectura.
- KPI de actividad, cambios, registros pendientes y sesión actual.
- Resumen de actividad reciente y estado de almacenamiento local.
- Exportación CSV de los eventos visibles tras aplicar filtros.
- Políticas RLS de alcance propio. Los eventos nuevos de perfil/preferencias se escriben mediante triggers de PostgreSQL, no desde el navegador; la tabla de auditoría no concede INSERT/UPDATE/DELETE al usuario.
- Cambio de versión de caché del Service Worker para forzar la actualización de los archivos desplegados.

## Instalación obligatoria

1. Abre Supabase Dashboard → SQL Editor.
2. Ejecuta completo `202610230007_geotracia_user_space_engines.sql`.
3. Comprueba que se crearon `geotracia_user_preferences` y `geotracia_user_audit_events`, además de sus políticas y triggers.
4. Despliega el paquete completo en GitHub Pages.
5. En el navegador móvil, cierra y vuelve a abrir Geotracia o recarga la página para que se active el Service Worker nuevo.
6. Entra a **Configuración y auditoría** y prueba: cargar perfil, guardar perfil, guardar preferencias, actualizar historial y exportar CSV.

## Comportamiento

- El correo se lee de Supabase Auth y permanece de solo lectura en esta vista.
- El nombre y el teléfono se guardan en los metadatos de la cuenta autenticada.
- Las preferencias se guardan por `user_id`; la política RLS limita lectura y escritura a la propia cuenta.
- El historial propio de la nueva tabla no permite edición ni borrado desde el cliente.
- La consulta de `audit_logs` heredada es complementaria y puede no devolver datos si sus políticas no permiten lectura propia o si su esquema difiere. Los errores de esa consulta complementaria no bloquean la auditoría nueva.
- El navegador no expone de forma fiable el tamaño de IndexedDB por módulo. La interfaz informa el número de proyectos preparados y registros pendientes, no inventa bytes utilizados.
- La tarjeta de sesión refleja la sesión actual. No afirma contar todas las sesiones activas porque Supabase Auth no entrega esa lista al cliente estándar.

## Límites conocidos

- No se implementa cierre remoto de sesiones ni lista de dispositivos.
- La auditoría nueva registra cambios del perfil y preferencias mediante triggers de base de datos. Para considerar las acciones operacionales como una auditoría inmutable integral, cada operación crítica debe auditarse en PostgreSQL/Edge Functions; las inserciones que la aplicación existente hace desde el navegador en `audit_logs` dependen de su esquema y permisos actuales.
- Esta migración no modifica la configuración global de plataforma, que sigue siendo responsabilidad administrativa de Somos Software.

## Verificación técnica realizada

- `node --check app.js`.
- Comprobación de que el ZIP se genera y se puede listar.

La migración debe ejecutarse en el proyecto Supabase conectado y las pruebas funcionales requieren sesión real; no se afirma que la base remota ya tenga aplicada esta migración.
