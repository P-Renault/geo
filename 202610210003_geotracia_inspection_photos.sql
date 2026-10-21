-- GEOTRACIA · Fotografías de inspecciones V1.2
-- Crea un bucket privado y políticas de acceso por organización.
-- No modifica ni elimina registros de public.inspections.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'geotracia-evidencias',
  'geotracia-evidencias',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS geotracia_inspection_photo_select ON storage.objects;
CREATE POLICY geotracia_inspection_photo_select
ON storage.objects FOR SELECT TO authenticated
USING (
  CASE
    WHEN bucket_id = 'geotracia-evidencias'
     AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.is_org_member(((storage.foldername(name))[1])::uuid)
    ELSE false
  END
);

DROP POLICY IF EXISTS geotracia_inspection_photo_insert ON storage.objects;
CREATE POLICY geotracia_inspection_photo_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN bucket_id = 'geotracia-evidencias'
     AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.has_org_role(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner','admin','manager','inspector']::public.member_role[]
    )
    ELSE false
  END
);

DROP POLICY IF EXISTS geotracia_inspection_photo_delete ON storage.objects;
CREATE POLICY geotracia_inspection_photo_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  CASE
    WHEN bucket_id = 'geotracia-evidencias'
     AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.has_org_role(
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner','admin','manager','inspector']::public.member_role[]
    )
    ELSE false
  END
);

COMMIT;
