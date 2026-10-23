# Geotracia Dashboard — corrección v6

## Archivos
- `app.js`: restauración robusta del proyecto elegido, listado de todos los caminos (aunque falte geometría vial), uso de geometrías de segmento y refuerzo del estado del mapa.
- `index.html`: invalida la caché de JavaScript usando `app.js?v=dashboard-tramos-persistencia-v6`.
- `20261023_geotracia_dashboard_segment_geometries.sql`: función SQL usada por el dashboard para obtener `segments.geom`.

## Aplicación
1. En Supabase SQL Editor, ejecutar el SQL solo si la función aún no existe o necesita actualizarse.
2. En la raíz de GitHub Pages, reemplazar `app.js` e `index.html`.
3. Publicar y hacer una recarga forzada.
4. Seleccionar un proyecto y recargar. Luego seleccionar un camino en el listado.

## Alcance y limitaciones
El dashboard dibuja geometrías reales devueltas por `roads.geom` y `segments.geom`. Cuando un segmento no tiene geometría propia, se intenta derivar desde la geometría del camino y sus progresivas. Esto solo es correcto si las progresivas están referidas al inicio de esa geometría y la longitud declarada corresponde al mismo trazado. Si no hay geometría de camino ni de segmento, el código informa que la geometría está pendiente; no inventa coordenadas.
La persistencia se guarda en localStorage por usuario/organización, con claves de compatibilidad. No se pudo ejecutar contra la instancia productiva de Supabase desde este entorno.
