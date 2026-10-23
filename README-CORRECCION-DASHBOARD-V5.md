# GEOTRACIA — corrección dashboard v5

## Cambios
- El dashboard consulta primero `public.geotracia_dashboard_segment_geometries(p_project_id)` para obtener `segments.geom` persistida.
- Conserva el recorte por progresivas solo como alternativa para registros sin geometría propia.
- La selección del proyecto se guarda por usuario y organización, con compatibilidad con las claves anteriores y clave global de respaldo.
- Si la consulta de proyectos falla, no se sustituye la selección guardada por una lista vacía.
- `index.html` usa `app.js?v=dashboard-tramos-persistencia-v5` para evitar caché antigua.

## Instalación
1. Ejecuta `20261023_geotracia_dashboard_segment_geometries.sql` en Supabase SQL Editor si todavía no se ejecutó.
2. Sustituye `app.js` e `index.html` en la raíz del repositorio.
3. Publica GitHub Pages.
4. Inicia sesión, elige un proyecto, recarga y confirma que se conserva. Luego selecciona un tramo que tenga `segments.geom` y verifica su trazado.

## Importante
La geometría solo se dibuja si el registro `segments.geom` contiene una geometría válida y el usuario tiene permisos de lectura. Si la función RPC falla, el dashboard registra el error en consola y muestra el aviso de geometría.
