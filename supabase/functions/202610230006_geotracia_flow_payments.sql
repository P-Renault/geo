-- GEOTRACIA · Flow payments
-- Run in Supabase SQL Editor after the subscription and notification migrations.
BEGIN;
CREATE TABLE IF NOT EXISTS public.geotracia_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 plan_id text NOT NULL REFERENCES public.geotracia_subscription_plans(id) ON DELETE RESTRICT,
 billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
 base_amount_clp integer NOT NULL CHECK (base_amount_clp > 0),
 amount_clp integer NOT NULL CHECK (amount_clp > 0),
 currency text NOT NULL DEFAULT 'CLP' CHECK (currency='CLP'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
 provider text NOT NULL DEFAULT 'flow' CHECK (provider='flow'),
 provider_order_id text UNIQUE,
 provider_token text UNIQUE,
 checkout_url text,
 provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 processed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS geotracia_payments_org_created_idx ON public.geotracia_payments(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS geotracia_payments_user_created_idx ON public.geotracia_payments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS geotracia_payments_status_idx ON public.geotracia_payments(status,created_at DESC);
ALTER TABLE public.geotracia_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geotracia_payments_read_org ON public.geotracia_payments;
CREATE POLICY geotracia_payments_read_org ON public.geotracia_payments FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
REVOKE ALL ON public.geotracia_payments FROM anon, authenticated;
GRANT SELECT ON public.geotracia_payments TO authenticated;

CREATE OR REPLACE FUNCTION public.process_geotracia_flow_payment(
 p_provider_token text, p_flow_status integer, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_payment public.geotracia_payments%ROWTYPE; v_status text; v_end timestamptz; v_plan public.geotracia_subscription_plans%ROWTYPE; v_notify_title text; v_notify_message text;
BEGIN
 IF p_flow_status NOT IN (1,2,3,4) THEN RAISE EXCEPTION 'FLOW_STATUS_INVALID'; END IF;
 SELECT * INTO v_payment FROM public.geotracia_payments WHERE provider_token=p_provider_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
 v_status := CASE p_flow_status WHEN 1 THEN 'pending' WHEN 2 THEN 'approved' WHEN 3 THEN 'rejected' ELSE 'cancelled' END;
 -- Never downgrade an already approved payment or re-apply its subscription.
 IF v_payment.status='approved' THEN
   RETURN jsonb_build_object('payment_id',v_payment.id,'payment_status','approved','already_processed',true);
 END IF;
 UPDATE public.geotracia_payments SET status=v_status,provider_payload=COALESCE(p_payload,'{}'::jsonb),processed_at=CASE WHEN v_status IN ('approved','rejected','cancelled') THEN now() ELSE processed_at END,updated_at=now() WHERE id=v_payment.id;
 IF v_status='approved' THEN
   SELECT * INTO v_plan FROM public.geotracia_subscription_plans WHERE id=v_payment.plan_id AND active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_AVAILABLE'; END IF;
   v_end := CASE WHEN v_payment.billing_cycle='annual' THEN now()+interval '1 year' ELSE now()+interval '1 month' END;
   INSERT INTO public.geotracia_organization_subscriptions(organization_id,plan_id,billing_cycle,status,starts_at,current_period_end,operator_limit,project_limit,created_by,updated_at)
   VALUES(v_payment.organization_id,v_payment.plan_id,v_payment.billing_cycle,'active',now(),v_end,v_plan.max_operators,NULLIF(v_plan.features->>'projects','')::integer,v_payment.user_id,now())
   ON CONFLICT(organization_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,billing_cycle=EXCLUDED.billing_cycle,status='active',starts_at=now(),current_period_end=EXCLUDED.current_period_end,operator_limit=EXCLUDED.operator_limit,project_limit=EXCLUDED.project_limit,created_by=EXCLUDED.created_by,updated_at=now();
   v_notify_title:='Suscripción activada'; v_notify_message:='El pago de tu plan '||v_plan.name||' fue aprobado. La suscripción de la organización está activa.';
 ELSIF v_status='pending' THEN
   v_notify_title:='Pago pendiente'; v_notify_message:='Flow todavía no confirma el pago de tu suscripción. El plan no se activará hasta la confirmación.';
 ELSIF v_status='rejected' THEN
   v_notify_title:='Pago rechazado'; v_notify_message:='Flow rechazó el pago de la suscripción. Puedes volver a intentarlo desde Administración y suscripciones.';
 ELSE
   v_notify_title:='Pago cancelado'; v_notify_message:='La operación de pago fue cancelada. No se activó la suscripción.';
 END IF;
 -- One notification per payment/outcome; repeated webhooks do not create duplicates.
 INSERT INTO public.geotracia_notifications(organization_id,user_id,type,title,message,metadata)
 SELECT v_payment.organization_id,v_payment.user_id,'subscription',v_notify_title,v_notify_message,jsonb_build_object('payment_id',v_payment.id,'status',v_status)
 WHERE NOT EXISTS (SELECT 1 FROM public.geotracia_notifications n WHERE n.user_id=v_payment.user_id AND n.type='subscription' AND n.metadata->>'payment_id'=v_payment.id::text AND n.metadata->>'status'=v_status);
 RETURN jsonb_build_object('payment_id',v_payment.id,'payment_status',v_status,'already_processed',false);
END; $$;
REVOKE ALL ON FUNCTION public.process_geotracia_flow_payment(text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_geotracia_flow_payment(text,integer,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
