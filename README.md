# Geotracia — Dashboard trazado V4

## Alcance
Solo se reemplaza el mapa esquemático del dashboard por un mapa Leaflet real. No modifica persistencia de proyecto ni los datos.

## Archivos
- `app.js`: añade carga de caminos y geometrías en el dashboard usando la misma RPC y parámetro que `roads.js`: `geotracia_project_road_geometries({ p_project_id })`. Usa la estructura `road_id` + `geojson`, la misma interpretación GeoJSON, `L.geoJSON`, estilo y ajuste de límites del módulo Caminos y tramos.
- `index.html`: cambia la versión del recurso `app.js` para invalidar caché.

## Instalación
Reemplazar ambos archivos en la raíz del proyecto y publicar. No ejecutar SQL.

## Verificación
Al abrir Dashboard, el selector carga proyectos de la organización; al elegir uno, consulta `roads` y la RPC existente, dibuja geometrías en azul y permite seleccionar camino para resaltarlo en rojo y centrar el mapa. El estado indica cuántos caminos tienen geometría y cuántos no.

## Limitación
La comprobación local `node --check app.js` pasó. No se pudo ejecutar una sesión autenticada contra la instancia real de Supabase, por lo que el resultado de red/RLS debe confirmarse en el entorno desplegado.
