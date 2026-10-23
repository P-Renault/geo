-- GEOTRACIA · Cola de registros capturados sin conexión
-- Ejecutar en Supabase SQL Editor. No desactiva RLS ni crea usuarios.
CREATE TABLE IF NOT EXISTS public.geotracia_offline_records (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('field_note','inspection_note','incident_report','maintenance_note')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 10000),
  km_progressive numeric(12,3) CHECK (km_progressive IS NULL OR km_progressive >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geotracia_offline_project_created_idx
  ON public.geotracia_offline_records (organization_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS geotracia_offline_user_idx
  ON public.geotracia_offline_records (user_id, created_at DESC);
ALTER TABLE public.geotracia_offline_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geotracia_offline_select ON public.geotracia_offline_records;
CREATE POLICY geotracia_offline_select ON public.geotracia_offline_records
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.geotracia_has_project_role(
  organization_id, project_id, ARRAY['project_admin','supervisor','operator','viewer']::text[]));
DROP POLICY IF EXISTS geotracia_offline_insert ON public.geotracia_offline_records;
CREATE POLICY geotracia_offline_insert ON public.geotracia_offline_records
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.members m
    WHERE m.organization_id = organization_id AND m.user_id = auth.uid() AND m.active IS TRUE)
  AND EXISTS (SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.organization_id = organization_id)
  AND public.geotracia_has_project_role(
    organization_id, project_id, ARRAY['project_admin','supervisor','operator']::text[])
);
GRANT SELECT, INSERT ON public.geotracia_offline_records TO authenticated;
