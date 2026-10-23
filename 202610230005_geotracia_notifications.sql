-- GEOTRACIA | MOTOR DE NOTIFICACIONES PERSISTENTES
-- Ejecutar en Supabase SQL Editor. Crea la tabla; no inventa notificaciones de muestra.

BEGIN;

CREATE TABLE IF NOT EXISTS public.geotracia_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT geotracia_notifications_type_check
    CHECK (type IN ('incident','inspection','maintenance','project','subscription','system','assignment'))
);

CREATE INDEX IF NOT EXISTS idx_geotracia_notifications_user_created
  ON public.geotracia_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geotracia_notifications_user_unread
  ON public.geotracia_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_geotracia_notifications_org
  ON public.geotracia_notifications(organization_id);

ALTER TABLE public.geotracia_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS geotracia_notifications_select_own
  ON public.geotracia_notifications;
CREATE POLICY geotracia_notifications_select_own
  ON public.geotracia_notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS geotracia_notifications_update_own
  ON public.geotracia_notifications;
CREATE POLICY geotracia_notifications_update_own
  ON public.geotracia_notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- La creación de avisos debe realizarse desde funciones/operaciones autorizadas.
-- No se concede INSERT a clientes autenticados para impedir notificaciones falsificadas.
REVOKE ALL ON public.geotracia_notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.geotracia_notifications TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='geotracia_notifications'
ORDER BY ordinal_position;
