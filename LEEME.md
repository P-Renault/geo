# Geotracia — Motor de notificaciones v2

## Archivos
- `app.js`: campana con consultas a Supabase, lista, contador no leído y acciones de marcar como leído.
- `styles.css`: campana dorada sin fondo decorativo y estilos de lista/estados.
- `index.html`: referencia versionada al CSS.
- `202610230005_geotracia_notifications.sql`: tabla, índices y RLS.

## Instalación
1. Respaldar `app.js`, `styles.css` e `index.html`.
2. Ejecutar el SQL en el SQL Editor del proyecto Supabase correcto.
3. Sustituir los tres archivos de la raíz del repositorio.
4. Publicar y probar con una sesión autenticada.

## Seguridad y alcance
- La tabla solo permite leer y actualizar notificaciones cuyo `user_id` sea el usuario autenticado.
- El cliente no puede crear notificaciones directamente; la creación debe añadirse a operaciones de servidor autorizadas o triggers revisados según los esquemas reales.
- No se insertan datos de demostración. La campana mostrará cero notificaciones hasta que las funciones productivas generen filas.
- El paquete implementa la bandeja persistente, el contador y el estado leído/no leído; la generación automática de eventos para incidencias, inspecciones y mantenimiento requiere conectar los productores de eventos a los esquemas exactos de esos módulos.
