# GEOTRACIA v0.2.1

- Añadida navegación entre «Iniciar sesión» y «Crear cuenta».
- Alta con nombre, correo, contraseña y nombre opcional de organización.
- Validación de confirmación de contraseña y mensajes de confirmación de correo.
- Recuperación de contraseña disponible desde el modo de inicio de sesión.
- Corregido `autocomplete` del correo para reducir la posibilidad de que el navegador autocompletar confunda la URL de Supabase con el correo.
- Conservada la configuración pública de Supabase entregada para este despliegue.

Nota: el alta depende de la configuración de Supabase Auth. Para crear automáticamente una organización y un perfil, debe estar instalada la función/trigger correspondiente en la base de datos. No se deben poner claves secretas en archivos del frontend.
