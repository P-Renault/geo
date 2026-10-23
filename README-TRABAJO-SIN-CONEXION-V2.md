# GEOTRACIA 1.4 · Trabajo sin conexión V2

## Cambios incluidos
- El pie del menú lateral muestra el estado real de conectividad: “Conectado a internet” o “Sin conexión a internet”, más la disponibilidad de copias locales.
- Se eliminó la tarjeta ficticia de usuario que aparecía en la parte inferior del menú lateral. El avatar superior y los iconos de navegación/notificaciones permanecen intactos.
- El Service Worker se registra automáticamente y guarda la carcasa de la aplicación, estilos, scripts y recursos estáticos para abrir la interfaz tras una visita online.
- IndexedDB guarda copias separadas por usuario/organización/proyecto.
- “Preparar proyecto” guarda caminos y tramos completos cuando las consultas están disponibles, datos del dashboard, geometrías de caminos y tramos, e intenta guardar operaciones, asignaciones y formularios disponibles.
- El dashboard y el módulo Caminos y tramos pueden restaurar una copia de proyecto y dibujar las geometrías sin conexión; sin conexión se omite la capa de teselas externas.
- Se incorporó captura de observaciones locales con almacenamiento persistente y sincronización manual a `public.geotracia_offline_records` cuando vuelve la conexión.
- Se puede exportar respaldo JSON y limpiar las copias/cola local mediante confirmación explícita.

## Despliegue
1. Publica los archivos del paquete en la raíz que utiliza GitHub Pages. Conserva el `supabase-config.js` de producción; no lo reemplaces por el archivo de ejemplo del ZIP.
2. La migración `202610230001_geotracia_offline_records.sql` debe estar aplicada para sincronizar observaciones. No la repitas si ya está aplicada.
3. Abre Geotracia con conexión, inicia sesión y entra a **Trabajo sin conexión**.
4. Selecciona el proyecto y pulsa **Preparar proyecto**. Espera a que finalice; revisa los caminos, tramos, trazados y advertencias de fuentes no disponibles.
5. Exporta un respaldo antes de salir a terreno. Al recuperar conexión, pulsa **Sincronizar ahora**.
6. Verifica en un dispositivo de prueba: prepara el proyecto online, activa modo avión, recarga la app y abre **Caminos y tramos**. Comprueba que aparecen caminos/tramos y trazados guardados.

## Limitaciones que no deben ocultarse
- Los datos y las geometrías guardadas pueden consultarse sin señal. Los módulos que modifican inspecciones, inventario, incidencias, mantenimiento, formularios y operaciones todavía requieren adaptadores de escritura offline por entidad antes de poder afirmar que todas sus altas/ediciones funcionan sin conexión. Esta V2 incluye una cola común de observaciones de terreno.
- **El fondo cartográfico completo (teselas OSM) no se descarga.** El servidor público estándar de OpenStreetMap no debe usarse para precarga masiva/offline. Para mostrar calles/fondo de mapa sin señal hay que configurar un proveedor que autorice explícitamente descarga offline o servir un paquete cartográfico con licencia adecuada. Sin esa fuente, las geometrías viales se dibujan sobre una cuadrícula neutra, no sobre el mapa base.
- El Service Worker almacena recursos estáticos; no guarda automáticamente todas las teselas, archivos de terceros o datos de Supabase. Los datos del proyecto se preparan explícitamente en IndexedDB.
- IndexedDB puede borrarse desde la configuración del navegador o por el propio sistema. Exporta respaldos si los datos locales son críticos.

## Validación local
- `node --check app.js`
- `node --check roads.js`
- `node --check service-worker.js`
- Verificación de existencia de los recursos estáticos declarados en el Service Worker.

No se afirma que el modo offline esté validado en producción hasta completar la prueba real con la cuenta de Supabase, la migración/RLS y un dispositivo en modo avión.
