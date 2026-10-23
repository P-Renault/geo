# Geotracia 1.4 — inicialización dashboard V3

Cambios limitados a `app.js` e `index.html`.

- Añade una inicialización explícita de sesión al arrancar, además del evento `geotracia:session`.
- El botón de reintento consulta primero `auth.getSession()` y actualiza la etapa antes de consultar organización/membresías/proyectos.
- Informa si el reintento no encuentra sesión o falla antes de consultar membresías.
- Actualiza la versión de `app.js` para evitar caché anterior.

No modifica SQL, datos ni políticas RLS.

Validación local: `node --check app.js` correcto. Falta probar en la sesión real de Supabase y GitHub Pages.
