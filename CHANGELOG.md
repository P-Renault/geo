# GEOTRACIA — Patch de identidad y autenticación

## v0.2.2
- Se incorporó el logotipo oficial de GEOTRACIA al acceso y al panel lateral del framework.
- Se agregó versión de logotipo transparente y símbolo para navegación móvil.
- Se refinó el login móvil con pestañas de acceso/registro, campos estilizados y control de visibilidad de contraseña.
- Se añadió registro real mediante Supabase Auth, confirmación de contraseña y metadatos de nombre/organización opcional.
- Se evita autocompletar la URL de Supabase como correo usando `autocomplete=email`, `name=email` e `inputmode=email`.

## Archivos del patch
- `index.html` (modificado)
- `auth.css` (modificado)
- `auth.js` (modificado)
- `styles.css` (modificado)
- `geotracia-logo.png` (nuevo)
- `geotracia-symbol.png` (nuevo)
