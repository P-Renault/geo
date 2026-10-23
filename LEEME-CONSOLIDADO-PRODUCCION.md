# Geotracia — Consolidado de integración de producción

## Archivos del paquete
- `app.js`: Informes y exportaciones consulta datos de Supabase por organización y proyecto. No presenta cifras de muestra. El CSV se construye con registros consultados. PDF/KML se indican como no disponibles en vez de generar archivos falsos. Administración y suscripciones conserva consultas a Supabase y tolera los nombres `billing_period`/`billing_cycle` y `operators_limit`/`operator_limit`.
- `index.html`: referencias versionadas coordinadas para `app.js` y `styles.css`.
- `styles.css`: estilos alineados incluidos en el paquete.
- `202610230004_geotracia_production_consolidation.sql`: migración de compatibilidad para el esquema de suscripciones.

## Instalación
1. Haz copia de seguridad de `app.js`, `index.html` y `styles.css`.
2. Ejecuta la migración SQL en Supabase después de confirmar que existen `geotracia_subscription_plans` y `geotracia_organization_subscriptions`.
3. Sustituye esos tres archivos en la raíz del repositorio.
4. Publica en GitHub Pages y recarga.

## Límites y validación
- Informes consulta `roads`, `segments`, `inspections`, `road_inventory`, `road_incidents` y `maintenance_orders`; las seis tablas deben existir y las políticas RLS deben permitir lectura al usuario de la organización. Si alguna falta o su esquema difiere, se mostrará un error explícito.
- Las estadísticas son recuentos reales de las filas devueltas por Supabase; no se presentan como métricas certificadas. Longitud se calcula a partir de `roads.length_m` o, como alternativa, de los intervalos de `segments`.
- El módulo de suscripciones permite solicitudes; no procesa pagos ni activa planes automáticamente.
- No se ha podido verificar contra tu instancia real de Supabase desde aquí. Ejecuta pruebas de lectura con tu usuario y revisa consola del navegador tras desplegar.
