-- GEOTRACIA · Planes, suscripciones y solicitudes de cambio
-- Migración aditiva. Ejecutar en Supabase SQL Editor. No procesa cobros.

CREATE TABLE IF NOT EXISTS public.geotracia_subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_price_clp integer,
  annual_price_clp integer,
  max_operators integer,
  custom_limits boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (monthly_price_clp IS NULL OR monthly_price_clp >= 0),
  CHECK (annual_price_clp IS NULL OR annual_price_clp >= 0),
  CHECK (max_operators IS NULL OR max_operators > 0)
);

INSERT INTO public.geotracia_subscription_plans
(id,name,monthly_price_clp,annual_price_clp,max_operators,custom_limits,features,sort_order)
VALUES
('individual','Individual',19990,199900,1,false,'{"projects":1,"storage":"standard","reports":"basic","audit":"basic"}',1),
('equipo','Equipo',69990,699900,5,false,'{"projects":10,"storage":"standard","reports":"standard","audit":"by_permission"}',2),
('empresa','Empresa',179990,1799900,20,false,'{"projects":50,"storage":"expanded","reports":"advanced","audit":"advanced"}',3),
('institucional','Institucional',NULL,NULL,NULL,true,'{"projects":null,"storage":"contract","reports":"custom","audit":"institutional"}',4)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, monthly_price_clp=EXCLUDED.monthly_price_clp,
 annual_price_clp=EXCLUDED.annual_price_clp,max_operators=EXCLUDED.max_operators,
 custom_limits=EXCLUDED.custom_limits,features=EXCLUDED.features,sort_order=EXCLUDED.sort_order,updated_at=now();

CREATE TABLE IF NOT EXISTS public.geotracia_organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.geotracia_subscription_plans(id),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual','custom')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','trialing','active','past_due','suspended','cancelled','expired')),
  starts_at timestamptz,
  current_period_end timestamptz,
  operator_limit integer,
  project_limit integer,
  storage_limit_mb bigint,
  contract_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);
CREATE INDEX IF NOT EXISTS geotracia_org_subscriptions_status_idx ON public.geotracia_organization_subscriptions(status,current_period_end);

CREATE TABLE IF NOT EXISTS public.geotracia_subscription_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_plan_id text NOT NULL REFERENCES public.geotracia_subscription_plans(id),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual','custom')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geotracia_subscription_requests_org_idx ON public.geotracia_subscription_change_requests(organization_id,created_at DESC);

ALTER TABLE public.geotracia_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geotracia_organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geotracia_subscription_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geotracia_plans_read ON public.geotracia_subscription_plans;
CREATE POLICY geotracia_plans_read ON public.geotracia_subscription_plans FOR SELECT TO authenticated USING (active=true);
DROP POLICY IF EXISTS geotracia_org_subscription_read ON public.geotracia_organization_subscriptions;
CREATE POLICY geotracia_org_subscription_read ON public.geotracia_organization_subscriptions FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS geotracia_subscription_requests_read ON public.geotracia_subscription_change_requests;
CREATE POLICY geotracia_subscription_requests_read ON public.geotracia_subscription_change_requests FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));
DROP POLICY IF EXISTS geotracia_subscription_requests_create ON public.geotracia_subscription_change_requests;
CREATE POLICY geotracia_subscription_requests_create ON public.geotracia_subscription_change_requests FOR INSERT TO authenticated
WITH CHECK (requested_by=auth.uid() AND public.has_org_role(organization_id,ARRAY['owner','admin']::public.member_role[]));

COMMENT ON TABLE public.geotracia_organization_subscriptions IS 'Estado comercial por organización. Solo servidor/proceso autorizado debe activar, suspender o modificar límites.';
COMMENT ON TABLE public.geotracia_subscription_change_requests IS 'Solicitudes de cambio de plan; no son pagos ni activan licencias automáticamente.';
