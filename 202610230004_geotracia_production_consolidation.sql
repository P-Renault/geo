-- GEOTRACIA | Consolidación de esquema de suscripciones
-- Ejecutar en Supabase SQL Editor después de revisar el esquema existente.
BEGIN;

-- Catálogo de planes: nombres que consulta la interfaz.
ALTER TABLE public.geotracia_subscription_plans
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_limits BOOLEAN DEFAULT FALSE;

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='geotracia_subscription_plans' AND column_name='is_active') THEN
  UPDATE public.geotracia_subscription_plans SET active=COALESCE(active,is_active,TRUE);
 ELSE
  UPDATE public.geotracia_subscription_plans SET active=COALESCE(active,TRUE);
 END IF;
END $$;

UPDATE public.geotracia_subscription_plans SET sort_order=CASE code WHEN 'individual' THEN 1 WHEN 'equipo' THEN 2 WHEN 'empresa' THEN 3 WHEN 'institucional' THEN 4 ELSE 99 END;

-- La aplicación lee billing_cycle y operator_limit; mantener compatibilidad
-- con instalaciones que ya tengan billing_period / operators_limit.
ALTER TABLE public.geotracia_organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS operator_limit INTEGER;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='geotracia_organization_subscriptions' AND column_name='billing_period') THEN
  UPDATE public.geotracia_organization_subscriptions SET billing_cycle=COALESCE(billing_cycle,billing_period,'monthly');
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='geotracia_organization_subscriptions' AND column_name='operators_limit') THEN
  UPDATE public.geotracia_organization_subscriptions SET operator_limit=COALESCE(operator_limit,operators_limit);
 END IF;
END $$;

-- Asegurar tabla de solicitudes con los nombres exactos de la interfaz.
CREATE TABLE IF NOT EXISTS public.geotracia_subscription_change_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 requested_plan_id UUID NOT NULL REFERENCES public.geotracia_subscription_plans(id) ON DELETE RESTRICT,
 billing_cycle TEXT NOT NULL DEFAULT 'monthly',
 status TEXT NOT NULL DEFAULT 'pending',
 requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 notes TEXT,
 reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
 reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT geotracia_change_cycle_check CHECK (billing_cycle IN ('monthly','annual','custom')),
 CONSTRAINT geotracia_change_status_check CHECK (status IN ('pending','approved','rejected','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_geo_change_requests_org_created ON public.geotracia_subscription_change_requests(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geo_change_requests_status ON public.geotracia_subscription_change_requests(status);
ALTER TABLE public.geotracia_subscription_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_change_requests_select_own ON public.geotracia_subscription_change_requests;
CREATE POLICY geo_change_requests_select_own ON public.geotracia_subscription_change_requests FOR SELECT TO authenticated USING (requested_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS geo_change_requests_insert_own ON public.geotracia_subscription_change_requests;
CREATE POLICY geo_change_requests_insert_own ON public.geotracia_subscription_change_requests FOR INSERT TO authenticated WITH CHECK (requested_by=(SELECT auth.uid()) AND status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);
GRANT SELECT,INSERT ON public.geotracia_subscription_change_requests TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
