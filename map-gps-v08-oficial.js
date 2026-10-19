/* GEOTRACIA MAPA v0.8 — Capas oficiales ampliadas MOP + OSM.
   Requiere Leaflet, map-gps.js y map-gps-v06.js cargados antes. */
(() => {
  'use strict';
  if (window.__geoMapV08Installed) return;
  window.__geoMapV08Installed = true;

  const ROOT = 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/';
  const DEFINITIONS = [
    ['Red vial nacional MOP', 'Red_Vial_Chile/MapServer', 0.82, 5, false],
    ['Puentes y pasos superiores', 'Puentes/MapServer', 0.95, 5, true],
    ['Emergencias viales MOP', 'Emergencias_Vialidad/MapServer', 0.98, 4, true],
    ['Infraestructura vial', 'Infraestructura_Vial/MapServer', 0.88, 6, false],
    ['Catastro vial: señales y saneamiento', 'Catastro_Vial/MapServer', 0.8, 13, false],
    ['Red vial estructurante', 'Red_Vial_Estructurante/MapServer', 0.9, 5, false],
    ['Estado de red vial pavimentada', 'Estado_Red_Vial_Pavimentada/MapServer', 0.85, 7, false],
    ['Restricciones viales', 'Restricciones_Vialidad/MapServer', 0.95, 5, false],
    ['Zonas de descanso', 'Zonas_de_Descanso/MapServer', 0.95, 5, false],
    ['Pasos fronterizos', 'Pasos_Fronterizos/MapServer', 0.95, 5, false],
    ['Contratos globales de conservación', 'Contratos_Globales_CC/MapServer', 0.75, 7, false]
  ];
  const S = { map: null, layers: {}, control: null, loading: false };
  const $ = s => document.querySelector(s);
  function status(message, error=false) {
    const el = $('#geoMapStatus');
    if (!el) return;
    let span = el.querySelector('span');
    if (!span) { span = document.createElement('span'); el.replaceChildren(span); }
    span.textContent = message;
    el.classList.toggle('is-error', error);
  }
  function loadEsriLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L?.esri?.dynamicMapLayer) return resolve();
      const old = document.querySelector('script[data-geotracia-esri]');
      if (old) {
        old.addEventListener('load', resolve, {once:true});
        old.addEventListener('error', () => reject(new Error('No se pudo cargar Esri Leaflet')), {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/esri-leaflet@3.0.15/dist/esri-leaflet.js';
      script.async = true;
      script.dataset.geotraciaEsri = '1';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar Esri Leaflet'));
      document.head.appendChild(script);
    });
  }
  function createLayer(def) {
    const [label, endpoint, opacity, minZoom] = def;
    const layer = L.esri.dynamicMapLayer({
      url: ROOT + endpoint,
      opacity,
      minZoom,
      useCors: true,
      attribution: 'Cartografía oficial © Dirección de Vialidad, Ministerio de Obras Públicas (MOP), Chile'
    });
    layer.__geoLabel = label;
    layer.on('requesterror', () => {
      status('La fuente "' + label + '" no respondió. Revisa la conexión o desactiva la capa.', true);
    });
    return layer;
  }
  function setup(map) {
    if (!map || S.map === map || S.loading) return;
    S.map = map;
    S.loading = true;
    loadEsriLeaflet().then(() => {
      for (const def of DEFINITIONS) {
        try { S.layers[def[0]] = createLayer(def); }
        catch (e) { console.warn('[GEOTRACIA] Capa no inicializada:', def[0], e); }
      }
      const overlays = {};
      for (const def of DEFINITIONS) {
        const layer = S.layers[def[0]];
        if (layer) overlays[def[0]] = layer;
      }
      S.control = L.control.layers({}, overlays, {collapsed:true, position:'topright'}).addTo(map);
      const container = S.control.getContainer();
      if (container) {
        container.classList.add('geo-official-layer-control');
        container.setAttribute('aria-label', 'Capas oficiales de Vialidad MOP');
      }
      for (const def of DEFINITIONS) {
        if (def[4] && S.layers[def[0]]) S.layers[def[0]].addTo(map);
      }
      map.on('overlayadd', e => {
        if (e.layer?.__geoLabel) status('Capa activada: ' + e.layer.__geoLabel + '. Consulta la ficha de fuente para conocer cobertura y fecha de actualización.');
      });
      map.on('overlayremove', e => {
        if (e.layer?.__geoLabel) status('Capa desactivada: ' + e.layer.__geoLabel);
      });
      status('Capas MOP disponibles en el selector superior derecho. Se activan bajo demanda; cobertura y actualización dependen de cada servicio.');
      console.info('[GEOTRACIA v0.8] Selector de capas oficiales listo:', Object.keys(S.layers).length);
    }).catch(err => {
      console.warn('[GEOTRACIA v0.8]', err);
      status('No se pudo cargar el complemento cartográfico MOP. El mapa base, GPS y OSM siguen disponibles.', true);
    }).finally(() => { S.loading = false; });
  }
  function install() {
    if (!window.L?.map) { setTimeout(install, 250); return; }
    if (L.map.__geoV08Wrapped) return;
    const original = L.map;
    function wrapped(...args) {
      const map = original.apply(this, args);
      const target = args[0];
      if (target === 'geoLeafletMap' || target?.id === 'geoLeafletMap') setTimeout(() => setup(map), 500);
      return map;
    }
    wrapped.__geoV08Wrapped = true;
    L.map = wrapped;
  }
  install();
})();
