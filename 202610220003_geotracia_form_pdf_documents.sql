-- GEOTRACIA: documentos PDF adjuntos a fichas de terreno.
-- Ejecutar una sola vez en Supabase SQL Editor; es idempotente.
ALTER TABLE public.geotracia_form_submissions
  ADD COLUMN IF NOT EXISTS document_path text,
  ADD COLUMN IF NOT EXISTS document_name text,
  ADD COLUMN IF NOT EXISTS document_mime text,
  ADD COLUMN IF NOT EXISTS document_size bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'geotracia_form_submissions_document_size_check'
      AND conrelid = 'public.geotracia_form_submissions'::regclass
  ) THEN
    ALTER TABLE public.geotracia_form_submissions
      ADD CONSTRAINT geotracia_form_submissions_document_size_check
      CHECK (document_size IS NULL OR document_size BETWEEN 1 AND 15728640);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('geotracia-form-documents', 'geotracia-form-documents', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS geotracia_form_docs_select ON storage.objects;
CREATE POLICY geotracia_form_docs_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'geotracia-form-documents'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS geotracia_form_docs_insert ON storage.objects;
CREATE POLICY geotracia_form_docs_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'geotracia-form-documents'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS geotracia_form_docs_update ON storage.objects;
CREATE POLICY geotracia_form_docs_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'geotracia-form-documents'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'geotracia-form-documents'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS geotracia_form_docs_delete ON storage.objects;
CREATE POLICY geotracia_form_docs_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'geotracia-form-documents'
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);
