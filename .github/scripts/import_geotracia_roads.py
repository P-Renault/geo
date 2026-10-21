#!/usr/bin/env python3
"""Importador de red vial nacional GEOTRACIA."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

DRIVE_ID = "1LF_QaNcwFNRKWV0F1TPDgHFmjVqttC8b"
LAYER = "gis_osm_roads_free"
DATASET = "geofabrik-chile"
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "500"))
BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def api(path, method="GET", payload=None, prefer=None):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer

    body = (
        json.dumps(payload, separators=(",", ":")).encode()
        if payload is not None else None
    )
    req = Request(BASE + path, data=body, headers=headers, method=method)

    try:
        with urlopen(req, timeout=180) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:1200]
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc


def first(props, *keys):
    for key in keys:
        value = props.get(key)
        if value is not None and str(value).strip():
            return value
    return None


def main():
    if not 1 <= BATCH_SIZE <= 500:
        raise ValueError("BATCH_SIZE debe estar entre 1 y 500.")

    if not BASE.startswith("https://"):
        raise ValueError("SUPABASE_URL debe comenzar con https://")

    # Comprueba credenciales antes de descargar el archivo grande.
    api("/rest/v1/geotracia_national_roads?select=id&limit=1")
    print("Conexión Supabase verificada.", flush=True)

    import gdown

    with tempfile.TemporaryDirectory(prefix="geotracia-") as tmp:
        root = Path(tmp)
        archive = root / "chile.zip"
        gpkg = root / "chile.gpkg"
        geojsonl = root / "roads.geojsonl"

        print("Descargando GeoPackage de Google Drive...", flush=True)
        result = gdown.download(
            f"https://drive.google.com/uc?id={DRIVE_ID}",
            str(archive),
            quiet=False,
        )
        if not result or not zipfile.is_zipfile(archive):
            raise RuntimeError(
                "No se pudo descargar un ZIP válido. "
                "Verifica que Google Drive permita acceso mediante enlace."
            )

        with zipfile.ZipFile(archive) as zf:
            files = [
                x for x in zf.infolist()
                if x.filename.lower().endswith(".gpkg")
            ]
            if not files:
                raise RuntimeError("El ZIP no contiene un GeoPackage.")
            chosen = max(files, key=lambda x: x.file_size)
            print(f"Extrayendo {chosen.filename}...", flush=True)
            with zf.open(chosen) as src, gpkg.open("wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)

        # Confirma que existe la capa esperada.
        subprocess.run(
            ["ogrinfo", "-ro", "-so", str(gpkg), LAYER],
            check=True,
        )

        # Conversión en streaming; no carga todo el archivo en memoria.
        subprocess.run(
            [
                "ogr2ogr", "-f", "GeoJSONSeq", str(geojsonl),
                str(gpkg), LAYER, "-lco", "RS=YES",
            ],
            check=True,
        )

        run = api(
            "/rest/v1/geotracia_network_imports",
            method="POST",
            prefer="return=representation",
            payload={
                "source": "OSM",
                "source_dataset": DATASET,
                "source_version": "geofabrik-chile-2026-10-19",
                "source_date": "2026-10-19",
                "status": "running",
                "metadata": {
                    "layer": LAYER,
                    "batch_size": BATCH_SIZE,
                    "license": "ODbL",
                },
            },
        )
        if not isinstance(run, list) or not run or not run[0].get("id"):
            raise RuntimeError(f"No se creó el control de importación: {run}")

        import_id = run[0]["id"]
        print(f"ID de importación: {import_id}", flush=True)

        batch = []
        read_count = inserted = updated = skipped = 0

        def send(rows):
            return api(
                "/rest/v1/rpc/geotracia_import_national_roads",
                method="POST",
                payload={
                    "p_import_id": import_id,
                    "p_rows": rows,
                },
            )

        try:
            with geojsonl.open(encoding="utf-8") as source:
                for line in source:
                    # GeoJSONSeq (RFC 8142) puede anteponer RS (0x1E)
                    # a cada entidad. Eliminarlo antes de decodificar JSON.
                    line = line.lstrip("\\x1e").strip()
                    if not line:
                        continue

                    try:
                        feature = json.loads(line)
                    except json.JSONDecodeError as exc:
                        preview = line[:300]
                        raise RuntimeError(
                            f"GeoJSON inválido en la línea {read_count + skipped + 1}: "
                            f"{exc}; contenido inicial={preview!r}"
                        ) from exc
                    props = feature.get("properties") or {}
                    geom = feature.get("geometry")

                    if not geom or geom.get("type") not in (
                        "LineString", "MultiLineString"
                    ):
                        skipped += 1
                        continue

                    source_id = first(props, "osm_id", "osm_way_id", "id")
                    if source_id is None:
                        source_id = feature.get("id")
                    if source_id is None:
                        skipped += 1
                        continue

                    batch.append({
                        "source": "OSM",
                        "source_dataset": DATASET,
                        "source_id": str(source_id),
                        "road_name": first(props, "name"),
                        "road_ref": first(props, "ref"),
                        "road_type": first(
                            props, "fclass", "highway", "road_type", "code"
                        ),
                        "surface": first(props, "surface"),
                        "highway_class": first(
                            props, "fclass", "highway", "code"
                        ),
                        "geom": geom,
                        "source_attributes": props,
                    })

                    if len(batch) == BATCH_SIZE:
                        result = send(batch)
                        if int(result.get("read", -1)) != len(batch):
                            raise RuntimeError(
                                f"El lote no coincide con la respuesta: {result}"
                            )
                        read_count += int(result["read"])
                        inserted += int(result.get("inserted", 0))
                        updated += int(result.get("updated", 0))
                        print(
                            f"Leídos={read_count}, insertados={inserted}, "
                            f"actualizados={updated}, omitidos={skipped}",
                            flush=True,
                        )
                        batch = []

            if batch:
                result = send(batch)
                if int(result.get("read", -1)) != len(batch):
                    raise RuntimeError(f"Último lote incompleto: {result}")
                read_count += int(result["read"])
                inserted += int(result.get("inserted", 0))
                updated += int(result.get("updated", 0))

            api(
                f"/rest/v1/geotracia_network_imports?id=eq.{import_id}",
                method="PATCH",
                prefer="return=minimal",
                payload={
                    "status": "completed",
                    "records_read": read_count,
                    "records_inserted": inserted,
                    "records_updated": updated,
                    "completed_at": "now()",
                    "metadata": {
                        "layer": LAYER,
                        "batch_size": BATCH_SIZE,
                        "license": "ODbL",
                        "skipped": skipped,
                    },
                },
            )

            print(
                f"FINALIZADO: {read_count} enviados; "
                f"{inserted} insertados; {updated} actualizados; "
                f"{skipped} omitidos.",
                flush=True,
            )

        except Exception as exc:
            # Conserva el estado de error para diagnóstico y reintento.
            try:
                api(
                    f"/rest/v1/geotracia_network_imports?id=eq.{import_id}",
                    method="PATCH",
                    prefer="return=minimal",
                    payload={
                        "status": "failed",
                        "error_message": str(exc)[:1500],
                    },
                )
            except Exception as tracking_error:
                print(
                    f"No se pudo registrar el error: {tracking_error}",
                    file=sys.stderr,
                )
            raise


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR DE IMPORTACIÓN: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
