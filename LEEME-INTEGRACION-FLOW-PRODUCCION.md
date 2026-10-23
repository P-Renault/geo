# GEOTRACIA · Integración Flow para producción

Esta entrega diferencial corresponde al repositorio `geo-Desarrollo-1.3.zip`. No incluye una configuración de sandbox: las funciones rechazan `FLOW_API_URL` distinto de `https://www.flow.cl/api` y la creación de checkout solo admite el host HTTPS `www.flow.cl`.

## Archivos incluidos
- `app.js` y `styles.css`: archivos completos modificados de la aplicación. Reemplazar los de la raíz del repositorio de la misma versión.
- `supabase/202610230006_geotracia_flow_payments.sql`: tabla de pagos, RLS y procesamiento transaccional de estados/suscripciones/notificaciones. Ejecutar después de `202610230003_geotracia_subscriptions_admin.sql` y `202610230005_geotracia_notifications.sql`.
- `supabase/functions/geotracia-flow-create-payment/index.ts`: creación de órdenes desde sesión autenticada y validación de membresía/plan/precio en servidor.
- `supabase/functions/geotracia-flow-webhook/index.ts`: consulta estado oficial de Flow server-to-server, comprueba orden/monto/moneda y llama el procesador SQL.
- `supabase/functions/geotracia-flow-return/index.ts`: procesa el token y redirige a la aplicación con el estado final verificado.
- `supabase/config.toml`: configuración JWT de las funciones.

## Secrets de producción
Configurar en el proyecto Supabase de Geotracia, sin compartir sus valores: `PROJECT_URL`, `PROJECT_SERVICE_ROLE_KEY`, `FLOW_API_KEY`, `FLOW_SECRET_KEY`, `FLOW_API_URL`, `FLOW_CONFIRMATION_URL`, `FLOW_RETURN_URL`, `GEOTRACIA_APP_URL`.

- `FLOW_API_URL=https://www.flow.cl/api`
- `FLOW_CONFIRMATION_URL=https://<PROJECT_REF>.supabase.co/functions/v1/geotracia-flow-webhook`
- `FLOW_RETURN_URL=https://<PROJECT_REF>.supabase.co/functions/v1/geotracia-flow-return`
- `GEOTRACIA_APP_URL` debe ser la URL HTTPS pública de la aplicación que carga el dashboard.
- `PROJECT_URL` y `PROJECT_SERVICE_ROLE_KEY` deben pertenecer a Geotracia. La service role key solo se configura como secret de Edge Functions; nunca en `app.js`, HTML ni repositorio.
- `FLOW_API_KEY` y `FLOW_SECRET_KEY` deben ser las credenciales productivas entregadas por Flow para Geotracia. No reutilizar automáticamente las de Agenda YA.

## Despliegue
1. Confirmar que ya están aplicadas las migraciones de suscripciones y notificaciones mencionadas arriba.
2. Ejecutar el SQL de pagos en el SQL Editor del proyecto de Geotracia.
3. Configurar los secrets de producción indicados.
4. Desplegar las funciones con estos nombres exactos: `geotracia-flow-create-payment`, `geotracia-flow-webhook`, `geotracia-flow-return`.
5. Reemplazar `app.js` y `styles.css` en la raíz por los archivos incluidos y publicar la aplicación.
6. Comprobar la URL de retorno y la de confirmación en el panel de Flow; deben coincidir exactamente con los secrets.

## Reglas de negocio
- El importe se calcula en el servidor desde `geotracia_subscription_plans` como precio base + 19 % de IVA redondeado al peso, porque los precios actuales se muestran como `+ IVA`. Confirmar esta regla fiscal antes de habilitar pagos reales.
- El plan Institucional sigue siendo una solicitud comercial y no inicia un cobro automático.
- Estado Flow `2`: aprobado; activa/actualiza la suscripción. `1`: pendiente; no activa. `3`: rechazado. `4`: cancelado y se presenta como no aprobado.
- La interfaz nunca determina el estado a partir de parámetros arbitrarios: el retorno consulta el backend y el backend consulta el estado oficial de Flow.
- La función SQL evita degradar un pago ya aprobado y evita duplicar notificaciones para el mismo pago/estado.

## Nota de operación
Esta entrega está configurada para el endpoint productivo, pero no se han ejecutado transacciones reales ni se ha podido validar en el panel privado de Flow/Supabase. Antes de habilitarla a todos los usuarios, verifica secrets, dominio público, permisos de organización y esquema real de la base. Una validación de configuración no requiere cambiar a sandbox ni hacer un cobro real.
