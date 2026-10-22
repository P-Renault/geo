-- GEOTRACIA · Operaciones y permisos por proyecto
-- Migración aditiva e idempotente. Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.geotracia_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code text,
  kind text NOT NULL DEFAULT 'operation' CHECK (kind IN ('operation','service')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 200),
  location text,
  road_id uuid REFERENCES public.roads(id) ON DELETE SET NULL,
  km_progressive numeric(10,3) CHECK (km_progressive IS NULL OR km_progressive >= 0),
  assignee_name text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','paused','completed','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  start_date date,
  due_date date,
  description text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date),
  UNIQUE (organization_id, project_id, code)
);
ALTER TABLE public.geotracia_operations ADD COLUMN IF NOT EXISTS road_id uuid REFERENCES public.roads(id) ON DELETE SET NULL;
ALTER TABLE public.geotracia_operations ADD COLUMN IF NOT EXISTS km_progressive numeric(10,3);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='geotracia_operations_km_progressive_check' AND conrelid='public.geotracia_operations'::regclass) THEN
    ALTER TABLE public.geotracia_operations ADD CONSTRAINT geotracia_operations_km_progressive_check CHECK (km_progressive IS NULL OR km_progressive >= 0);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS geotracia_operations_road_idx ON public.geotracia_operations(organization_id,project_id,road_id);
CREATE INDEX IF NOT EXISTS geotracia_operations_project_created_idx ON public.geotracia_operations(organization_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS geotracia_operations_project_status_idx ON public.geotracia_operations(organization_id,project_id,status);

CREATE TABLE IF NOT EXISTS public.geotracia_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  project_role text NOT NULL DEFAULT 'viewer' CHECK (project_role IN ('project_admin','supervisor','operator','viewer')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,project_id,user_id)
);
CREATE INDEX IF NOT EXISTS geotracia_project_access_user_idx ON public.geotracia_project_access(organization_id,project_id,user_id) WHERE active;

CREATE TABLE IF NOT EXISTS public.geotracia_operation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL REFERENCES public.geotracia_operations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name text,
  assignment_role text NOT NULL DEFAULT 'Responsable',
  status text NOT NULL DEFAULT 'Activa' CHECK (status IN ('Activa','Completada','Cancelada')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_id,user_id,assignment_role)
);
CREATE INDEX IF NOT EXISTS geotracia_operation_assignments_project_idx ON public.geotracia_operation_assignments(organization_id,project_id,created_at DESC);

-- Acceso base: miembro activo de la organización y pertenencia al proyecto.
-- La función es SECURITY DEFINER para evitar recursión de RLS al consultar members/access.
CREATE OR REPLACE FUNCTION public.geotracia_has_project_role(p_org uuid,p_project uuid,p_roles text[] DEFAULT ARRAY['project_admin','supervisor','operator','viewer']::text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.organization_id = p_org AND m.user_id = auth.uid() AND m.active = true
      AND lower(coalesce(m.role::text,'')) IN ('owner','admin','administrator')
  ) OR EXISTS (
    SELECT 1 FROM public.geotracia_project_access a
    WHERE a.organization_id = p_org AND a.project_id = p_project
      AND a.user_id = auth.uid() AND a.active = true AND a.project_role = ANY(p_roles)
      AND EXISTS (SELECT 1 FROM public.members m WHERE m.organization_id=p_org AND m.user_id=auth.uid() AND m.active=true)
  );
$$;
REVOKE ALL ON FUNCTION public.geotracia_has_project_role(uuid,uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geotracia_has_project_role(uuid,uuid,text[]) TO authenticated;

ALTER TABLE public.geotracia_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geotracia_project_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geotracia_operation_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geotracia_operations_select ON public.geotracia_operations;
CREATE POLICY geotracia_operations_select ON public.geotracia_operations FOR SELECT TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor','operator','viewer']::text[]));
DROP POLICY IF EXISTS geotracia_operations_insert ON public.geotracia_operations;
CREATE POLICY geotracia_operations_insert ON public.geotracia_operations FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor','operator']::text[]));
DROP POLICY IF EXISTS geotracia_operations_update ON public.geotracia_operations;
CREATE POLICY geotracia_operations_update ON public.geotracia_operations FOR UPDATE TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor','operator']::text[]))
WITH CHECK (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor','operator']::text[]));
DROP POLICY IF EXISTS geotracia_operations_delete ON public.geotracia_operations;
CREATE POLICY geotracia_operations_delete ON public.geotracia_operations FOR DELETE TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin']::text[]));

DROP POLICY IF EXISTS geotracia_project_access_select ON public.geotracia_project_access;
CREATE POLICY geotracia_project_access_select ON public.geotracia_project_access FOR SELECT TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor','operator','viewer']::text[]));
DROP POLICY IF EXISTS geotracia_project_access_insert ON public.geotracia_project_access;
CREATE POLICY geotracia_project_access_insert ON public.geotracia_project_access FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin']::text[]));
DROP POLICY IF EXISTS geotracia_project_access_update ON public.geotracia_project_access;
CREATE POLICY geotracia_project_access_update ON public.geotracia_project_access FOR UPDATE TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin']::text[]))
WITH CHECK (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin']::text[]));
DROP POLICY IF EXISTS geotracia_project_access_delete ON public.geotracia_project_access;
CREATE POLICY geotracia_project_access_delete ON public.geotracia_project_access FOR DELETE TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin']::text[]));

DROP POLICY IF EXISTS geotracia_operation_assignments_select ON public.geotracia_operation_assignments;
CREATE POLICY geotracia_operation_assignments_select ON public.geotracia_operation_assignments FOR SELECT TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor','operator','viewer']::text[]));
DROP POLICY IF EXISTS geotracia_operation_assignments_insert ON public.geotracia_operation_assignments;
CREATE POLICY geotracia_operation_assignments_insert ON public.geotracia_operation_assignments FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor']::text[]));
DROP POLICY IF EXISTS geotracia_operation_assignments_update ON public.geotracia_operation_assignments;
CREATE POLICY geotracia_operation_assignments_update ON public.geotracia_operation_assignments FOR UPDATE TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor']::text[]))
WITH CHECK (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin','supervisor']::text[]));
DROP POLICY IF EXISTS geotracia_operation_assignments_delete ON public.geotracia_operation_assignments;
CREATE POLICY geotracia_operation_assignments_delete ON public.geotracia_operation_assignments FOR DELETE TO authenticated
USING (public.geotracia_has_project_role(organization_id,project_id,ARRAY['project_admin']::text[]));

GRANT SELECT,INSERT,UPDATE,DELETE ON public.geotracia_operations TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.geotracia_project_access TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.geotracia_operation_assignments TO authenticated;
