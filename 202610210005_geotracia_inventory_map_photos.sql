-- GEOTRACIA · Inventario vial V1.2: ubicación y fotografía
-- Migración aditiva; conserva los registros existentes.
BEGIN;
ALTER TABLE public.road_inventory
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.road_inventory'::regclass
      AND conname='road_inventory_coordinates_valid'
  ) THEN
    ALTER TABLE public.road_inventory
      ADD CONSTRAINT road_inventory_coordinates_valid
      CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR
        (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS road_inventory_project_coordinates_idx
  ON public.road_inventory (organization_id, project_id)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- La fotografía se registra en metadata.inventory_photo.
-- El bucket privado geotracia-evidencias se reutiliza de la migración
-- de fotografías de inspecciones. La ruta debe comenzar con organization_id.
COMMIT;
