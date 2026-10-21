# GEOTRACIA — paquete de ajustes preliminares

Este ZIP contiene los archivos del menú lateral y una guía para integrar el logotipo.
**No es todavía la integración completa de la red vial nacional.** La consulta de
`public.geotracia_national_roads` requiere ajustar el módulo de caminos según el
esquema exacto de esa tabla y el mecanismo de consulta actual. No se debe desplegar
como si esa parte ya estuviera resuelta.

## Archivos incluidos
- `sidebar-toggle.js`: elimina el control visible de cierre; el menú se cierra al tocar
  fuera, seleccionar un módulo o pulsar Escape.
- `sidebar-toggle.css`: estilos para ocultar el botón de cierre y mostrar el logotipo.
- `INTEGRACION.md`: pasos para integrar la marca y comprobar el módulo vial.

## Aplicar menú lateral
1. Haz una copia de seguridad de los archivos actuales.
2. Reemplaza `sidebar-toggle.js` y `sidebar-toggle.css` por los incluidos.
3. En `index.html`, dentro de `<a class="brand" data-go="dashboard">`, reemplaza
   el elemento visual `<span class="logo">G</span>` por:
   `<img class="brand-logo-image" src="geotracia-logo.png" alt="GEOTRACIA">`
4. Verifica que `geotracia-logo.png` exista en la raíz del repositorio. Si el archivo
   es otro, ajusta únicamente la ruta de `src`.
5. Confirma que `sidebar-toggle.css` y `sidebar-toggle.js` sigan cargándose desde
   `index.html`.
6. Despliega y prueba el menú en móvil.

## Integración vial pendiente
La tabla nacional contiene más de un millón de registros y ocupa gran parte de la
base de datos. No hay que copiar sus geometrías a `roads`. La integración correcta
debe consultar la tabla nacional y, al seleccionar un camino, guardar una referencia
a su `source_id`/identificador en el registro de proyecto o camino asociado. Antes
de generar ese cambio hace falta verificar las columnas exactas de `geotracia_national_roads`
y el esquema de la migración actual. No ejecutar importaciones masivas adicionales.
