-- GEOTRACIA | MOTOR GENERAL DE NOTIFICACIONES v2
-- Ejecutar en Supabase SQL Editor. Idempotente.
BEGIN;

CREATE TABLE IF NOT EXISTS public.geotracia_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  link_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT geotracia_notifications_type_check
    CHECK (type IN ('incident','inspection','maintenance','project','subscription','system','assignment'))
);

CREATE INDEX IF NOT EXISTS idx_geotracia_notifications_user_created
  ON public.geotracia_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geotracia_notifications_user_unread
  ON public.geotracia_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_geotracia_notifications_org
  ON public.geotracia_notifications(organization_id);

ALTER TABLE public.geotracia_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geotracia_notifications_select_own ON public.geotracia_notifications;
CREATE POLICY geotracia_notifications_select_own ON public.geotracia_notifications
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS geotracia_notifications_update_own ON public.geotracia_notifications;
CREATE POLICY geotracia_notifications_update_own ON public.geotracia_notifications
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Clientes pueden leer y actualizar exclusivamente read_at; no pueden falsificar
-- títulos, destinatarios, tipos, enlaces ni fechas de creación.
REVOKE ALL ON public.geotracia_notifications FROM anon, authenticated;
GRANT SELECT ON public.geotracia_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.geotracia_notifications TO authenticated;

-- Inserción de notificaciones solo desde funciones/triggers backend autorizados
-- o procesos con service_role. No se concede INSERT al navegador.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='geotracia_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.geotracia_notifications;
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Publicación supabase_realtime no disponible; omitiendo activación realtime.';
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verificación de esquema
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='geotracia_notifications'
ORDER BY ordinal_position;
