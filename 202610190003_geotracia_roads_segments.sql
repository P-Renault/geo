-- GEOTRACIA · Migración completa de caminos y tramos
-- Fecha: 2026-10-20
-- Requiere que la migración base ya haya creado organizations, projects, members,
-- public.member_role, public.is_org_member(uuid) y public.has_org_role(uuid, member_role[]).
-- No elimina tablas ni registros. Ejecutar una sola vez desde Supabase SQL Editor.

begin;

-- PostGIS para geometría vial persistente. En Supabase normalmente se instala en `extensions`.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- Evitar ejecutar sobre un esquema base incompatible o incompleto.
do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Falta public.organizations. No se realizaron cambios; primero debe existir el esquema base de GEOTRACIA.';
  end if;
  if to_regclass('public.projects') is null then
    raise exception 'Falta public.projects. No se realizaron cambios; primero debe existir el esquema base de GEOTRACIA.';
  end if;
  if to_regclass('public.members') is null then
    raise exception 'Falta public.members. No se realizaron cambios; primero debe existir el esquema base de GEOTRACIA.';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Falta public.is_org_member(uuid). No se realizaron cambios.';
  end if;
  if to_regprocedure('public.has_org_role(uuid,public.member_role[])') is null then
    raise exception 'Falta public.has_org_role(uuid, public.member_role[]). No se realizaron cambios.';
  end if;
end $$;

create table if not exists public.roads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 60),
  name text not null check (length(trim(name)) between 1 and 180),
  road_type text not null default 'Ruta',
  surface_type text not null default 'Sin especificar',
  -- Longitud declarada/manual u oficial; no se debe confundir con ST_Length(geom).
  length_m numeric(14,2) check (length_m is null or length_m >= 0),
  official_length_m numeric(14,2) check (official_length_m is null or official_length_m >= 0),
  geometry_length_m numeric(14,2) check (geometry_length_m is null or geometry_length_m >= 0),
  geom extensions.geometry(MultiLineString,4326),
  data_source text not null default 'manual' check (data_source in ('manual','osm','mop','importado','colaborativo')),
  source_id text,
  source_updated_at timestamptz,
  attributes jsonb not null default '{}'::jsonb,
  is_test boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roads_project_org_consistency unique (id, organization_id, project_id)
);

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  road_id uuid not null,
  code text not null check (length(trim(code)) between 1 and 60),
  start_km numeric(12,3) not null check (start_km >= 0),
  end_km numeric(12,3) not null,
  condition text not null default 'Sin evaluar' check (condition in ('Sin evaluar','Bueno','Regular','Malo')),
  geom extensions.geometry(MultiLineString,4326),
  geometry_length_m numeric(14,2) check (geometry_length_m is null or geometry_length_m >= 0),
  data_source text not null default 'manual' check (data_source in ('manual','osm','mop','importado','colaborativo')),
  source_id text,
  attributes jsonb not null default '{}'::jsonb,
  is_test boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint segments_progression_valid check (end_km > start_km),
  constraint segments_road_fk foreign key (road_id, organization_id, project_id)
    references public.roads(id, organization_id, project_id) on delete cascade,
  constraint segments_project_org_consistency unique (id, organization_id, project_id)
);

