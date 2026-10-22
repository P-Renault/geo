-- GEOTRACIA · Mantenimiento V1.0
-- Órdenes de trabajo preventivas y correctivas persistidas por organización/proyecto.
-- Ejecutar en Supabase SQL Editor después de las migraciones base de GEOTRACIA.
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

CREATE TABLE IF NOT EXISTS public.maintenance_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  road_id uuid NOT NULL,
  segment_id uuid,
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 60),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  maintenance_type text NOT NULL DEFAULT 'preventive' CHECK (maintenance_type IN ('preventive','corrective')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','suspended','completed','cancelled')),
  scheduled_start date,
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  assigned_to text CHECK (assigned_to IS NULL OR length(assigned_to) <= 180),
  work_description text NOT NULL DEFAULT '' CHECK (length(work_description) <= 10000),
  resources text CHECK (resources IS NULL OR length(resources) <= 2000),
  estimated_cost numeric(14,2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  actual_cost numeric(14,2) CHECK (actual_cost IS NULL OR actual_cost >= 0),
  start_km numeric(12,3) CHECK (start_km IS NULL OR start_km >= 0),
  end_km numeric(12,3) CHECK (end_km IS NULL OR end_km >= 0),
  notes text CHECK (notes IS NULL OR length(notes) <= 5000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_orders_road_fk FOREIGN KEY (road_id, organization_id, project_id)
    REFERENCES public.roads(id, organization_id, project_id) ON DELETE CASCADE,
  CONSTRAINT maintenance_orders_segment_fk FOREIGN KEY (segment_id, organization_id, project_id)
    REFERENCES public.segments(id, organization_id, project_id) ON DELETE RESTRICT,
  CONSTRAINT maintenance_orders_project_code_uidx UNIQUE (project_id, code),
  CONSTRAINT maintenance_orders_km_pair CHECK ((start_km IS NULL AND end_km IS NULL) OR (start_km IS NOT NULL AND end_km IS NOT NULL AND end_km > start_km)),
  CONSTRAINT maintenance_orders_date_order CHECK (scheduled_start IS NULL OR due_date IS NULL OR due_date >= scheduled_start)
);

CREATE INDEX IF NOT EXISTS maintenance_orders_org_project_status_idx
  ON public.maintenance_orders (organization_id, project_id, status, scheduled_start);
CREATE INDEX IF NOT EXISTS maintenance_orders_road_idx
  ON public.maintenance_orders (road_id, start_km, end_km);
CREATE INDEX IF NOT EXISTS maintenance_orders_due_idx
  ON public.maintenance_orders (organization_id, due_date) WHERE status NOT IN ('completed','cancelled');

CREATE OR REPLACE FUNCTION public.geotracia_validate_maintenance_order()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_road uuid; v_org uuid; v_project uuid; v_start numeric; v_end numeric;
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
    IF NEW.start_km IS NOT NULL AND (NEW.start_km < v_start OR NEW.end_km > v_end) THEN
      RAISE EXCEPTION 'Las progresivas deben estar dentro del tramo seleccionado.' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.status='in_progress' AND NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
  IF NEW.status='completed' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  IF NEW.status <> 'completed' THEN NEW.completed_at := NULL; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS maintenance_orders_validate_trg ON public.maintenance_orders;
CREATE TRIGGER maintenance_orders_validate_trg BEFORE INSERT OR UPDATE ON public.maintenance_orders
FOR EACH ROW EXECUTE FUNCTION public.geotracia_validate_maintenance_order();

ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS maintenance_orders_select_org ON public.maintenance_orders;
CREATE POLICY maintenance_orders_select_org ON public.maintenance_orders FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS maintenance_orders_insert_org ON public.maintenance_orders;
CREATE POLICY maintenance_orders_insert_org ON public.maintenance_orders FOR INSERT TO authenticated
WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[])
 AND (created_by IS NULL OR created_by=auth.uid()));
DROP POLICY IF EXISTS maintenance_orders_update_org ON public.maintenance_orders;
CREATE POLICY maintenance_orders_update_org ON public.maintenance_orders FOR UPDATE TO authenticated
USING (public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[]))
WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[]));
DROP POLICY IF EXISTS maintenance_orders_delete_admin ON public.maintenance_orders;
CREATE POLICY maintenance_orders_delete_admin ON public.maintenance_orders FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.member_role[]));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_orders TO authenticated;
COMMENT ON TABLE public.maintenance_orders IS 'Órdenes preventivas y correctivas de mantenimiento vial de GEOTRACIA.';
COMMIT;
