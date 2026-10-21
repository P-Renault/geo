-- GEOTRACIA: geometrías GeoJSON para el mapa de Caminos y tramos.
-- Ejecutar una vez en Supabase SQL Editor.
CREATE OR REPLACE FUNCTION public.geotracia_project_road_geometries(p_project_id uuid)
RETURNS TABLE(road_id uuid, geojson jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT r.id, extensions.ST_AsGeoJSON(r.geom)::jsonb
  FROM public.roads AS r
  WHERE r.project_id = p_project_id
    AND r.geom IS NOT NULL
  ORDER BY r.code;
$$;
GRANT EXECUTE ON FUNCTION public.geotracia_project_road_geometries(uuid) TO authenticated;
