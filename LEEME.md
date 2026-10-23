# Geotracia — corrección de contratación directa con Flow

## Qué corrige
- `app.js`: los botones de planes con precio ya no abren el formulario «Solicitar cambio de plan». Invocan la Edge Function `geotracia-flow-create-payment` y redirigen al checkout de Flow.
- `supabase/functions/geotracia-flow-create-payment/index.ts`: valida sesión, membresía activa y rol `owner`/`admin`, lee el plan desde el esquema usado por Geotracia (`id` de texto, `custom_limits`, `active`), registra el pago y devuelve la URL de Flow.
- `supabase/functions/geotracia-flow-webhook/index.ts`: consulta el estado directamente a Flow y delega el procesamiento al RPC `process_geotracia_flow_payment`.
- `supabase/functions/geotracia-flow-return/index.ts`: procesa el retorno de navegador y redirige de vuelta a la aplicación con `flow_result`.

El plan Institucional/personalizado conserva el flujo de solicitud comercial, porque no tiene precio fijo para cobro automático.

## Archivos que se deben reemplazar
1. Reemplazar el `app.js` de la raíz del proyecto por el incluido en la carpeta `geotracia-flow-correccion`.
2. Desplegar las tres Edge Functions desde las carpetas correspondientes:
   - `geotracia-flow-create-payment`
   - `geotracia-flow-webhook`
   - `geotracia-flow-return`

No volver a ejecutar migraciones SQL para este cambio si ya se ejecutaron las migraciones de pagos y suscripciones.

## Secrets requeridos en Supabase
Usar los nombres que ya se definieron para Geotracia:
- `PROJECT_URL`
- `PROJECT_SERVICE_ROLE_KEY`
- `FLOW_API_KEY`
- `FLOW_SECRET_KEY`
- `FLOW_API_URL` = `https://www.flow.cl/api` (producción)
- `FLOW_CONFIRMATION_URL` = URL pública de la función `geotracia-flow-webhook`
- `FLOW_RETURN_URL` = URL pública de la función `geotracia-flow-return`
- `GEOTRACIA_APP_URL` = URL pública real de la aplicación Geotracia (la función de retorno vuelve a esta URL)

No colocar claves privadas en `app.js` ni en el navegador. No enviar las claves a nadie.

## Prueba controlada
1. Inicia sesión con un usuario miembro activo de la organización y rol `owner` o `admin`.
2. Elige Mensual o Anual y pulsa el botón del plan con precio.
3. Debe navegar directamente al checkout seguro de `www.flow.cl`; no debe aparecer el modal de solicitud comercial.
4. El plan solo se activa cuando Flow confirma el pago y el webhook procesa el resultado.

Importes: la interfaz muestra valores «+ IVA» y la función calcula el total incluyendo el 19% de IVA. No probar pagos reales hasta verificar que los precios de los planes en Supabase son los valores netos esperados y que las URLs de retorno/confirmación apuntan a las funciones desplegadas.
