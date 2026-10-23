# Geotracia 1.4 — Diagnóstico de sesión y carga de proyectos V2

## Objetivo
Identificar desde el dashboard móvil si el bloqueo se produce al restaurar la sesión, consultar `public.members` o consultar `public.projects`.

## Cambios
- El panel de diagnóstico ahora muestra correo e ID del usuario que `auth.getUser()` devuelve en la sesión activa.
- Muestra la etapa de inicialización, número de membresías devueltas, organización, cantidad de proyectos y código/detalle de error Supabase (si existe).
- La consulta a `members` devuelve todos los registros activos del usuario en vez de limitar silenciosamente a uno antes de diagnosticar.
- El botón de reintento limpia el estado de organización/proyectos y repite el flujo completo.
- Se actualizó la versión de `app.js` en `index.html` para evitar caché del archivo anterior.

## Archivos modificados
- `app.js`
- `index.html`

## Seguridad y límites
- No cambia datos de Supabase, políticas RLS ni membresías.
- No se añadió ninguna clave secreta ni se muestra el token de sesión.
- El correo y UUID del usuario se muestran solo dentro de la sesión autenticada de la aplicación; no compartas una captura públicamente.

## Prueba
1. Publica los dos archivos en la raíz que utiliza GitHub Pages, conservando el resto del paquete V3.
2. Recarga el sitio y abre Dashboard.
3. Si el selector está bloqueado, captura el panel `Diagnóstico de inicialización` completo.
4. Verifica que el correo/ID mostrados correspondan a la cuenta con la que entraste. La siguiente decisión depende del estado y el error que muestre.

La comprobación `node --check app.js` pasó. La prueba en la sesión real de Supabase queda pendiente.
