-- Geotracia · motores de lectura/escritura para el espacio personal del usuario
-- Ejecutar en Supabase SQL Editor. No altera las tablas administrativas existentes.

create table if not exists public.geotracia_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geotracia_user_preferences_preferences_object
    check (jsonb_typeof(preferences) = 'object')
);

create index if not exists geotracia_user_preferences_org_idx
  on public.geotracia_user_preferences (organization_id);

alter table public.geotracia_user_preferences enable row level security;

drop policy if exists "user reads own preferences" on public.geotracia_user_preferences;
create policy "user reads own preferences"
  on public.geotracia_user_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user inserts own preferences" on public.geotracia_user_preferences;
create policy "user inserts own preferences"
  on public.geotracia_user_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "user updates own preferences" on public.geotracia_user_preferences;
create policy "user updates own preferences"
  on public.geotracia_user_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.geotracia_user_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  action text not null check (length(action) between 1 and 120),
  module text not null check (length(module) between 1 and 80),
  result text not null default 'success' check (result in ('success','failed','pending')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint geotracia_user_audit_events_details_object
    check (jsonb_typeof(details) = 'object')
);

create index if not exists geotracia_user_audit_user_created_idx
  on public.geotracia_user_audit_events (user_id, created_at desc);
create index if not exists geotracia_user_audit_org_created_idx
  on public.geotracia_user_audit_events (organization_id, created_at desc);

alter table public.geotracia_user_audit_events enable row level security;

drop policy if exists "user reads own audit events" on public.geotracia_user_audit_events;
create policy "user reads own audit events"
  on public.geotracia_user_audit_events for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user inserts own audit events" on public.geotracia_user_audit_events;
create policy "user inserts own audit events"
  on public.geotracia_user_audit_events for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Intencionalmente no se crean políticas UPDATE ni DELETE para los eventos de auditoría.
-- El navegador no puede editar ni borrar el historial una vez insertado.
-- El cliente solo usa la clave pública de Supabase; RLS es la barrera de autorización.

-- La auditoría se genera en PostgreSQL, no desde el navegador, para evitar que el cliente
-- pueda fabricar o modificar eventos históricos. No se concede INSERT al usuario autenticado.
drop policy if exists "user inserts own audit events" on public.geotracia_user_audit_events;

create or replace function public.geotracia_audit_user_preferences_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_action text;
  v_fields text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    v_action := 'preferences.created';
    v_fields := array['preferences'];
  else
    v_action := 'preferences.updated';
    if old.preferences->>'date_format' is distinct from new.preferences->>'date_format' then v_fields := array_append(v_fields,'date_format'); end if;
    if old.preferences->>'distance_unit' is distinct from new.preferences->>'distance_unit' then v_fields := array_append(v_fields,'distance_unit'); end if;
    if old.preferences->>'timezone' is distinct from new.preferences->>'timezone' then v_fields := array_append(v_fields,'timezone'); end if;
    if old.preferences->>'density' is distinct from new.preferences->>'density' then v_fields := array_append(v_fields,'density'); end if;
    if old.preferences->>'notifications' is distinct from new.preferences->>'notifications' then v_fields := array_append(v_fields,'notifications'); end if;
    if old.preferences->>'confirm_destructive' is distinct from new.preferences->>'confirm_destructive' then v_fields := array_append(v_fields,'confirm_destructive'); end if;
    if old.preferences->>'offline_notice' is distinct from new.preferences->>'offline_notice' then v_fields := array_append(v_fields,'offline_notice'); end if;
  end if;
  insert into public.geotracia_user_audit_events(user_id,organization_id,action,module,result,details)
  values(new.user_id,new.organization_id,v_action,'preferences','success',jsonb_build_object('summary','Preferencias personales guardadas','changed_fields',to_jsonb(v_fields)));
  return new;
end;
$$;

drop trigger if exists geotracia_user_preferences_audit on public.geotracia_user_preferences;
create trigger geotracia_user_preferences_audit
after insert or update on public.geotracia_user_preferences
for each row execute function public.geotracia_audit_user_preferences_change();

create or replace function public.geotracia_audit_user_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_fields text[] := array[]::text[];
begin
  if (old.raw_user_meta_data->>'display_name') is distinct from (new.raw_user_meta_data->>'display_name') then v_fields := array_append(v_fields,'display_name'); end if;
  if (old.raw_user_meta_data->>'phone') is distinct from (new.raw_user_meta_data->>'phone') then v_fields := array_append(v_fields,'phone'); end if;
  if cardinality(v_fields) > 0 then
    insert into public.geotracia_user_audit_events(user_id,organization_id,action,module,result,details)
    values(new.id,null,'profile.updated','profile','success',jsonb_build_object('summary','Datos del perfil actualizados','changed_fields',to_jsonb(v_fields)));
  end if;
  return new;
end;
$$;

drop trigger if exists geotracia_auth_user_profile_audit on auth.users;
create trigger geotracia_auth_user_profile_audit
after update of raw_user_meta_data on auth.users
for each row execute function public.geotracia_audit_user_profile_change();

revoke all on function public.geotracia_audit_user_preferences_change() from public, anon, authenticated;
revoke all on function public.geotracia_audit_user_profile_change() from public, anon, authenticated;

-- Permisos SQL explícitos; RLS sigue restringiendo cada fila a su propietario.
grant select, insert, update on public.geotracia_user_preferences to authenticated;
grant select on public.geotracia_user_audit_events to authenticated;
revoke insert, update, delete on public.geotracia_user_audit_events from anon, authenticated;
