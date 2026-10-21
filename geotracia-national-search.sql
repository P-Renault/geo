-- GEOTRACIA: búsqueda de red vial nacional por nombre/referencia y proximidad.
-- Ejecutar una sola vez en Supabase > SQL Editor. Solo lectura; no importa ni modifica registros.
CREATE OR REPLACE FUNCTION public.geotracia_search_national_roads(
  p_query text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lon double precision DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id bigint,
  road_name text,
  road_ref text,
  road_type text,
  surface text,
  geometry jsonb,
  length_m double precision,
  distance_m double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  q text := nullif(trim(coalesce(p_query,'')), '');
  lim integer := greatest(1, least(coalesce(p_limit,20), 30));
  pt extensions.geometry(Point,4326);
BEGIN
  IF p_lat IS NOT NULL AND p_lon IS NOT NULL
     AND p_lat BETWEEN -90 AND 90 AND p_lon BETWEEN -180 AND 180 THEN
    pt := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon,p_lat),4326);
  END IF;

  IF q IS NULL AND pt IS NULL THEN
    RAISE EXCEPTION 'Indica un texto de búsqueda o las coordenadas del mapa.';
  END IF;

  RETURN QUERY
  SELECT r.id::bigint,
         r.road_name::text,
         r.road_ref::text,
         r.road_type::text,
         r.surface::text,
         extensions.ST_AsGeoJSON(r.geom)::jsonb,
         extensions.ST_Length(extensions.ST_Transform(r.geom, 32719))::double precision,
         CASE WHEN pt IS NOT NULL THEN extensions.ST_Distance(extensions.ST_Transform(r.geom,32719), extensions.ST_Transform(pt,32719))::double precision ELSE NULL::double precision END
  FROM public.geotracia_national_roads r
  WHERE r.geom IS NOT NULL
    AND (
      (q IS NOT NULL AND (
        coalesce(r.road_name,'') ILIKE '%'||q||'%'
        OR coalesce(r.road_ref,'') ILIKE '%'||q||'%'
        OR coalesce(r.road_type,'') ILIKE '%'||q||'%'
        OR coalesce(r.source_attributes::text,'') ILIKE '%'||q||'%'
      ))
      OR (q IS NULL AND pt IS NOT NULL AND extensions.ST_DWithin(
        extensions.ST_Transform(r.geom,32719), extensions.ST_Transform(pt,32719), 500
      ))
    )
  ORDER BY
    CASE WHEN q IS NOT NULL AND r.road_name ILIKE q THEN 0
         WHEN q IS NOT NULL AND r.road_ref ILIKE q THEN 1 ELSE 2 END,
    CASE WHEN pt IS NOT NULL THEN extensions.ST_Distance(extensions.ST_Transform(r.geom,32719),extensions.ST_Transform(pt,32719)) ELSE NULL END NULLS LAST,
    r.road_name NULLS LAST
  LIMIT lim;
END;
$$;

REVOKE ALL ON FUNCTION public.geotracia_search_national_roads(text,double precision,double precision,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geotracia_search_national_roads(text,double precision,double precision,integer) TO anon, authenticated;
COMMENT ON FUNCTION public.geotracia_search_national_roads(text,double precision,double precision,integer) IS 'Solo lectura: busca caminos importados por nombre/referencia/atributos o a 500 m del punto. Devuelve geometría GeoJSON y longitud geométrica.';
