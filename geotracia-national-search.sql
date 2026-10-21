-- GEOTRACIA | Consulta del catálogo vial importado desde Geofabrik Chile / OSM.
-- No vuelve a importar ni modifica las 1.013.358 geometrías existentes.
-- Ejecutar una vez en Supabase > SQL Editor.

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
    RAISE EXCEPTION 'Indica texto de búsqueda o coordenadas del mapa.';
  END IF;

  RETURN QUERY
  SELECT r.id::bigint,
         r.road_name::text,
         r.road_ref::text,
         coalesce(r.road_type,r.highway_class)::text,
         r.surface::text,
         extensions.ST_AsGeoJSON(r.geom)::jsonb,
         extensions.ST_Length(r.geom::extensions.geography)::double precision,
         CASE WHEN pt IS NOT NULL THEN
           extensions.ST_Distance(r.geom::extensions.geography,pt::extensions.geography)::double precision
         ELSE NULL::double precision END
  FROM public.geotracia_national_roads r
  WHERE r.source = 'OSM'
    AND r.source_dataset = 'geofabrik-chile'
    AND r.geom IS NOT NULL
    AND (
      (q IS NOT NULL AND (
        coalesce(r.road_name,'') ILIKE '%'||q||'%'
        OR coalesce(r.road_ref,'') ILIKE '%'||q||'%'
        OR coalesce(r.road_type,'') ILIKE '%'||q||'%'
        OR coalesce(r.highway_class,'') ILIKE '%'||q||'%'
        OR coalesce(r.source_attributes::text,'') ILIKE '%'||q||'%'
      ))
      OR (q IS NULL AND pt IS NOT NULL AND
          extensions.ST_DWithin(r.geom::extensions.geography,pt::extensions.geography,500))
    )
  ORDER BY
    CASE WHEN q IS NOT NULL AND r.road_name ILIKE q THEN 0
         WHEN q IS NOT NULL AND r.road_ref ILIKE q THEN 1 ELSE 2 END,
    CASE WHEN pt IS NOT NULL THEN extensions.ST_Distance(r.geom::extensions.geography,pt::extensions.geography) END NULLS LAST,
    r.road_name NULLS LAST
  LIMIT lim;
END;
$$;

CREATE OR REPLACE FUNCTION public.geotracia_visible_national_roads(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_limit integer DEFAULT 250
)
RETURNS TABLE (
  id bigint,
  road_name text,
  road_ref text,
  road_type text,
  surface text,
  geometry jsonb,
  length_m double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  bbox extensions.geometry;
  lim integer := greatest(1,least(coalesce(p_limit,250),400));
BEGIN
  IF p_west IS NULL OR p_south IS NULL OR p_east IS NULL OR p_north IS NULL
     OR p_west < -180 OR p_east > 180 OR p_south < -90 OR p_north > 90
     OR p_west >= p_east OR p_south >= p_north THEN
    RAISE EXCEPTION 'Extensión geográfica inválida.';
  END IF;
  -- Evita consultas de país completo; el cliente solo debe solicitar áreas acotadas.
  IF (p_east-p_west) > 0.20 OR (p_north-p_south) > 0.20 THEN
    RAISE EXCEPTION 'Acerca el mapa: el área consultada no puede superar 0,20 grados.';
  END IF;
  bbox := extensions.ST_MakeEnvelope(p_west,p_south,p_east,p_north,4326);

  RETURN QUERY
  SELECT r.id::bigint,
         r.road_name::text,
         r.road_ref::text,
         coalesce(r.road_type,r.highway_class)::text,
         r.surface::text,
         extensions.ST_AsGeoJSON(
           CASE WHEN extensions.ST_NPoints(r.geom) > 250
             THEN extensions.ST_SimplifyPreserveTopology(r.geom,0.00004)
             ELSE r.geom END
         )::jsonb,
         extensions.ST_Length(r.geom::extensions.geography)::double precision
  FROM public.geotracia_national_roads r
  WHERE r.source = 'OSM'
    AND r.source_dataset = 'geofabrik-chile'
    AND r.geom IS NOT NULL
    AND r.geom && bbox
    AND extensions.ST_Intersects(r.geom,bbox)
  ORDER BY r.road_name NULLS LAST, r.source_id
  LIMIT lim;
END;
$$;

REVOKE ALL ON FUNCTION public.geotracia_search_national_roads(text,double precision,double precision,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.geotracia_visible_national_roads(double precision,double precision,double precision,double precision,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geotracia_search_national_roads(text,double precision,double precision,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.geotracia_visible_national_roads(double precision,double precision,double precision,double precision,integer) TO anon, authenticated;

COMMENT ON FUNCTION public.geotracia_search_national_roads(text,double precision,double precision,integer) IS
'Solo lectura: busca geometrías OSM importadas desde Geofabrik Chile por nombre/referencia/atributos o dentro de 500 m. Longitud calculada geodésicamente; no es dato oficial MOP.';
COMMENT ON FUNCTION public.geotracia_visible_national_roads(double precision,double precision,double precision,double precision,integer) IS
'Solo lectura: entrega hasta 400 geometrías OSM del área visible para la capa Leaflet; no descarga el catálogo nacional completo.';


-- Refresca la caché de esquema de PostgREST/Supabase para que la app encuentre las RPC.
NOTIFY pgrst, 'reload schema';
