# Geotracia 1.4 — Diagnóstico visible de proyectos

Esta versión añade diagnóstico dentro del dashboard para el caso en que el selector muestre «Sin proyectos».

## Qué informa
- Si la carga aún está en curso.
- Si falló la consulta y el mensaje disponible de Supabase.
- Si la sesión fue detectada, si hay organización y cuántos proyectos son visibles.
- Si no existe membresía activa, lo informa explícitamente en vez de presentar el caso como una lista vacía normal.
- Botón para volver a consultar proyectos desde el teléfono.

## Verificación
La sintaxis de `app.js` se comprobó con `node --check`. No se puede verificar desde el paquete si la cuenta publicada tiene membresía válida ni si las políticas RLS de Supabase permiten leer `members` y `projects`; el diagnóstico visible debe mostrar cuál de esas etapas falla. No se modificaron SQL, geometrías ni el motor de trazado.
