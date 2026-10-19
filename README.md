# GEOTRACIA — Framework visual v0.1

Prototipo responsive de frontend construido desde cero para evaluar la dirección visual y la navegación de GEOTRACIA.

## Ejecutar
- Descomprime el ZIP.
- Abre `index.html` en un navegador moderno.
- Para una prueba local más consistente, sirve la carpeta con un servidor estático (por ejemplo Live Server de VS Code).
- Recorre los 15 módulos, prueba los formularios, filtros, navegación móvil y exportaciones.

## Incluye
- Diseño sobrio y profesional para escritorio, tablet y móvil.
- Navegación y estructura visual de 15 módulos.
- Tablas de demostración, indicadores, paneles, mapa esquemático, formularios, filtros, diálogos y notificaciones.
- Crear, editar y eliminar registros de demostración.
- Crear/editar usuarios de demostración.
- Persistencia local en el navegador mediante localStorage.
- Exportación de registros/usuarios a CSV y respaldo de datos a JSON.

## Límites
No es todavía una plataforma productiva. No incluye autenticación real, autorización en servidor, base de datos compartida, API, mapas georreferenciados reales, GPS de dispositivo, sincronización offline con servidor, licencias cartográficas, facturación real ni exportación PDF/KML implementada. Métricas y registros de ejemplo son demostrativos; no usar para decisiones operativas reales.

## Archivos
- `index.html`: estructura base.
- `styles.css`: sistema visual responsive.
- `app.js`: módulos, navegación e interacciones.
- `README.md`: instrucciones y límites.
- `CHANGELOG.md`: registro de versión.

## Siguiente fase recomendada
Definir el modelo de datos y permisos, conectar autenticación y persistencia (por ejemplo, Supabase), integrar cartografía y geolocalización, implementar cola offline y sincronización real, y ejecutar pruebas funcionales y de seguridad.
