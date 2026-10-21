-- GEOTRACIA · Inventario vial V1.3
-- Calcula ubicación desde progresiva y geometría del camino.
-- No agrega latitud/longitud a road_inventory ni altera datos existentes.
BEGIN;
CREATE OR REPLACE FUNCTION public.geotracia_inventory_road_geometries(p_project_id uuid)
RETURNS TABLE(road_id uuid, road_geojson jsonb, length_m numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, ST_AsGeoJSON(r.geom)::jsonb, r.length_m
  FROM public.roads r
  WHERE r.project_id = p_project_id
    AND r.geom IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.geotracia_inventory_road_geometries(uuid) TO authenticated;
COMMIT;
