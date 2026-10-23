GEOTRACIA — Avatar en cabecera v1

CAMBIO
- Carga la fotografía de perfil en el círculo #userAvatar junto al botón Salir.
- Usa user_metadata.avatar_path y el bucket privado geotracia-avatars.
- Solicita URL firmada al iniciar sesión y cuando Supabase vuelve a emitir una sesión.
- La URL firmada dura 24 horas; al volver a abrir la aplicación, se genera una nueva.
- Si no hay foto o falla la carga, muestra iniciales como alternativa.
- Al cerrar sesión, limpia la imagen.
- Actualiza la versión del Service Worker y el cache busting para publicar los cambios.

REQUISITOS
- Debe estar desplegada la versión de perfil que guarda avatar_path en metadatos de Supabase Auth.
- Bucket privado geotracia-avatars y políticas de Storage ya configuradas.
- No requiere una migración SQL nueva.

PRUEBAS PENDIENTES EN EL PROYECTO REAL
1. Iniciar sesión con una cuenta que tenga avatar_path.
2. Confirmar la imagen en la cabecera, junto a Salir.
3. Recargar y navegar entre módulos: la imagen debe permanecer.
4. Iniciar sesión con otra cuenta: no debe conservarse la foto anterior.
5. Cerrar sesión: debe borrarse la imagen.
6. Verificar consola/red si Storage rechaza la URL firmada.
