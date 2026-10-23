GEOTRACIA — Corrección de persistencia y resaltado del dashboard

Archivos:
- app.js: versión actualizada.
- 20261023_geotracia_dashboard_segment_geometries.sql: función de consulta de geometrías, si aún no se ejecutó.

Cambios:
1. Persiste el proyecto seleccionado del dashboard en localStorage con una clave por organización.
2. Tras recargar, valida que el proyecto guardado siga disponible y lo restaura; si ya no está disponible, selecciona el primer proyecto activo.
3. Al seleccionar un camino, refuerza visualmente su geometría real en azul; al seleccionar un tramo, resalta la geometría del tramo en ámbar y centra el mapa.
4. No crea ni infiere coordenadas. Si no existe geometría real de tramo, resalta la geometría vial real disponible y lo informa.

Instalación:
- Reemplazar app.js en la raíz del repositorio por el contenido de este archivo.
- Cambiar la versión del script en index.html a ?v=dashboard-persistencia-resaltado-v3 (o usar el index.html del paquete completo).
- Publicar GitHub Pages y recargar la página.

Nota: la persistencia de selección es específica del dashboard y del navegador. Si se borra el almacenamiento del sitio, el proyecto se elegirá de nuevo entre los disponibles.
