/* GEOTRACIA MAPA v0.7 — capas oficiales MOP + OSM v0.6
 * Requiere Leaflet 1.9.4 y map-gps-v06.js cargados antes.
 * Fuentes oficiales MOP; no copia ni redistribuye sus datos.
 */
(() => {
  'use strict';
  if (window.__geoMapV07Installed) return;
  window.__geoMapV07Installed = true;

  const CFG = {
    plugin: 'https://unpkg.com/esri-leaflet@3.0.15/dist/esri-leaflet.js',
    services: {
      roads: 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Red_Vial_Chile/MapServer',
      bridges: 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Puentes/MapServer',
      emergencies: 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Emergencias_Vialidad/MapServer',
      infrastructure: 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Infraestructura_Vial/MapServer',
      cadastre: 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Catastro_Vial/MapServer'
    }
  };
  const S = { map: null, control: null, layers: {}, loading: false };
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  function notice(msg, error=false) {
    const el = $('#geoMapStatus');
    if (!el) return;
    const span = el.querySelector('span');
    if (span) span.textContent = msg;
    else el.textContent = msg;
    el.classList.toggle('is-error', error);
  }
  function loadPlugin() {
    return new Promise((resolve, reject) => {
      if (window.L?.esri) return resolve();
      const existing = document.querySelector('script[data-geo-esri-leaflet]');
      if (existing) {
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = CFG.plugin;
      script.async = true;
      script.dataset.geoEsriLeaflet = 'true';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar Esri Leaflet'));
      document.head.appendChild(script);
    });
  }
  function dynamic(url, name, opacity=0.85, minZoom=0) {
    const layer = L.esri.dynamicMapLayer({
      url, opacity, minZoom, useCors: true,
      attribution: 'Cartografía oficial © Dirección de Vialidad, MOP Chile'
    });
    layer.__geoName = name;
    layer.on('requesterror', () => notice('Una capa MOP no respondió. Las demás capas y el GPS siguen disponibles.', true));
    return layer;
  }
  function addControl() {
    if (!S.map || S.control || !L.control.layers) return;
    const base = {};
    const satelliteRadio = document.querySelector('input[name="geoBaseLayer"]:checked');
    // No sustituye las capas base ya creadas por el módulo GPS.
    const labels = {
      'Red vial MOP': S.layers.roads,
      'Puentes MOP': S.layers.bridges,
      'Emergencias viales MOP': S.layers.emergencies,
      'Infraestructura (peajes, túneles, pesaje)': S.layers.infrastructure,
      'Catastro vial MOP (señales, saneamiento y otros)': S.layers.cadastre
    };
    S.control = L.control.layers(base, labels, {collapsed: true, position: 'topright'});
    S.control.addTo(S.map);
    const box = S.control.getContainer();
    if (box) {
      box.classList.add('geo-mop-layer-control');
      box.setAttribute('aria-label', 'Capas oficiales de Vialidad MOP');
    }
    // Estado inicial moderado: emergencias y puentes visibles; el usuario puede activar otras capas.
    S.layers.bridges.addTo(S.map);
    S.layers.emergencies.addTo(S.map);
    if (satelliteRadio?.value === 'satellite') {
      notice('Mapa satelital activo. Capas MOP disponibles en el control de capas, esquina superior derecha.');
    } else {
      notice('Capas oficiales MOP preparadas: puentes y emergencias activas. Abre el control de capas para ver red vial e infraestructura.');
    }
  }
  async function init(map) {
    if (!map || S.map === map || !window.L) return;
    S.map = map;
    if (S.loading) return;
    S.loading = true;
    try {
      await loadPlugin();
      S.layers = {
        roads: dynamic(CFG.services.roads, 'Red vial MOP', 0.9, 5),
        bridges: dynamic(CFG.services.bridges, 'Puentes MOP', 0.95, 5),
        emergencies: dynamic(CFG.services.emergencies, 'Emergencias viales MOP', 0.98, 4),
        infrastructure: dynamic(CFG.services.infrastructure, 'Infraestructura vial MOP', 0.9, 6),
        cadastre: dynamic(CFG.services.cadastre, 'Catastro vial MOP', 0.8, 13)
      };
      addControl();
      map.on('overlayadd', e => {
        if (e.layer?.__geoName) notice('Capa activada: ' + e.layer.__geoName + '. La cobertura y vigencia dependen de la fuente MOP.');
      });
      map.on('overlayremove', e => {
        if (e.layer?.__geoName) notice('Capa desactivada: ' + e.layer.__geoName);
      });
      console.info('[GEOTRACIA v0.7] Capas MOP inicializadas.');
    } catch (err) {
      console.warn('[GEOTRACIA v0.7] No fue posible iniciar las capas oficiales:', err);
      notice('Las capas oficiales MOP no se pudieron cargar ahora. El mapa base, GPS y capas OSM siguen disponibles.', true);
    } finally {
      S.loading = false;
    }
  }
  function install() {
    if (!window.L?.map) { setTimeout(install, 250); return; }
    if (L.map.__geoV07Wrapped) return;
    const original = L.map;
    function wrapped(...args) {
      const map = original.apply(this, args);
      const target = args[0];
      if (target === 'geoLeafletMap' || target?.id === 'geoLeafletMap') {
        // Espera a que el módulo v0.6 termine de inicializar sus capas.
        setTimeout(() => init(map), 450);
      }
      return map;
    }
    wrapped.__geoV07Wrapped = true;
    L.map = wrapped;
  }
  install();
})();
