# Geotracia 1.4 — Ajustes puntuales premium V1.1

Base: Geotracia 1.4, rediseño premium de módulos V1 sin diagnóstico.

## Cambios
- Añadido margen superior de 14 px (12 px en móvil) entre el panel de selección de proyecto y la fila de KPI cuando son elementos hermanos directos. Esto corrige el espacio en Operaciones y permisos e Informes y exportaciones sin alterar otras tarjetas.
- Centrado exclusivamente el contenido de las tarjetas de planes en Administración y suscripciones: etiqueta GEOTRACIA, nombre del plan, precio, periodicidad, descripción, características y botón.
- Conservados iconos, navegación, notificaciones, lógica JS, consultas, autenticación, persistencia, mapa y datos.
- Incrementada la versión de caché de `premium-ui.css`.

## Archivos modificados
- `premium-ui.css`
- `index.html`

No requiere SQL ni cambios de Supabase. Verificar en móvil: Operaciones y permisos, Informes y exportaciones, Administración y suscripciones (mensual y anual).
