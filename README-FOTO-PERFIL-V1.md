# Geotracia — Fotografía de perfil v1

## Cambios
- Añadido selector de foto en el formulario Perfil personal.
- Vista previa inmediata antes de guardar.
- Validación de formatos JPG/JPEG, PNG y WebP, máximo 5 MB.
- Carga a Supabase Storage en el bucket privado `geotracia-avatars`.
- La ruta se conserva en `user_metadata.avatar_path`; la imagen se muestra usando URL firmada temporal.
- La fotografía no se publica de forma pública y cada usuario solo puede leer/escribir dentro de su propia carpeta UUID.

## Instalación
1. En Supabase → SQL Editor, ejecutar `202610230008_geotracia_user_profile_avatar.sql`.
2. Desplegar el proyecto completo en GitHub Pages.
3. Abrir Geotracia, entrar a Mi espacio → Perfil personal.
4. Seleccionar una foto y pulsar **Guardar perfil**.
5. Recargar la página y confirmar que la imagen persiste.

## Archivos modificados
- `app.js`
- `premium-ui.css`
- `service-worker.js` (versión de caché actualizada)

## Seguridad y alcance
La foto se guarda en un bucket privado; no se necesita una URL pública. Supabase Auth guarda únicamente la ruta del objeto en `user_metadata`. Las políticas Storage limitan las operaciones a la carpeta con el ID del usuario autenticado. El navegador valida formato y tamaño por usabilidad; los límites del bucket se aplican también en Supabase.

No se ha ejecutado esta migración contra el proyecto Supabase remoto. Debe ejecutarse antes de probar la carga.
