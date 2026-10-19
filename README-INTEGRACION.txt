GEOTRACIA — MAPA v0.6
======================

ARCHIVOS
- map-gps-v06.js: etiquetas satelitales, caminos y elementos de infraestructura cartografiados en OpenStreetMap.
- map-gps-v06.css: estilos de ventanas emergentes.
- index-fragment.txt: líneas para integrar los archivos en index.html.

INTEGRACIÓN
1. Sube map-gps-v06.js y map-gps-v06.css a la raíz de P-Renault/geo.
2. En index.html, agrega dentro de <head>, después de map-gps.css:
   <link rel="stylesheet" href="map-gps-v06.css">
3. Antes de </body>, después de map-gps.js:
   <script src="map-gps-v06.js"></script>
4. Confirma los cambios en la rama publicada por GitHub Pages y espera el despliegue.

QUÉ INCLUYE
- En vista satelital, superpone una capa de nombres y límites de Esri.
- A partir del zoom 12, consulta OpenStreetMap Overpass para trazar calles/caminos y mostrar elementos cartografiados como puentes, cruces, señales de tránsito, luminarias y barreras cuando estén mapeados.
- Reduce las consultas por frecuencia y extensión del mapa; los servicios externos pueden limitar solicitudes o no responder.
- No modifica el GPS ni las funciones existentes de registro/exportación de puntos.

LIMITACIONES IMPORTANTES
- Los eventos/incidencias reales de GEOTRACIA no se conectan en este patch: el esquema actual revisado no contiene una tabla de incidencias confirmada. No se consulta una tabla supuesta ni se inventan eventos.
- Los caminos y tramos creados en GEOTRACIA todavía no se dibujan desde Supabase porque las tablas actuales no tienen una columna de geometría GIS definida en la migración revisada. Para mostrarlos se requiere guardar geometrías reales GeoJSON o PostGIS.
- Las progresivas GPS no se calculan automáticamente respecto de una geometría vial en este patch.
- OSM y Esri requieren Internet. Los datos de infraestructura dependen de la cobertura colaborativa y el uso del servicio Overpass.
