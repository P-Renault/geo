# GEOTRACIA — Dashboard conectado a Supabase

## Cambios
- Conecta el dashboard a `roads`, `segments`, `road_incidents`, `inspections`, `road_inventory` y `maintenance_orders`.
- Filtra por `organization_id` y proyecto seleccionado; RLS de Supabase continúa siendo la barrera de autorización.
- Permite seleccionar ventana de 30, 90 o 365 días para la actividad temporal.
- Calcula indicadores, prioridades y actividad desde registros consultados; no usa `localStorage` ni las filas de demostración como fuente del dashboard.
- El mapa utiliza el RPC existente `geotracia_inventory_road_geometries(p_project_id)` y solo dibuja geometrías reales disponibles.
- Los errores de consulta se muestran como error de fuente, no como valores cero válidos.
- Añade exportación CSV de resumen del dashboard real.
- Mejora la legibilidad de los gráficos en móvil y escritorio.

## Requisitos en Supabase
Deben existir y ser accesibles para el usuario autenticado las tablas `roads`, `segments`, `road_incidents`, `inspections`, `road_inventory`, `maintenance_orders`, `projects`, `members` y `organizations`. El usuario debe tener membresía activa y RLS debe permitir lectura en su organización.

Para mostrar caminos en el mapa debe estar instalada la función `public.geotracia_inventory_road_geometries(uuid)` y existir geometría en `roads.geom`. Si el RPC o las geometrías no están disponibles, los demás indicadores pueden cargar igualmente y el mapa explicará la ausencia de geometría.

## Fórmulas utilizadas
- Longitud de red: suma de `length_m`, o `official_length_m` o `geometry_length_m` como alternativa, dividido por 1000. Es una suma de longitudes declaradas por camino, no una medición GIS recalculada.
- Incidencias abiertas: estados distintos de `resolved`, `closed`, `draft` y `archived`.
- Incidencias críticas: severidad `critical` y estado activo.
- Inspecciones: registros cuya `inspection_date` cae dentro de la ventana elegida.
- Mantenimiento pendiente: estados distintos de `completed` y `cancelled`.
- Mantenimiento vencido: `due_date` anterior a hoy, excluyendo órdenes terminadas o canceladas.
- Actividad temporal: inspecciones por `inspection_date`, incidencias por `occurred_at` y mantenimiento terminado por `completed_at`.

## Archivos
- `app.js`: consultas, cálculos, render de gráficos, mapa y exportación.
- `styles.css`: estilos responsivos de gráficos y paneles.
- `index.html`: versión de caché actualizada para evitar servir el `app.js` anterior.

## Validación
`node --check app.js` pasó. No se ejecutaron consultas contra el proyecto productivo ni se probó una sesión real de Supabase desde este entorno. Después de publicar, verificar la consola y que el usuario tenga acceso RLS a todas las tablas.
