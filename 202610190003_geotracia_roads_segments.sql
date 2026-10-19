-- GEOTRACIA v0.4 — Caminos y tramos. Ejecutar después de las migraciones base.
-- No elimina registros; sustituye las políticas de roads/segments.
DO $$ BEGIN
 IF to_regclass('public.roads') IS NULL THEN RAISE EXCEPTION 'No existe public.roads. Ejecuta primero la migración base.'; END IF;
 IF to_regclass('public.segments') IS NULL THEN RAISE EXCEPTION 'No existe public.segments. Ejecuta primero la migración base.'; END IF;
END $$;
ALTER TABLE public.roads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roads_select_org ON public.roads;
DROP POLICY IF EXISTS roads_insert_org ON public.roads;
DROP POLICY IF EXISTS roads_update_org ON public.roads;
DROP POLICY IF EXISTS roads_delete_admin ON public.roads;
CREATE POLICY roads_select_org ON public.roads FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY roads_insert_org ON public.roads FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id,ARRAY['owner','admin','manager','inspector']::public.member_role[]) AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.organization_id=roads.organization_id));
CREATE POLICY roads_update_org ON public.roads FOR UPDATE TO authenticated USING (public.has_org_role(organization_id,ARRAY['owner','admin','manager','inspector']::public.member_role[])) WITH CHECK (public.has_org_role(organization_id,ARRAY['owner','admin','manager','inspector']::public.member_role[]) AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.organization_id=roads.organization_id));
CREATE POLICY roads_delete_admin ON public.roads FOR DELETE TO authenticated USING (public.has_org_role(organization_id,ARRAY['owner','admin']::public.member_role[]));
DROP POLICY IF EXISTS segments_select_org ON public.segments;
DROP POLICY IF EXISTS segments_insert_org ON public.segments;
DROP POLICY IF EXISTS segments_update_org ON public.segments;
DROP POLICY IF EXISTS segments_delete_admin ON public.segments;
CREATE POLICY segments_select_org ON public.segments FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY segments_insert_org ON public.segments FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id,ARRAY['owner','admin','manager','inspector']::public.member_role[]) AND EXISTS(SELECT 1 FROM public.roads r WHERE r.id=road_id AND r.project_id=segments.project_id AND r.organization_id=segments.organization_id) AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.organization_id=segments.organization_id) AND end_km>start_km);
CREATE POLICY segments_update_org ON public.segments FOR UPDATE TO authenticated USING (public.has_org_role(organization_id,ARRAY['owner','admin','manager','inspector']::public.member_role[])) WITH CHECK (public.has_org_role(organization_id,ARRAY['owner','admin','manager','inspector']::public.member_role[]) AND EXISTS(SELECT 1 FROM public.roads r WHERE r.id=road_id AND r.project_id=segments.project_id AND r.organization_id=segments.organization_id) AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.organization_id=segments.organization_id) AND end_km>start_km);
CREATE POLICY segments_delete_admin ON public.segments FOR DELETE TO authenticated USING (public.has_org_role(organization_id,ARRAY['owner','admin']::public.member_role[]));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.roads,public.segments TO authenticated;
CREATE INDEX IF NOT EXISTS roads_org_project_idx ON public.roads(organization_id,project_id);
CREATE INDEX IF NOT EXISTS segments_org_project_idx ON public.segments(organization_id,project_id);
CREATE INDEX IF NOT EXISTS segments_road_progress_idx ON public.segments(road_id,start_km,end_km);
CREATE UNIQUE INDEX IF NOT EXISTS segments_road_code_uidx ON public.segments(road_id,code);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.segments'::regclass AND conname='segments_progression_valid') THEN ALTER TABLE public.segments ADD CONSTRAINT segments_progression_valid CHECK(start_km IS NULL OR end_km IS NULL OR end_km>start_km); END IF; END $$;
