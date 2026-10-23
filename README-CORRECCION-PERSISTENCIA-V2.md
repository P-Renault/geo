GEOTRACIA 1.4 — CORRECCIÓN DE PERSISTENCIA DEL SELECTOR (V2)

Objetivo
Corregir el restablecimiento del proyecto seleccionado y el bloqueo temporal del selector del dashboard al recargar.

Cambios aplicados
1. loadGeoProjects ahora comparte una única promesa mientras la sesión, organización y proyectos están cargando. Evita consultas duplicadas concurrentes disparadas por los dos eventos de sesión.
2. La carga de proyectos vuelve a renderizar el dashboard al finalizar, para que el selector no permanezca mostrando el estado inicial deshabilitado.
3. Se ordena la selección de membresía por organization_id para que la organización elegida por este flujo sea determinista cuando existen varias membresías activas.
4. loadDashboardData usa un número de secuencia para descartar respuestas antiguas si otra carga más reciente ya comenzó; una respuesta tardía ya no puede sobrescribir el proyecto/indicadores actuales.
5. Se mantiene persistencia del proyecto por usuario y organización en localStorage.
6. Se actualizó la versión del archivo app.js en index.html para evitar que el navegador reutilice el JavaScript anterior desde caché.

Archivos modificados
- app.js
- index.html

Pruebas realizadas
- node --check app.js: correcto.
- Revisión estática de las llamadas concurrentes y de los puntos de retorno de carga: aplicada.

Pendiente de verificación en el entorno real
No puedo afirmar que quedó validado contra tu sesión de Supabase sin ejecutar el sitio conectado. Prueba seleccionar proyecto B, esperar a que carguen los indicadores, recargar y comprobar que permanece B. Si la cuenta tiene más de una organización activa, esta versión selecciona la primera organización en orden por ID; para permitir escoger organización, se necesitaría un selector de organización independiente.
