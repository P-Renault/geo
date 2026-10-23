# Corrección: seleccionar camino y localizar sus tramos geográficos

## Qué cambia
- El dashboard consulta las geometrías persistidas en `segments.geom` mediante la RPC `geotracia_dashboard_segment_geometries`.
- Cada segmento se relaciona con su camino por `segments.road_id`.
- Al seleccionar un camino, el mapa ajusta la vista al camino y sus tramos. Los tramos asociados se resaltan en azul; si se hace clic en un tramo, ese tramo se resalta en ámbar.
- Si un camino no tiene geometrías de tramo, se informa explícitamente; no se inventa una ubicación.
- Los datos existentes no se modifican.

## Pasos obligatorios
1. En Supabase SQL Editor, ejecutar `20261023_geotracia_dashboard_segment_geometries.sql`.
2. En el repositorio `p-renault/geo`, reemplazar `app.js` por el incluido en este paquete.
3. Publicar mediante GitHub Pages y recargar la aplicación.
4. Abrir Dashboard y seleccionar un camino. Confirmar que los tramos con `segments.geom` se dibujen y resalten.

## Requisitos y límites
- La función requiere que existan `public.segments.geom`, `public.segments.road_id`, `public.segments.project_id`, `public.segments.organization_id`, `public.segments.is_test` y `public.is_org_member(uuid)`; corresponden al esquema vial de Geotracia.
- Solo se dibujan tramos que ya tienen geometría persistida en `segments.geom`. Los tramos que solo tienen progresivas (`start_km`, `end_km`) no se fabrican como geometrías. Si se necesita dibujarlos automáticamente desde la geometría del camino, debe añadirse una segunda estrategia de interpolación lineal, validada con la convención de progresivas de los datos reales.
- La función es `SECURITY INVOKER`; respeta los permisos del usuario y la comprobación de pertenencia a la organización.
