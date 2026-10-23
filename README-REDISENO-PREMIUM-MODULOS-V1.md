# Geotracia 1.4 — Rediseño premium transversal V1

## Base
Paquete B2 sin diagnóstico, con optimización de carga ya incorporada.

## Cambios
- Añadida la capa `premium-ui.css` para unificar paneles, títulos, KPI, formularios, tablas, filtros, estados vacíos y diálogos.
- `index.html` carga la nueva hoja después de `styles.css`.
- Se conserva la lógica de `app.js`, autenticación, Supabase, persistencia y motor cartográfico.
- Se excluyen expresamente de los selectores de rediseño la navegación lateral, iconos de menú, barra superior y notificaciones.
- Reglas responsivas específicas para móvil y escritorio; se respeta `prefers-reduced-motion`.

## Pruebas realizadas
- `node --check app.js` y `node --check auth.js`.
- Comprobación de que `premium-ui.css` está enlazado una sola vez y después de `styles.css`.
- Inspección del diff para confirmar que la lógica JS no se modificó.

## Validación pendiente
La validación visual/funcional final debe realizarse en GitHub Pages en móvil y escritorio. Este paquete no se considera aprobado para producción hasta verificar navegación, formularios, tablas, mapas y notificaciones.
