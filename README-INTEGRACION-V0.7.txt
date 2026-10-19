# GEOTRACIA — Mapa v0.7 (MOP + OSM)

## Qué integra
- Conserva `map-gps.js` y `map-gps-v06.js`: GPS, mapa base, satélite, etiquetas de Esri y consulta de calles/hitos OSM.
- Añade capas oficiales de la Dirección de Vialidad del MOP mediante servicios ArcGIS REST:
  - Red vial de Chile.
  - Puentes.
  - Emergencias viales.
  - Infraestructura vial: peajes, túneles, balsas y plazas de pesaje.
  - Catastro vial: incluye capas de puentes, señales, paraderos, saneamiento y otros elementos.
- Añade un selector de capas en la esquina superior derecha del mapa. Por defecto activa puentes y emergencias.
- No sobrescribe archivos existentes del GPS.

## Instalación
1. Copia `map-gps-v07-mop.js` y `map-gps-v07-mop.css` a la raíz del repositorio `P-Renault/geo`.
2. En `index.html`, dentro de `<head>`, agrega:
   `<link rel="stylesheet" href="map-gps-v07-mop.css">`
3. Al final de `index.html`, después de `map-gps-v06.js` y antes de `</body>`, agrega:
   `<script src="map-gps-v07-mop.js"></script>`
4. Publica en la rama que sirve GitHub Pages y comprueba el sitio en escritorio y móvil.

## Orden de scripts
Leaflet → `map-gps.js` → `map-gps-v06.js` → `map-gps-v07-mop.js`.
El módulo carga Esri Leaflet desde CDN cuando se crea el mapa.

## Fuentes y límites
Servicios públicos MOP:
- https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Red_Vial_Chile/MapServer
- https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Puentes/MapServer
- https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Emergencias_Vialidad/MapServer
- https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Infraestructura_Vial/MapServer
- https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Catastro_Vial/MapServer

La capa MOP se visualiza desde los servicios remotos; este módulo no descarga ni almacena los datos. La disponibilidad, escalas y actualización dependen del MOP. El servicio de emergencias indica actualización aproximada los lunes a las 15:00 y, durante emergencias, diariamente a esa hora. No debe interpretarse como sistema de alerta oficial en tiempo real.

La consulta OSM del v0.6 depende de Overpass y de la cobertura de OpenStreetMap. Respetar la atribución de OSM y Esri. Los eventos propios de GEOTRACIA en Supabase todavía requieren confirmar el esquema real de incidencias; este paquete no inventa ni conecta una tabla no verificada. La geometría persistente de roads/segments y el cálculo de progresivas también requieren un modelo GIS/PostGIS confirmado.

## Prueba rápida
- Abre Mapa y GPS.
- Enciende GPS o céntrate en Temuco.
- Abre el selector de capas.
- Activa Red vial MOP y Catastro vial MOP; acerca el mapa si es necesario.
- Si el servicio MOP falla, verifica el acceso al endpoint en el navegador y revisa la consola.
