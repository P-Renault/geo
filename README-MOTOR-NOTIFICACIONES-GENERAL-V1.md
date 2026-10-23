GEOTRACIA — MOTOR GENERAL DE NOTIFICACIONES v1

Incluye:
- Lectura de hasta 50 notificaciones del usuario autenticado desde geotracia_notifications.
- Contador de pendientes y panel de notificaciones existente.
- Marcar una notificación o todas como leídas.
- Actualización en tiempo real por Supabase Realtime, con actualización al volver a la pestaña.
- Cierre del canal y limpieza del estado al cerrar sesión.
- SQL idempotente con RLS: el usuario solo lee sus filas y solo puede actualizar read_at.
- No se crean notificaciones ficticias y no se concede INSERT al navegador.

INSTALACIÓN:
1. En Supabase SQL Editor, ejecutar 202610230009_geotracia_notifications_engine_v2.sql.
2. Verificar en Database > Replication que geotracia_notifications esté en supabase_realtime si Realtime está habilitado.
3. Desplegar el ZIP completo en GitHub Pages.
4. Iniciar sesión y pulsar la campana. Probar con una notificación real creada por un proceso backend autorizado.

IMPORTANTE:
- La migración configura almacenamiento/lectura/actualización de estado y realtime; no genera avisos automáticamente para todos los módulos.
- Para que haya avisos de incidencias, inspecciones, asignaciones, proyectos o suscripciones, cada operación backend debe insertar una fila para el destinatario correcto. No se permite insertar notificaciones desde el navegador para evitar suplantación.
- No probado contra la instancia remota del usuario. Validar RLS, publicación Realtime y los procesos que generan eventos antes de producción.
