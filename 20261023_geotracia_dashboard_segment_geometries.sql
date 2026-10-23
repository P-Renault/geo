-- GEOTRACIA: expone geometrías persistidas de segmentos para el mapa del dashboard.
-- Ejecutar una sola vez en Supabase SQL Editor.
-- No altera ni recrea caminos, segmentos ni sus geometrías.

create or replace function public.geotracia_dashboard_segment_geometries(p_project_id uuid)
returns table (
  segment_id uuid,
  road_id uuid,
  code text,
  start_km numeric,
  end_km numeric,
  segment_geojson jsonb
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    s.id as segment_id,
    s.road_id,
    s.code,
    s.start_km,
    s.end_km,
    extensions.st_asgeojson(s.geom)::jsonb as segment_geojson
  from public.segments s
  where s.project_id = p_project_id
    and s.is_test = false
    and s.geom is not null
    and public.is_org_member(s.organization_id)
  order by s.start_km, s.code;
$$;

revoke all on function public.geotracia_dashboard_segment_geometries(uuid) from public;
grant execute on function public.geotracia_dashboard_segment_geometries(uuid) to authenticated;
