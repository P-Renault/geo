# Geotracia 1.4 — Integración del motor de trazado del dashboard

## Alcance
Este paquete se basa en `geo-Desarrollo-1.4.zip`. Solo modifica `app.js` (carga y normalización de geometrías viales del dashboard) e `index.html` (versión de caché del script). No modifica persistencia de proyecto, datos de simulación, consultas de KPIs ni otros módulos.

## Cambio
El dashboard consultaba `geotracia_inventory_road_geometries`, mientras que el módulo funcional `roads.js` utiliza `public.geotracia_project_road_geometries(p_project_id uuid)`, cuyo contrato devuelve `road_id` y `geojson`. El dashboard ahora llama a esa misma RPC, usa el mismo parámetro y normaliza `Feature`/GeoJSON como el módulo Caminos y tramos antes de dibujar la línea.

## Validación realizada
- `node --check app.js`: correcto.
- Firma contrastada con `202610210008_geotracia_project_road_geometries.sql` incluido en este ZIP.
- No se ejecutó una sesión autenticada contra el Supabase real; por ello no se afirma validación de producción.

## Despliegue
Reemplazar únicamente `app.js` e `index.html` del branch actualizado por los incluidos en el ZIP diferencial. No ejecutar SQL; la función RPC ya está definida en el paquete 1.4. Después, recargar evitando caché y seleccionar el camino en el dashboard.