-- Si las tablas ya existían, agregar de forma no destructiva los campos GIS/metadatos.
alter table public.roads add column if not exists official_length_m numeric(14,2);
alter table public.roads add column if not exists geometry_length_m numeric(14,2);
alter table public.roads add column if not exists geom extensions.geometry(MultiLineString,4326);
alter table public.roads add column if not exists data_source text not null default 'manual';
alter table public.roads add column if not exists source_id text;
alter table public.roads add column if not exists source_updated_at timestamptz;
alter table public.roads add column if not exists is_test boolean not null default false;
alter table public.roads add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.segments add column if not exists geom extensions.geometry(MultiLineString,4326);
alter table public.segments add column if not exists geometry_length_m numeric(14,2);
alter table public.segments add column if not exists data_source text not null default 'manual';
alter table public.segments add column if not exists source_id text;
alter table public.segments add column if not exists is_test boolean not null default false;
alter table public.segments add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.segments add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- Validaciones de integridad que deben coincidir con la organización y proyecto padre.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.roads'::regclass and conname='roads_project_org_consistency') then
    alter table public.roads add constraint roads_project_org_consistency unique (id, organization_id, project_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.segments'::regclass and conname='segments_progression_valid') then
    alter table public.segments add constraint segments_progression_valid check (end_km > start_km);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.segments'::regclass and conname='segments_road_fk') then
    alter table public.segments add constraint segments_road_fk foreign key (road_id, organization_id, project_id)
      references public.roads(id, organization_id, project_id) on delete cascade;
  end if;
end $$;

create index if not exists roads_org_project_idx on public.roads(organization_id, project_id);
create index if not exists roads_source_idx on public.roads(data_source, source_id);
create index if not exists roads_geom_gix on public.roads using gist(geom);
create unique index if not exists roads_project_code_uidx on public.roads(project_id, code);
create index if not exists segments_org_project_idx on public.segments(organization_id, project_id);
create index if not exists segments_road_progress_idx on public.segments(road_id, start_km, end_km);
create index if not exists segments_geom_gix on public.segments using gist(geom);
create unique index if not exists segments_road_code_uidx on public.segments(road_id, code);

-- Comprobar que cada camino/tramo pertenece a un proyecto de la misma organización.
create or replace function public.geotracia_validate_road_project()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id) then
    raise exception 'El proyecto no pertenece a la organización indicada.' using errcode='23514';
  end if;
  if new.geom is not null and extensions.st_srid(new.geom) <> 4326 then
    raise exception 'La geometría debe estar en SRID 4326.' using errcode='23514';
  end if;
  if new.geom is null then new.geometry_length_m := null;
  else new.geometry_length_m := round((extensions.st_length(new.geom::extensions.geography))::numeric, 2); end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists roads_validate_project_trg on public.roads;
create trigger roads_validate_project_trg before insert or update on public.roads
for each row execute function public.geotracia_validate_road_project();

drop trigger if exists segments_validate_project_trg on public.segments;
create trigger segments_validate_project_trg before insert or update on public.segments
for each row execute function public.geotracia_validate_road_project();

alter table public.roads enable row level security;
alter table public.segments enable row level security;

drop policy if exists roads_select_org on public.roads;
drop policy if exists roads_insert_org on public.roads;
drop policy if exists roads_update_org on public.roads;
drop policy if exists roads_delete_admin on public.roads;
create policy roads_select_org on public.roads for select to authenticated
  using (public.is_org_member(organization_id));
create policy roads_insert_org on public.roads for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[])
    and exists (select 1 from public.projects p where p.id=project_id and p.organization_id=roads.organization_id));
create policy roads_update_org on public.roads for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[])
    and exists (select 1 from public.projects p where p.id=project_id and p.organization_id=roads.organization_id));
create policy roads_delete_admin on public.roads for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

drop policy if exists segments_select_org on public.segments;
drop policy if exists segments_insert_org on public.segments;
drop policy if exists segments_update_org on public.segments;
drop policy if exists segments_delete_admin on public.segments;
create policy segments_select_org on public.segments for select to authenticated
  using (public.is_org_member(organization_id));
create policy segments_insert_org on public.segments for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[])
    and exists (select 1 from public.roads r where r.id=road_id and r.project_id=segments.project_id and r.organization_id=segments.organization_id)
    and exists (select 1 from public.projects p where p.id=project_id and p.organization_id=segments.organization_id)
    and end_km > start_km);
create policy segments_update_org on public.segments for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[])
    and exists (select 1 from public.roads r where r.id=road_id and r.project_id=segments.project_id and r.organization_id=segments.organization_id)
    and exists (select 1 from public.projects p where p.id=project_id and p.organization_id=segments.organization_id)
    and end_km > start_km);
create policy segments_delete_admin on public.segments for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

grant select, insert, update, delete on public.roads, public.segments to authenticated;
grant usage on schema extensions to authenticated;

comment on table public.roads is 'Catastro de caminos de GEOTRACIA por organización y proyecto. geom es geometría de referencia; length_m/official_length_m son atributos distintos.';
comment on column public.roads.geom is 'Geometría vial MultiLineString en EPSG:4326. Fuentes permitidas: OSM, MOP, importación o levantamiento validado.';
comment on column public.roads.length_m is 'Longitud declarada/manual; no se recalcula automáticamente desde geom.';
comment on column public.roads.official_length_m is 'Longitud oficial de fuente institucional, conservada separada de la longitud geométrica.';
comment on table public.segments is 'Tramos de un camino con progresivas en kilómetros y geometría opcional.';

commit;
