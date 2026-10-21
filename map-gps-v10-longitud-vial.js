/* GEOTRACIA v1.0 — consulta de tramo y longitud vial desde la red oficial MOP.
   Se conserva el selector de capas v0.9 y se añade un modo explícito de consulta.
   La consulta usa la capa de entidades MOP Red_Vial_Chile, capa 2 (1:500.000).
   No modifica ni persiste datos del MOP. */
(() => {
  'use strict';
  if (window.__geoMapV10Installed) return;
  window.__geoMapV10Installed = true;

  const ROOT = 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/';
  const DEFINITIONS = [
    { label: 'Red vial oficial MOP', endpoint: 'Red_Vial_Chile/MapServer', opacity: .78, minZoom: 5, active: false },
    { label: 'Puentes y pasos superiores', endpoint: 'Puentes/MapServer', opacity: .95, minZoom: 7, active: false },
    { label: 'Emergencias viales MOP', endpoint: 'Emergencias_Vialidad/MapServer', opacity: .98, minZoom: 5, active: false },
    { label: 'Infraestructura vial', endpoint: 'Infraestructura_Vial/MapServer', opacity: .88, minZoom: 7, active: false },
    { label: 'Catastro vial', endpoint: 'Catastro_Vial/MapServer', opacity: .78, minZoom: 13, active: false },
    { label: 'Red vial estructurante', endpoint: 'Red_Vial_Estructurante/MapServer', opacity: .85, minZoom: 7, active: false },
    { label: 'Estado de red pavimentada', endpoint: 'Estado_Red_Vial_Pavimentada/MapServer', opacity: .82, minZoom: 8, active: false },
    { label: 'Restricciones viales', endpoint: 'Restricciones_Vialidad/MapServer', opacity: .95, minZoom: 7, active: false },
    { label: 'Zonas de descanso', endpoint: 'Zonas_de_Descanso/MapServer', opacity: .95, minZoom: 7, active: false },
    { label: 'Pasos fronterizos', endpoint: 'Pasos_Fronterizos/MapServer', opacity: .95, minZoom: 5, active: false },
    { label: 'Contratos globales de conservación', endpoint: 'Contratos_Globales_CC/MapServer', opacity: .75, minZoom: 8, active: false }
  ];

  let mapRef = null, controlRef = null, queryMode = false, queryControl = null;
  const layers = new Map();
  const $ = s => document.querySelector(s);

  function setStatus(message, isError = false) {
    const el = $('#geoMapStatus');
    if (!el) return;
    let span = el.querySelector('span');
    if (!span) { span = document.createElement('span'); el.replaceChildren(span); }
    span.textContent = message;
    el.classList.toggle('is-error', isError);
  }

  function loadEsriLeaflet() {
    if (window.L?.esri?.dynamicMapLayer) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-geotracia-esri]');
      if (script) {
        if (script.dataset.loaded === 'true') return resolve();
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', () => reject(new Error('No se pudo cargar Esri Leaflet')), { once: true });
        return;
      }
      script = document.createElement('script');
      script.src = 'https://unpkg.com/esri-leaflet@3.0.15/dist/esri-leaflet.js';
      script.async = true;
      script.dataset.geotraciaEsri = '1';
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => reject(new Error('No se pudo cargar Esri Leaflet'));
      document.head.appendChild(script);
    });
  }

  function makeLayer(def) {
    const layer = L.esri.dynamicMapLayer({
      url: ROOT + def.endpoint, opacity: def.opacity, minZoom: def.minZoom, useCors: true,
      attribution: 'Cartografía oficial © Dirección de Vialidad, Ministerio de Obras Públicas (MOP), Chile'
    });
    layer.__geoV10Label = def.label;
    layer.on('requesterror', () => setStatus('La capa "' + def.label + '" no respondió. Comprueba la conexión.', true));
    return layer;
  }

  function formatKm(km) {
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(km) + ' km';
  }
  function haversine(a, b) {
    const rad = d => d * Math.PI / 180, R = 6371008.8;
    const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
    const lat1 = rad(a[1]), lat2 = rad(b[1]);
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function geometryLengthMeters(geometry) {
    if (!geometry) return null;
    const paths = geometry.paths || [];
    if (!paths.length) return null;
    let total = 0;
    for (const path of paths) {
      for (let i = 1; i < path.length; i++) total += haversine(path[i-1], path[i]);
    }
    return total;
  }
  function pointSegmentDistanceMeters(point, a, b) {
    // Proyección local equirectangular adecuada para ordenar candidatos cercanos.
    const lat0 = point[1] * Math.PI / 180;
    const scaleX = 111320 * Math.cos(lat0), scaleY = 110574;
    const p = [0, 0], A = [(a[0]-point[0])*scaleX, (a[1]-point[1])*scaleY],
      B = [(b[0]-point[0])*scaleX, (b[1]-point[1])*scaleY];
    const vx = B[0]-A[0], vy = B[1]-A[1], denom = vx*vx+vy*vy;
    const t = denom ? Math.max(0, Math.min(1, ((p[0]-A[0])*vx+(p[1]-A[1])*vy)/denom)) : 0;
    return Math.hypot(A[0]+t*vx, A[1]+t*vy);
  }
  function distanceToGeometryMeters(point, geometry) {
    let min = Infinity;
    for (const path of (geometry?.paths || [])) {
      for (let i=1; i<path.length; i++) min = Math.min(min, pointSegmentDistanceMeters(point, path[i-1], path[i]));
    }
    return min;
  }
  function esc(s) {
    return String(s ?? 'No informado').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function queryNearestRoad(latlng) {
    const lat = latlng.lat, lon = latlng.lng;
    // Búsqueda inicial en una ventana de ~1 km alrededor del punto.
    const dLat = 0.009, dLon = 0.012 / Math.max(.2, Math.cos(lat * Math.PI/180));
    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      geometry: `${lon-dLon},${lat-dLat},${lon+dLon},${lat+dLat}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'OBJECTID,ROL,ROL_ID,ROL_LABEL,CODIGO_CAMINO,NOMBRE_CAMINO,CLASIFICACION,CARPETA,KM_I,KM_F,KM_TRAMO,ENROLADO,CONCESIONADO,REGION,TUICION',
      returnGeometry: 'true',
      outSR: '4326',
      returnZ: 'false',
      returnM: 'false',
      resultRecordCount: '100'
    });
    const url = ROOT + 'Red_Vial_Chile/MapServer/2/query?' + params.toString();
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('El servicio MOP respondió HTTP ' + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Error en la consulta MOP');
    const features = (data.features || []).filter(f => f.geometry?.paths?.length);
    if (!features.length) return null;
    const point = [lon, lat];
    const candidates = features.map(f => ({
      feature: f,
      distance: distanceToGeometryMeters(point, f.geometry),
      geometryMeters: geometryLengthMeters(f.geometry)
    })).sort((a,b) => a.distance-b.distance);
    return candidates[0];
  }

  function showRoadPopup(map, latlng, candidate) {
    if (!candidate) {
      setStatus('No se encontró un tramo de la red vial MOP en el entorno consultado. Puede faltar cobertura en este sector.', true);
      return;
    }
    const a = candidate.feature.attributes || {};
    const officialKm = Number(a.KM_TRAMO);
    const hasOfficialKm = Number.isFinite(officialKm) && officialKm > 0;
    const geomKm = candidate.geometryMeters != null ? candidate.geometryMeters / 1000 : null;
    const shownName = a.NOMBRE_CAMINO || a.ROL_LABEL || a.ROL || 'Camino sin nombre informado';
    const rows = [
      ['Camino', shownName],
      ['Código', a.CODIGO_CAMINO || a.ROL || 'No informado'],
      ['Clasificación', a.CLASIFICACION],
      ['Tipo de carpeta', a.CARPETA],
      ['Región', a.REGION],
      ['Kilómetro inicial', a.KM_I != null ? `Km ${a.KM_I}` : null],
      ['Kilómetro final', a.KM_F != null ? `Km ${a.KM_F}` : null],
      ['Longitud oficial del tramo', hasOfficialKm ? formatKm(officialKm) : null],
      ['Longitud calculada de geometría devuelta', geomKm != null ? formatKm(geomKm) : null],
      ['Distancia desde el punto consultado', formatKm(candidate.distance / 1000)],
      ['Tuición MOP', a.TUICION],
      ['Concesionado', a.CONCESIONADO]
    ].filter(([_,v]) => v !== null && v !== undefined && v !== '');
    const html = `<div class="geo-road-popup"><div class="geo-road-popup-kicker">RED VIAL OFICIAL · MOP</div><h3>${esc(shownName)}</h3><dl>${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="geo-road-source">Fuente: Dirección de Vialidad MOP. El resultado corresponde al tramo geométricamente más cercano entre los elementos devueltos por la consulta, no necesariamente a la vía por la que circulas.</p></div>`;
    L.popup({ maxWidth: 330, maxHeight: 380, autoPan: true }).setLatLng(latlng).setContent(html).openOn(map);
    setStatus('Tramo MOP consultado. Revisa la ficha y distingue la longitud oficial de la longitud geométrica calculada.');
  }

  function addQueryControl(map) {
    if (queryControl) queryControl.remove();
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar geo-road-query-control');
        const button = L.DomUtil.create('button', 'geo-road-query-button', container);
        button.type = 'button';
        button.textContent = 'km';
        button.title = 'Consultar camino y longitud MOP';
        button.setAttribute('aria-label', 'Activar consulta de camino y longitud');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(button, 'click', () => {
          queryMode = !queryMode;
          button.classList.toggle('is-active', queryMode);
          button.setAttribute('aria-pressed', String(queryMode));
          map.getContainer().classList.toggle('geo-road-query-mode', queryMode);
          setStatus(queryMode
            ? 'Modo consulta vial activo: toca cerca de una carretera para consultar su ficha y longitud MOP.'
            : 'Modo consulta vial desactivado.');
        });
        return container;
      }
    });
    queryControl = new Control();
    queryControl.addTo(map);
    map.on('click', async event => {
      if (!queryMode) return;
      setStatus('Consultando la red vial oficial MOP…');
      try {
        const nearest = await queryNearestRoad(event.latlng);
        if (nearest && nearest.distance > 350) {
          setStatus('El camino MOP más cercano está a ' + Math.round(nearest.distance) + ' m. Toca más cerca de la vía para consultar con mayor confianza.', true);
          return;
        }
        showRoadPopup(map, event.latlng, nearest);
      } catch (error) {
        console.error('[GEOTRACIA v1.0] Consulta vial fallida', error);
        setStatus('No se pudo consultar el servicio de red vial MOP. Comprueba la conexión e inténtalo de nuevo.', true);
      }
    });
  }

  async function setup(map) {
    if (!map || mapRef === map) return;
    mapRef = map;
    try {
      await loadEsriLeaflet();
      document.querySelectorAll('.geo-official-layer-control, .geo-mop-layer-control').forEach(node => node.remove());
      for (const def of DEFINITIONS) {
        try { layers.set(def.label, makeLayer(def)); }
        catch (error) { console.warn('[GEOTRACIA v1.0] Capa no inicializada:', def.label, error); }
      }
      const overlays = {};
      for (const def of DEFINITIONS) if (layers.has(def.label)) overlays[def.label] = layers.get(def.label);
      controlRef = L.control.layers({}, overlays, { collapsed: true, position: 'topright' }).addTo(map);
      const control = controlRef.getContainer();
      if (control) {
        control.classList.add('geo-official-layer-control');
        control.setAttribute('aria-label', 'Capas oficiales de Vialidad MOP');
      }
      map.on('overlayadd', e => { if (e.layer?.__geoV10Label) setStatus('Capa activa: ' + e.layer.__geoV10Label + '. La cobertura depende del servicio MOP.'); });
      map.on('overlayremove', e => { if (e.layer?.__geoV10Label) setStatus('Capa desactivada: ' + e.layer.__geoV10Label); });
      addQueryControl(map);
      setStatus('Capas MOP disponibles. Pulsa «km» y luego toca cerca de una carretera para consultar sus datos.');
    } catch (error) {
      console.error('[GEOTRACIA v1.0]', error);
      setStatus('No se pudo cargar el complemento MOP. El mapa base y el GPS siguen disponibles.', true);
    }
  }

  function installHook() {
    if (!window.L?.map) { window.setTimeout(installHook, 200); return; }
    if (window.L.map.__geoV10Wrapped) return;
    const originalMap = window.L.map;
    function wrappedMap(...args) {
      const map = originalMap.apply(this, args);
      const target = args[0];
      if (target === 'geoLeafletMap' || target?.id === 'geoLeafletMap') window.setTimeout(() => setup(map), 350);
      return map;
    }
    wrappedMap.__geoV10Wrapped = true;
    window.L.map = wrappedMap;
  }
  installHook();
})();
