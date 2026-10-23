# Geotracia B2 — retirar panel de diagnóstico

## Cambios
- Se elimina del dashboard el panel rojo de diagnóstico de inicialización.
- Se retiran de la interfaz los campos de etapa, usuario, ID, membresías, organización, cantidad de proyectos, errores y marcas de tiempo que se agregaron para depuración.
- Se mantiene la lógica normal de carga, selección de proyecto y rendimiento.
- Se mantiene el aviso operativo de errores de fuentes del dashboard con su botón normal de reintento; no es el panel de prueba eliminado.
- Se incrementa el identificador de caché de `app.js` y `auth.js` en `index.html` para forzar la descarga del bundle actualizado.

## Archivos modificados
- `app.js`
- `index.html`

No se modifican credenciales, tablas, políticas RLS ni datos de Supabase.
