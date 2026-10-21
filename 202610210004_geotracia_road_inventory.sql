-- GEOTRACIA · Inventario vial V1.0
-- Tabla aditiva para inventario persistente por organización, proyecto, camino y tramo.
-- Requiere el esquema base y public.roads/public.segments ya instalados.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'Falta public.organizations.';
  END IF;
  IF to_regclass('public.projects') IS NULL THEN
    RAISE EXCEPTION 'Falta public.projects.';
  END IF;
  IF to_regclass('public.roads') IS NULL THEN
    RAISE EXCEPTION 'Falta public.roads. Ejecuta primero la migración de caminos y tramos.';
  END IF;
  IF to_regclass('public.segments') IS NULL THEN
    RAISE EXCEPTION 'Falta public.segments. Ejecuta primero la migración de caminos y tramos.';
  END IF;
  IF to_regprocedure('public.is_org_member(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Falta public.is_org_member(uuid).';
  END IF;
  IF to_regprocedure('public.has_org_role(uuid,public.member_role[])') IS NULL THEN
    RAISE EXCEPTION 'Falta public.has_org_role(uuid, public.member_role[]).';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.road_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  road_id UUID NOT NULL,
  segment_id UUID,
  code TEXT NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 60),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 180),
  asset_type TEXT NOT NULL DEFAULT 'Otro' CHECK (length(trim(asset_type)) BETWEEN 1 AND 100),
  condition TEXT NOT NULL DEFAULT 'Sin evaluar'
    CHECK (condition IN ('Sin evaluar','Bueno','Operativo','Regular','Requiere revisión','Malo','Crítico')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','maintenance','inactive','retired')),
  km_progressive NUMERIC(12,3) CHECK (km_progressive IS NULL OR km_progressive >= 0),
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'unidad' CHECK (length(trim(unit)) BETWEEN 1 AND 30),
  installed_at DATE,
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT road_inventory_road_fk
    FOREIGN KEY (road_id, organization_id, project_id)
    REFERENCES public.roads(id, organization_id, project_id) ON DELETE CASCADE,
  CONSTRAINT road_inventory_segment_fk
    FOREIGN KEY (segment_id, organization_id, project_id)
    REFERENCES public.segments(id, organization_id, project_id) ON DELETE RESTRICT,
  CONSTRAINT road_inventory_project_code_uidx UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS road_inventory_org_project_idx
  ON public.road_inventory (organization_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS road_inventory_road_idx
  ON public.road_inventory (road_id, condition, status);
CREATE INDEX IF NOT EXISTS road_inventory_segment_idx
  ON public.road_inventory (segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS road_inventory_type_idx
  ON public.road_inventory (organization_id, project_id, asset_type);

CREATE OR REPLACE FUNCTION public.geotracia_validate_road_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_road_id UUID;
  v_start NUMERIC;
  v_end NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = NEW.project_id
      AND p.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'El proyecto no pertenece a la organización indicada.' USING ERRCODE = '23514';
  END IF;

  IF NEW.segment_id IS NOT NULL THEN
    SELECT s.road_id, s.start_km, s.end_km
      INTO v_road_id, v_start, v_end
    FROM public.segments s
    WHERE s.id = NEW.segment_id
      AND s.organization_id = NEW.organization_id
      AND s.project_id = NEW.project_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El tramo no pertenece al proyecto indicado.' USING ERRCODE = '23514';
    END IF;
    IF v_road_id <> NEW.road_id THEN
      RAISE EXCEPTION 'El tramo seleccionado no pertenece al camino indicado.' USING ERRCODE = '23514';
    END IF;
    IF NEW.km_progressive IS NOT NULL AND
       (NEW.km_progressive < v_start OR NEW.km_progressive > v_end) THEN
      RAISE EXCEPTION 'La progresiva debe estar dentro del rango del tramo.' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS road_inventory_validate_trg ON public.road_inventory;
CREATE TRIGGER road_inventory_validate_trg
BEFORE INSERT OR UPDATE ON public.road_inventory
FOR EACH ROW EXECUTE FUNCTION public.geotracia_validate_road_inventory();

ALTER TABLE public.road_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS road_inventory_select_org ON public.road_inventory;
CREATE POLICY road_inventory_select_org
ON public.road_inventory FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS road_inventory_insert_org ON public.road_inventory;
CREATE POLICY road_inventory_insert_org
ON public.road_inventory FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[])
  AND (created_by IS NULL OR created_by = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.roads r
    WHERE r.id = road_id
      AND r.organization_id = road_inventory.organization_id
      AND r.project_id = road_inventory.project_id
  )
);

DROP POLICY IF EXISTS road_inventory_update_org ON public.road_inventory;
CREATE POLICY road_inventory_update_org
ON public.road_inventory FOR UPDATE TO authenticated
USING (public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[]))
WITH CHECK (
  public.has_org_role(organization_id, ARRAY['owner','admin','manager','inspector']::public.member_role[])
  AND EXISTS (
    SELECT 1 FROM public.roads r
    WHERE r.id = road_id
      AND r.organization_id = road_inventory.organization_id
      AND r.project_id = road_inventory.project_id
  )
);

DROP POLICY IF EXISTS road_inventory_delete_admin ON public.road_inventory;
CREATE POLICY road_inventory_delete_admin
ON public.road_inventory FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.member_role[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.road_inventory TO authenticated;
COMMENT ON TABLE public.road_inventory IS
  'Inventario vial de GEOTRACIA asociado a camino y tramo, aislado por organización y proyecto.';

COMMIT;
