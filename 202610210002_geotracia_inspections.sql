-- GEOTRACIA · Inspecciones V1.0
-- Migración aditiva: crea inspecciones vinculadas a organización, proyecto, camino y tramo.
-- Requiere la migración de caminos/tramos y las funciones RLS base de GEOTRACIA.

begin;

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Falta public.organizations. No se realizaron cambios.';
  end if;
  if to_regclass('public.projects') is null then
    raise exception 'Falta public.projects. No se realizaron cambios.';
  end if;
  if to_regclass('public.roads') is null then
    raise exception 'Falta public.roads. Ejecuta primero la migración de caminos y tramos.';
  end if;
  if to_regclass('public.segments') is null then
    raise exception 'Falta public.segments. Ejecuta primero la migración de caminos y tramos.';
  end if;
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Falta public.is_org_member(uuid). No se realizaron cambios.';
  end if;
  if to_regprocedure('public.has_org_role(uuid,public.member_role[])') is null then
    raise exception 'Falta public.has_org_role(uuid, public.member_role[]). No se realizaron cambios.';
  end if;
end $$;

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  road_id uuid not null,
  segment_id uuid,
  code text not null check (length(trim(code)) between 1 and 60),
  title text not null check (length(trim(title)) between 1 and 180),
  inspection_type text not null default 'Visual rutinaria'
    check (inspection_type in ('Visual rutinaria','Estado de pavimento','Señalización','Drenaje y obras de arte','Seguridad vial','Inspección especial')),
  inspection_date date not null default current_date,
  km_progressive numeric(12,3) check (km_progressive is null or km_progressive >= 0),
  condition text not null default 'Sin evaluar'
    check (condition in ('Sin evaluar','Bueno','Regular','Malo','Crítico')),
  findings text check (findings is null or length(findings) <= 5000),
  recommendations text check (recommendations is null or length(recommendations) <= 5000),
  status text not null default 'Pendiente'
    check (status in ('Pendiente','En curso','Completada','Requiere acción')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspections_road_fk foreign key (road_id, organization_id, project_id)
    references public.roads(id, organization_id, project_id) on delete cascade,
  constraint inspections_segment_fk foreign key (segment_id, organization_id, project_id)
    references public.segments(id, organization_id, project_id) on delete restrict,
  constraint inspections_project_code_uidx unique (project_id, code)
);

create index if not exists inspections_org_project_date_idx
  on public.inspections (organization_id, project_id, inspection_date desc);
create index if not exists inspections_road_date_idx
  on public.inspections (road_id, inspection_date desc);
create index if not exists inspections_segment_idx
  on public.inspections (segment_id) where segment_id is not null;
create index if not exists inspections_status_idx
  on public.inspections (organization_id, project_id, status);

-- Garantiza que el tramo pertenezca al mismo camino y que la progresiva esté dentro del tramo.
create or replace function public.geotracia_validate_inspection()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_road_id uuid;
  v_start numeric;
  v_end numeric;
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.organization_id = new.organization_id
  ) then
    raise exception 'El proyecto no pertenece a la organización indicada.' using errcode = '23514';
  end if;

  if new.segment_id is not null then
    select s.road_id, s.start_km, s.end_km
      into v_road_id, v_start, v_end
    from public.segments s
    where s.id = new.segment_id
      and s.organization_id = new.organization_id
      and s.project_id = new.project_id;

    if not found then
      raise exception 'El tramo seleccionado no pertenece al proyecto indicado.' using errcode = '23514';
    end if;
    if v_road_id <> new.road_id then
      raise exception 'El tramo seleccionado no pertenece al camino indicado.' using errcode = '23514';
    end if;
    if new.km_progressive is not null and (new.km_progressive < v_start or new.km_progressive > v_end) then
      raise exception 'La progresiva debe estar dentro del rango del tramo.' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inspections_validate_trg on public.inspections;
create trigger inspections_validate_trg
before insert or update on public.inspections
for each row execute function public.geotracia_validate_inspection();

alter table public.inspections enable row level security;

drop policy if exists inspections_select_org on public.inspections;
create policy inspections_select_org on public.inspections
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists inspections_insert_org on public.inspections;
create policy inspections_insert_org on public.inspections
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[])
    and (created_by is null or created_by = auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.organization_id = inspections.organization_id)
    and exists (select 1 from public.roads r where r.id = road_id and r.project_id = inspections.project_id and r.organization_id = inspections.organization_id)
  );

drop policy if exists inspections_update_org on public.inspections;
create policy inspections_update_org on public.inspections
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[]))
  with check (
    public.has_org_role(organization_id, array['owner','admin','manager','inspector']::public.member_role[])
    and exists (select 1 from public.roads r where r.id = road_id and r.project_id = inspections.project_id and r.organization_id = inspections.organization_id)
  );

drop policy if exists inspections_delete_admin on public.inspections;
create policy inspections_delete_admin on public.inspections
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

grant select, insert, update, delete on public.inspections to authenticated;
comment on table public.inspections is 'Inspecciones de terreno persistidas por organización, proyecto, camino y tramo en GEOTRACIA.';

commit;
