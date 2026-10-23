# Ajuste de presentación del dashboard Geotracia

## Cambios
- Normalización visual de tarjetas, márgenes, tipografía, etiquetas y estados vacíos.
- Leyendas de gráficos alineadas horizontalmente y barras con etiquetas/valores separados para evitar texto concatenado en móvil.
- Tendencia temporal con leyenda clara y gráfico SVG escalable.
- Traducción al español de estados operativos habituales (`open`, `in_progress`, `resolved`, `archived`, etc.) en actividad y ventanas emergentes.
- Mapa Leaflet con lista de caminos que disponen de geometría.
- Al seleccionar un camino en la lista o directamente en el mapa, solo ese camino cambia a azul y aumenta el grosor; el resto conserva su estilo turquesa. El mapa enfoca el camino seleccionado.
- Actualización de parámetros de versión en `index.html` para evitar que el navegador mantenga los CSS/JS previos en caché.

## Archivos del paquete diferencial
- `app.js`
- `styles.css`
- `index.html`

## Instalación
Reemplazar esos tres archivos en la raíz publicada del repositorio y esperar a que GitHub Pages termine el despliegue. Después, recargar la página con la caché actualizada.

## Nota
El mapa solo puede trazar caminos con geometría válida devuelta por la función geográfica ya configurada. No se inventan geometrías. La validación de sintaxis JavaScript se realizó con `node --check`; no se ha ejecutado una prueba conectada contra la instancia productiva de Supabase desde este entorno.
