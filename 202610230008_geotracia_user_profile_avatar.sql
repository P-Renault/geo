-- GEOTRACIA: almacenamiento privado para fotografías de perfil.
-- Ejecutar en Supabase SQL Editor antes de probar la carga de imágenes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'geotracia-avatars',
  'geotracia-avatars',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Cada usuario puede leer únicamente los objetos bajo su carpeta UUID.
drop policy if exists "geotracia avatars read own" on storage.objects;
create policy "geotracia avatars read own"
on storage.objects for select to authenticated
using (
  bucket_id = 'geotracia-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Permite subir y reemplazar su propio avatar; no permite escribir en otra carpeta.
drop policy if exists "geotracia avatars insert own" on storage.objects;
create policy "geotracia avatars insert own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'geotracia-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "geotracia avatars update own" on storage.objects;
create policy "geotracia avatars update own"
on storage.objects for update to authenticated
using (
  bucket_id = 'geotracia-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'geotracia-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- No se crea política de borrado: la foto anterior puede reemplazarse sin
-- habilitar eliminación arbitraria desde el cliente.
