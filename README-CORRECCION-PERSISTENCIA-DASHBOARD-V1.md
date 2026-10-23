# Geotracia 1.4 — corrección de persistencia del proyecto del dashboard

## Alcance
Este cambio corrige exclusivamente cómo el dashboard recupera la selección del proyecto. No modifica el mapa, los motores de trazado, las consultas de indicadores ni el esquema de Supabase.

## Cambio técnico
- Guarda la selección por usuario y organización.
- Guarda también la organización asociada a la última selección global.
- Al entrar al dashboard, recargarlo, cambiar el período o actualizar los datos, prioriza la selección guardada válida antes que un `dashboardProjectId` antiguo en memoria.
- Solo el cambio explícito del selector tiene prioridad inmediata sobre la selección guardada.
- Si el proyecto guardado ya no está disponible o está archivado, usa el primer proyecto activo disponible y guarda esa selección.
- Actualiza la versión de `app.js` para invalidar la caché del navegador.

## Archivos
- `app.js`
- `index.html`

## Prueba de aceptación
1. Abrir dashboard, seleccionar un proyecto distinto y esperar que termine de cargar.
2. Recargar la página.
3. Confirmar que el selector conserva el mismo proyecto y que los indicadores corresponden a ese proyecto.
4. Navegar a otro módulo y volver al dashboard: la selección debe mantenerse.
5. Cambiar el período y pulsar actualizar: el proyecto seleccionado no debe cambiar.
6. Si se cambia de usuario u organización, no debe restaurarse un proyecto de otra organización.

No se requiere ejecutar SQL. La comprobación local confirma sintaxis JavaScript, pero la aceptación final debe probarse en la sesión real de Supabase.
