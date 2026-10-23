# Integración del trazado V4 sobre Geotracia 1.4

Esta entrega parte del ZIP geo-Desarrollo-1.4 y conserva sus módulos, consultas de indicadores, datos reales, simuladores y persistencia. Los cambios se limitan al trazado del mapa operativo del dashboard y al versionado de caché de app.js.

## Cambios
- Usa `geotracia_project_road_geometries({p_project_id})`, igual que `roads.js`.
- Normaliza GeoJSON devuelto como objeto, string o Feature.
- Usa `roads.geom` como fallback si falla la RPC.
- Dibuja caminos con Leaflet y los resalta en rojo al seleccionar; conserva tramos, incidencias y los demás datos del dashboard.
- Lista todos los caminos del proyecto, incluidos los que no tienen geometría disponible.

## Validación
Se valida sintaxis con `node --check app.js`. La conexión real con Supabase no se puede validar desde este entorno; el resultado depende de que el proyecto tenga geometría en la RPC o en `roads.geom`. No se requiere ejecutar SQL nuevo.
