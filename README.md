# Geotracia — Dashboard operativo (fase inicial)

## Cambios
- Sustituye cifras y actividad demostrativa del dashboard por valores iniciales en cero.
- Añade seis indicadores operativos de base: extensión de red, incidencias abiertas, inspecciones, mantenimiento pendiente, inventario y prioridades críticas.
- Añade paneles de prioridades y actividad reciente con estados vacíos explícitos.
- Añade las cuatro visualizaciones aprobadas: incidencias por severidad, evolución temporal, mapa operativo y estado del mantenimiento.
- Mantiene los valores en cero hasta que se implementen y conecten las consultas y funciones de datos reales.
- No modifica intencionalmente la lógica de los demás módulos.

## Archivos modificados
- `app.js`
- `styles.css`

## Validación
- `node --check app.js` completado correctamente.
- Las visualizaciones muestran placeholders y cero, no se presentan como datos reales.

## Siguiente fase
Definir y validar con el esquema real de Supabase las tablas, campos, estados, filtros por organización/proyecto/período y fórmulas. Luego conectar las consultas, validar permisos/RLS y sustituir los ceros por datos calculados.
