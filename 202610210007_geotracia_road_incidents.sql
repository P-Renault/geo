-- GEOTRACIA · Incidencias V1.0
-- Persistencia real por organización, proyecto, camino y tramo.
-- Fotografía: metadata.incident_photo en Storage geotracia-evidencias.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN RAISE EXCEPTION 'Falta public.organizations'; END IF;
  IF to_regclass('public.projects') IS NULL THEN RAISE EXCEPTION 'Falta public.projects'; END IF;
  IF to_regclass('public.roads') IS NULL THEN RAISE EXCEPTION 'Falta public.roads'; END IF;
  IF to_regclass('public.segments') IS NULL THEN RAISE EXCEPTION 'Falta public.segments'; END IF;
  IF to_regprocedure('public.is_org_member(uuid)') IS NULL THEN RAISE EXCEPTION 'Falta public.is_org_member(uuid)'; END IF;
  IF to_regprocedure('public.has_org_role(uuid,public.member_role[])') IS NULL THEN RAISE EXCEPTION 'Falta public.has_org_role(uuid, public.member_role[])'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.road_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  road_id UUID NOT NULL,
  segment_id UUID,
  code TEXT NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 60),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  incident_type TEXT NOT NULL DEFAULT 'Otro',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed','draft','archived')),
  km_progressive NUMERIC(12,3) CHECK (km_progressive IS NULL OR km_progressive >= 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 10000),
  action_taken TEXT NOT NULL DEFAULT '' CHECK (length(action_taken) <= 10000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT road_incidents_road_fk FOREIGN KEY (road_id, organization_id, project_id)
    REFERENCES public.roads(id, organization_id, project_id) ON DELETE CASCADE,
  CONSTRAINT road_incidents_segment_fk FOREIGN KEY (segment_id)
    REFERENCES public.segments(id) ON DELETE RESTRICT,
  CONSTRAINT road_incidents_project_code_uidx UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS road_incidents_org_project_date_idx
  ON public.road_incidents (organization_id, project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS road_incidents_road_progressive_idx
  ON public.road_incidents (road_id, km_progressive);
CREATE INDEX IF NOT EXISTS road_incidents_status_severity_idx
  ON public.road_incidents (organization_id, project_id, status, severity);

CREATE OR REPLACE FUNCTION public.geotracia_validate_road_incident()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_road UUID; v_org UUID; v_project UUID; v_start NUMERIC; v_end NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=NEW.project_id AND p.organization_id=NEW.organization_id) THEN
    RAISE EXCEPTION 'El proyecto no pertenece a la organización indicada.' USING ERRCODE='23514';
  END IF;
  IF NEW.segment_id IS NOT NULL THEN
    SELECT s.road_id,s.organization_id,s.project_id,s.start_km,s.end_km
      INTO v_road,v_org,v_project,v_start,v_end FROM public.segments s WHERE s.id=NEW.segment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'El tramo seleccionado no existe.' USING ERRCODE='23514'; END IF;
    IF v_road IS DISTINCT FROM NEW.road_id OR v_org IS DISTINCT FROM NEW.organization_id OR v_project IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'El tramo no corresponde al camino, organización y proyecto seleccionados.' USING ERRCODE='23514';
    END IF;
    IF NEW.km_progressive IS NOT NULL AND v_start IS NOT NULL AND NEW.km_progressive < v_start THEN
      RAISE EXCEPTION 'La progresiva es anterior al inicio del tramo.' USING ERRCODE='23514';
    END IF;
    IF NEW.km_progressive IS NOT NULL AND v_end IS NOT NULL AND NEW.km_progressive > v_end THEN
      RAISE EXCEPTION 'La progresiva supera el final del tramo.' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.updated_at := now(); RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS road_incidents_validate_trg ON public.road_incidents;
CREATE TRIGGER road_incidents_validate_trg BEFORE INSERT OR UPDATE ON public.road_incidents
FOR EACH ROW EXECUTE FUNCTION public.geotracia_validate_road_incident();

ALTER TABLE public.road_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS road_incidents_select_org ON public.road_incidents;
CREATE POLICY road_incidents_select_org ON public.road_incidents FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS road_incidents_insert_org ON public.road_incidents;
CREATE POLICY road_incidents_insert_org ON public.road_incidents FOR INSERT TO authenticated
WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[])
  AND (created_by IS NULL OR created_by=auth.uid())
  AND EXISTS (SELECT 1 FROM public.roads r WHERE r.id=road_id AND r.organization_id=road_incidents.organization_id AND r.project_id=road_incidents.project_id));
DROP POLICY IF EXISTS road_incidents_update_org ON public.road_incidents;
CREATE POLICY road_incidents_update_org ON public.road_incidents FOR UPDATE TO authenticated
USING (public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[]))
WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[])
  AND EXISTS (SELECT 1 FROM public.roads r WHERE r.id=road_id AND r.organization_id=road_incidents.organization_id AND r.project_id=road_incidents.project_id));
DROP POLICY IF EXISTS road_incidents_delete_admin ON public.road_incidents;
CREATE POLICY road_incidents_delete_admin ON public.road_incidents FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.member_role[]));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.road_incidents TO authenticated;
COMMENT ON TABLE public.road_incidents IS 'Incidencias viales GEOTRACIA asociadas a camino y tramo; fotografía en Storage.';
COMMIT;
