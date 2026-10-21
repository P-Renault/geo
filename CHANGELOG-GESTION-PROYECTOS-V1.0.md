# GEOTRACIA · Gestión de proyectos territoriales v1.0

## Funcionalidad incluida
- Alta, consulta, edición y archivado lógico de proyectos, con persistencia real en Supabase.
- Clasificación por tipo, estado y prioridad; mandante y responsable.
- Ubicación por región, comuna, dirección/referencia y coordenadas WGS 84 opcionales.
- Planificación de inicio/término y presupuesto referencial en CLP, UF o USD.
- Objetivos, alcance y descripción.
- Directorio con búsqueda y filtros por estado/tipo, indicadores del portafolio y exportación CSV.
- Ficha detallada del proyecto y enlace a OpenStreetMap cuando se han indicado coordenadas.
- Archivado lógico para conservar el historial; auditoría best-effort en audit_logs.
- Validaciones de fechas, presupuesto y coordenadas en interfaz y base de datos.
- Conserva el diseño, la navegación, autenticación y módulos existentes.

## Instalación
1. Respaldar la versión actual de `app.js`.
2. En Supabase SQL Editor ejecutar `supabase/migrations/202610200001_project_management.sql`. Esta migración amplía `public.projects` sin borrar ni reemplazar filas.
3. Reemplazar `app.js` por el archivo de este paquete. No reemplazar `index.html`, `styles.css`, `auth.js` ni la configuración Supabase.
4. Publicar los cambios y probar creación, edición, búsqueda, ficha, CSV y archivado con una cuenta autenticada que pertenezca a una organización.

## Dependencias
Presupone las migraciones `202610190001_initial_geotracia.sql` y `202610190002_backend_projects.sql` ya aplicadas.

## Validación
Se revisó la estructura y sintaxis JavaScript del archivo y se generó el paquete. No se ejecutó contra la instancia Supabase real del usuario; la prueba final de persistencia y RLS debe hacerse en su entorno.
