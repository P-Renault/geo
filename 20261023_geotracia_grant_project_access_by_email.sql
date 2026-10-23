-- GEOTRACIA: alta segura de acceso al proyecto mediante correo.
-- Ejecutar una vez desde Supabase SQL Editor con privilegios administrativos.
-- No desactiva RLS: la función verifica permisos del actor antes de escribir.

CREATE OR REPLACE FUNCTION public.geotracia_grant_project_access_by_email(
    p_organization_id uuid,
    p_project_id uuid,
    p_email text,
    p_display_name text DEFAULT NULL,
    p_project_role text DEFAULT 'viewer',
    p_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_actor uuid := auth.uid();
    v_user_id uuid;
    v_email text := lower(trim(coalesce(p_email, '')));
    v_name text;
    v_access_id uuid;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión para administrar accesos.' USING ERRCODE = '42501';
    END IF;

    IF v_email = '' OR position('@' IN v_email) < 2 THEN
        RAISE EXCEPTION 'Ingresa un correo electrónico válido.' USING ERRCODE = '22023';
    END IF;

    IF p_project_role NOT IN ('project_admin', 'supervisor', 'operator', 'viewer') THEN
        RAISE EXCEPTION 'El rol seleccionado no está permitido.' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id
          AND p.organization_id = p_organization_id
    ) THEN
        RAISE EXCEPTION 'El proyecto no pertenece a la organización indicada.' USING ERRCODE = '22023';
    END IF;

    -- Solo administradores de la organización Y administradores del proyecto pueden conceder acceso.
    IF NOT public.has_org_role(p_organization_id, ARRAY['owner'::public.member_role, 'admin'::public.member_role]) THEN
        RAISE EXCEPTION 'No tienes rol owner o admin en esta organización.' USING ERRCODE = '42501';
    END IF;
    IF NOT public.geotracia_has_project_role(p_organization_id, p_project_id, ARRAY['project_admin'::text]) THEN
        RAISE EXCEPTION 'Necesitas el rol project_admin en este proyecto para conceder acceso.' USING ERRCODE = '42501';
    END IF;

    SELECT u.id,
           coalesce(nullif(trim(p_display_name), ''),
                    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
                    split_part(u.email, '@', 1))
      INTO v_user_id, v_name
      FROM auth.users u
     WHERE lower(trim(u.email)) = v_email
     LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No existe una cuenta registrada con ese correo en este proyecto de Supabase.' USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.organization_id = p_organization_id
          AND m.user_id = v_user_id
          AND m.active IS TRUE
    ) THEN
        RAISE EXCEPTION 'La cuenta existe, pero no tiene una membresía activa en esta organización. Solicita que un owner/admin la incorpore primero.' USING ERRCODE = '42501';
    END IF;

    -- Crear el perfil faltante con el UUID de Auth; si existe, mantener su nombre salvo que venga uno explícito.
    INSERT INTO public.profiles (id, full_name, email, created_at, updated_at)
    VALUES (v_user_id, coalesce(v_name, split_part(v_email, '@', 1)), v_email, now(), now())
    ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           full_name = CASE
               WHEN p_display_name IS NOT NULL AND trim(p_display_name) <> '' THEN trim(p_display_name)
               ELSE public.profiles.full_name
           END,
           updated_at = now();

    INSERT INTO public.geotracia_project_access (
        organization_id, project_id, user_id, display_name, email,
        project_role, active, created_by, created_at, updated_at
    ) VALUES (
        p_organization_id, p_project_id, v_user_id, v_name, v_email,
        p_project_role, coalesce(p_active, true), v_actor, now(), now()
    )
    ON CONFLICT (organization_id, project_id, user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           email = EXCLUDED.email,
           project_role = EXCLUDED.project_role,
           active = EXCLUDED.active,
           updated_at = now()
    RETURNING id INTO v_access_id;

    RETURN v_access_id;
END;
$$;

REVOKE ALL ON FUNCTION public.geotracia_grant_project_access_by_email(uuid, uuid, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.geotracia_grant_project_access_by_email(uuid, uuid, text, text, text, boolean) TO authenticated;
