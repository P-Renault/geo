GEOTRACIA — Corrección dashboard trazado V2

Archivos incluidos: app.js, index.html.

Cambios:
- El dashboard usa la misma RPC que el módulo Caminos y tramos: geotracia_project_road_geometries({ p_project_id }).
- La longitud de referencia se obtiene de los registros roads ya consultados.
- Si la RPC falla o no devuelve geometrías válidas, se intenta usar roads.geom como fallback, igual que el módulo Caminos y tramos.
- Se actualiza la versión del script en index.html para invalidar caché.
- No se modificó la persistencia del proyecto ni se requiere ejecutar SQL.

Validación local: node --check app.js.
Pendiente: validar contra la instancia real de Supabase y datos del proyecto.
