# Geotracia 1.4 — Corrección de arranque del dashboard (B2 V1)

## Objetivo
Corregir el caso en que el acceso inicial funciona, pero tras recargar el navegador no se cargan automáticamente la organización, los proyectos y los indicadores hasta pulsar «Actualizar».

## Causa técnica abordada
`auth.js` podía resolver `getSession()` y emitir `geotracia:session` antes de que `app.js` registrara su listener. En ese caso, el evento se perdía y el dashboard no iniciaba la carga; el botón Actualizar la disparaba manualmente, por lo que los datos aparecían.

## Cambios
- `app.js`: añade `initializeGeoAppSession()`, que consulta `client.auth.getSession()` explícitamente al terminar de registrar los listeners y carga organización/proyectos/dashboard cuando ya existe una sesión.
- `app.js`: el listener de `geotracia:session` ahora coordina la carga de proyectos y luego la del módulo activo.
- `auth.js`: evita emitir el evento de sesión más de una vez para el mismo usuario durante la carrera entre `getSession()` y `onAuthStateChange()`; limpia la marca al cerrar sesión.
- `index.html`: cambia las versiones de caché de `auth.js` y `app.js`.

## Validaciones realizadas
- `node --check app.js` — OK.
- `node --check auth.js` — OK.
- No se modificaron SQL, RLS, credenciales ni datos.

## Prueba requerida en GitHub Pages
1. Reemplazar `app.js`, `auth.js` e `index.html` con los de este paquete en la raíz publicada (mantener `supabase-config.js` actual sin cambios).
2. Abrir el sitio, iniciar sesión y comprobar que dashboard y métricas cargan.
3. Recargar la página una vez.
4. Confirmar que el selector y los indicadores se restauran sin pulsar «Actualizar».
5. Navegar a otro módulo y volver al dashboard.

La comprobación local de sintaxis no sustituye la validación con la sesión real de Supabase.
