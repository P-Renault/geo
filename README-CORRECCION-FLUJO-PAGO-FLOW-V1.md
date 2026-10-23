# Geotracia 1.4 · Corrección de flujo de contratación con Flow

## Corrección aplicada
- Los planes con precio (`Individual`, `Equipo`, `Empresa`, y cualquier plan de precio fijo) ya no abren el modal «Solicitar cambio de plan».
- El botón invoca la Edge Function `geotracia-flow-create-payment` y redirige únicamente a una URL HTTPS validada de Flow.
- El plan institucional/personalizado conserva la solicitud de propuesta comercial porque no tiene precio fijo.
- Si el servicio de pagos no está configurado o falla, la aplicación muestra un error y no simula que hubo un cobro.
- La licencia no se activa desde el navegador; requiere confirmación verificada por el servidor.
- Se actualizó la versión de caché de `app.js`.

## Despliegue
1. Publicar `app.js` e `index.html` en la raíz de GitHub Pages. Conservar `supabase-config.js` y el resto de archivos de la versión B2/Premium actual.
2. En Supabase, desplegar las funciones incluidas: `geotracia-flow-create-payment`, `geotracia-flow-webhook` y `geotracia-flow-return`.
3. Verificar que los secrets están configurados en Supabase: `PROJECT_URL`, `PROJECT_SERVICE_ROLE_KEY`, `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `FLOW_API_URL=https://www.flow.cl/api`, `FLOW_CONFIRMATION_URL`, `FLOW_RETURN_URL`, `GEOTRACIA_APP_URL`.
4. Verificar en el panel de Flow que las URLs de confirmación y retorno coincidan exactamente con los secrets.

## Base de datos
El paquete incluye la migración `supabase/functions/202610230006_geotracia_flow_payments.sql`. Ejecutarla solo si la estructura de pagos de esta versión aún no está instalada. No repetirla si ya fue aplicada.

## Prueba segura
- Antes de hacer un cobro real, confirmar credenciales productivas, dominio, URL de retorno/webhook, planes y precios netos.
- Iniciar con un usuario autenticado que sea `owner` o `admin` de la organización.
- Un plan con precio debe ir a `https://www.flow.cl/...` sin abrir el modal comercial.
- El plan institucional/personalizado sí muestra «Solicitar propuesta institucional».
- No considerar pagado/activo un plan hasta que Flow confirme y el webhook procese el estado en servidor.

## Alcance de verificación
Se comprobó la sintaxis de `app.js` con Node.js y se revisó la existencia de los archivos de las Edge Functions. No se han ejecutado transacciones reales ni se ha verificado el despliegue privado de las funciones/secrets en la cuenta del usuario.
