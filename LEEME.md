# Geotracia — Informes y exportaciones corregido

Archivos diferenciales: `app.js`, `index.html`, `styles.css`.

Cambios:
- El selector de proyecto se rellena después de cargar los proyectos autorizados desde Supabase.
- No se consulta ni muestra ningún KPI hasta seleccionar explícitamente un proyecto.
- Se sustituyó la tarjeta técnica “Fuentes de datos” por opciones de exportación CSV, Excel compatible y PDF mediante impresión del navegador.
- Los estados habituales en inglés se muestran en español en la tabla de resultados.
- Se actualizó la versión CSS en `index.html` para invalidar caché.

Excel se entrega como `.xls` HTML compatible con Excel; no es un archivo `.xlsx` nativo. El PDF usa la ventana de impresión del navegador y permite elegir “Guardar como PDF”.

No se modificó el esquema de Supabase. Las consultas siguen dependiendo de que las tablas y políticas RLS existentes permitan leer los registros.
