# Geotracia B2 — optimización de carga del dashboard V1

## Objetivo
Reducir el tiempo percibido de carga sin cambiar el esquema, las políticas RLS, la selección de proyecto ni la lógica de trazado.

## Cambios en app.js
- Las seis consultas tabulares del dashboard siguen ejecutándose en paralelo.
- Los KPI, listas y resúmenes se publican en cuanto terminan las consultas tabulares.
- Las dos consultas RPC de geometrías (caminos y tramos) ahora se ejecutan en paralelo, en vez de secuencialmente.
- El dashboard actualiza las geometrías posteriormente, sin hacer esperar a los KPI a que termine el trabajo cartográfico.
- Se mantiene la comprobación de secuencia para ignorar resultados de cargas anteriores.
- Si falla una RPC de geometría, se conserva el aviso y el fallback existente.

## Caché
Se incrementó la versión de app.js y auth.js en index.html para forzar la descarga del código nuevo. No se modificaron credenciales ni supabase-config.js.

## Verificación
- `node --check app.js`: correcto.
- Pendiente: medir con una sesión real de Supabase la duración de las consultas y validar visualmente el dashboard en móvil.
- Esta optimización reduce la espera del render inicial; no garantiza reducir el tiempo de respuesta del servidor o de la red.
