-- GEOTRACIA | Formularios y fichas técnicas V1.0
BEGIN;
CREATE TABLE IF NOT EXISTS public.geotracia_form_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 180),
 description text,
 form_type text NOT NULL DEFAULT 'general' CHECK(form_type IN ('general','inspection','asset','maintenance','incident')),
 fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(fields)='array'),
 active boolean NOT NULL DEFAULT true,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geotracia_form_templates_org_project_idx ON public.geotracia_form_templates(organization_id,project_id,active);
CREATE TABLE IF NOT EXISTS public.geotracia_form_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
 template_id uuid NOT NULL REFERENCES public.geotracia_form_templates(id) ON DELETE RESTRICT,
 code text NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 80),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 180),
 road_name text,
 start_km numeric(12,3) CHECK(start_km IS NULL OR start_km>=0),
 end_km numeric(12,3) CHECK(end_km IS NULL OR end_km>=0),
 values jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(values)='object'),
 notes text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','completed','archived')),
 latitude double precision CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
 longitude double precision CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180),
 photo_path text,
 photo_name text,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT geotracia_form_submission_km_pair CHECK((start_km IS NULL AND end_km IS NULL) OR (start_km IS NOT NULL AND end_km IS NOT NULL AND end_km>=start_km)),
 CONSTRAINT geotracia_form_submission_code_unique UNIQUE(organization_id,project_id,code)
);
CREATE INDEX IF NOT EXISTS geotracia_form_submissions_org_project_date_idx ON public.geotracia_form_submissions(organization_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS geotracia_form_submissions_template_idx ON public.geotracia_form_submissions(template_id,status);
ALTER TABLE public.geotracia_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geotracia_form_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geotracia_form_templates_select ON public.geotracia_form_templates;
CREATE POLICY geotracia_form_templates_select ON public.geotracia_form_templates FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
DROP POLICY IF EXISTS geotracia_form_templates_insert ON public.geotracia_form_templates;
CREATE POLICY geotracia_form_templates_insert ON public.geotracia_form_templates FOR INSERT TO authenticated WITH CHECK(public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[]) AND (created_by IS NULL OR created_by=auth.uid()));
DROP POLICY IF EXISTS geotracia_form_templates_update ON public.geotracia_form_templates;
CREATE POLICY geotracia_form_templates_update ON public.geotracia_form_templates FOR UPDATE TO authenticated USING(public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[])) WITH CHECK(public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[]));
DROP POLICY IF EXISTS geotracia_form_templates_delete ON public.geotracia_form_templates;
CREATE POLICY geotracia_form_templates_delete ON public.geotracia_form_templates FOR DELETE TO authenticated USING(public.has_org_role(organization_id, ARRAY['owner','admin']::public.member_role[]));
DROP POLICY IF EXISTS geotracia_form_submissions_select ON public.geotracia_form_submissions;
CREATE POLICY geotracia_form_submissions_select ON public.geotracia_form_submissions FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
DROP POLICY IF EXISTS geotracia_form_submissions_insert ON public.geotracia_form_submissions;
CREATE POLICY geotracia_form_submissions_insert ON public.geotracia_form_submissions FOR INSERT TO authenticated WITH CHECK(public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[]) AND (created_by IS NULL OR created_by=auth.uid()));
DROP POLICY IF EXISTS geotracia_form_submissions_update ON public.geotracia_form_submissions;
CREATE POLICY geotracia_form_submissions_update ON public.geotracia_form_submissions FOR UPDATE TO authenticated USING(public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[])) WITH CHECK(public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[]));
DROP POLICY IF EXISTS geotracia_form_submissions_delete ON public.geotracia_form_submissions;
CREATE POLICY geotracia_form_submissions_delete ON public.geotracia_form_submissions FOR DELETE TO authenticated USING(public.has_org_role(organization_id, ARRAY['owner','admin']::public.member_role[]));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.geotracia_form_templates TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.geotracia_form_submissions TO authenticated;
COMMENT ON TABLE public.geotracia_form_templates IS 'Plantillas configurables de formularios y fichas técnicas GEOTRACIA.';
COMMENT ON TABLE public.geotracia_form_submissions IS 'Fichas completadas, evidencias y ubicación capturadas en terreno.';
COMMIT;
