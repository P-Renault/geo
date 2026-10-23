-- GEOTRACIA: directorio autorizado de miembros con nombre/correo desde Supabase Auth.
-- Ejecutar en Supabase SQL Editor antes de publicar el app.js de este delta.
-- Solo owner/admin de la organización puede consultar correos de otros miembros.

CREATE OR REPLACE FUNCTION public.geotracia_org_member_directory(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  active boolean,
  org_name text,
  display_name text,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_org_role(
    p_organization_id,
    ARRAY['owner'::public.member_role, 'admin'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'Solo el propietario o administrador puede consultar el directorio completo.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.user_id,
    m.role::text,
    m.active,
    COALESCE(o.name, 'Organización')::text,
    COALESCE(
      NULLIF(BTRIM(p.full_name), ''),
      NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(BTRIM(u.raw_user_meta_data->>'name'), ''),
      NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
      'Miembro sin nombre'
    )::text,
    COALESCE(NULLIF(BTRIM(u.email), ''), NULLIF(BTRIM(p.email), ''))::text,
    m.created_at
  FROM public.members m
  LEFT JOIN public.organizations o ON o.id = m.organization_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.organization_id = p_organization_id
  ORDER BY m.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.geotracia_org_member_directory(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geotracia_org_member_directory(uuid) TO authenticated;
