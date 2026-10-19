/* GEOTRACIA MAPA v0.9 — selector único de capas oficiales MOP.
   Cargar después de Leaflet y map-gps.js. Elimina el script v0.7 del index.html.
   Las capas se solicitan al servicio oficial MOP; no se copian datos. */
(() => {
  'use strict';
  if (window.__geoMapV09Installed) return;
  window.__geoMapV09Installed = true;

  const ROOT = 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/';
  const DEFINITIONS = [
    { label: 'Red vial nacional MOP', endpoint: 'Red_Vial_Chile/MapServer', opacity: .78, minZoom: 5, active: false },
    { label: 'Puentes y pasos superiores', endpoint: 'Puentes/MapServer', opacity: .95, minZoom: 7, active: true },
    { label: 'Emergencias viales MOP', endpoint: 'Emergencias_Vialidad/MapServer', opacity: .98, minZoom: 5, active: true },
    { label: 'Infraestructura vial', endpoint: 'Infraestructura_Vial/MapServer', opacity: .88, minZoom: 7, active: false },
    { label: 'Catastro vial', endpoint: 'Catastro_Vial/MapServer', opacity: .78, minZoom: 13, active: false },
    { label: 'Red vial estructurante', endpoint: 'Red_Vial_Estructurante/MapServer', opacity: .85, minZoom: 7, active: false },
    { label: 'Estado de red pavimentada', endpoint: 'Estado_Red_Vial_Pavimentada/MapServer', opacity: .82, minZoom: 8, active: false },
    { label: 'Restricciones viales', endpoint: 'Restricciones_Vialidad/MapServer', opacity: .95, minZoom: 7, active: false },
    { label: 'Zonas de descanso', endpoint: 'Zonas_de_Descanso/MapServer', opacity: .95, minZoom: 7, active: false },
    { label: 'Pasos fronterizos', endpoint: 'Pasos_Fronterizos/MapServer', opacity: .95, minZoom: 5, active: false },
    { label: 'Contratos globales de conservación', endpoint: 'Contratos_Globales_CC/MapServer', opacity: .75, minZoom: 8, active: false }
  ];

  let mapRef = null;
  let controlRef = null;
  const layers = new Map();
  const $ = (selector) => document.querySelector(selector);

  function setStatus(message, isError = false) {
    const el = $('#geoMapStatus');
    if (!el) return;
    let span = el.querySelector('span');
    if (!span) {
      span = document.createElement('span');
      el.replaceChildren(span);
    }
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
      url: ROOT + def.endpoint,
      opacity: def.opacity,
      minZoom: def.minZoom,
      useCors: true,
      attribution: 'Cartografía oficial © Dirección de Vialidad, Ministerio de Obras Públicas (MOP), Chile'
    });
    layer.__geoV09Label = def.label;
    layer.on('requesterror', () => {
      setStatus('La capa "' + def.label + '" no respondió. Comprueba la conexión o desactívala.', true);
      console.warn('[GEOTRACIA v0.9] Error de servicio MOP:', def.endpoint);
    });
    return layer;
  }

  async function installOnMap(map) {
    if (!map || mapRef === map) return;
    mapRef = map;
    try {
      await loadEsriLeaflet();
      // Retira controles creados por versiones anteriores para evitar selectores duplicados.
      map.eachLayer(layer => {
        if (layer && layer.__geoV07Label) map.removeLayer(layer);
      });
      document.querySelectorAll('.geo-official-layer-control, .geo-mop-layer-control')
        .forEach(node => node.remove());

      const overlays = {};
      for (const def of DEFINITIONS) {
        try {
          const layer = makeLayer(def);
          layers.set(def.label, layer);
          overlays[def.label] = layer;
        } catch (error) {
          console.warn('[GEOTRACIA v0.9] No se pudo preparar:', def.label, error);
        }
      }

      controlRef = L.control.layers({}, overlays, {
        collapsed: true,
        position: 'topright'
      }).addTo(mapRef);

      const control = controlRef.getContainer();
      if (control) {
        control.classList.add('geo-official-layer-control', 'geo-mop-layer-control');
        control.setAttribute('aria-label', 'Capas oficiales de Vialidad MOP');
        const toggle = control.querySelector('.leaflet-control-layers-toggle');
        if (toggle) {
          toggle.title = 'Capas oficiales MOP';
          toggle.setAttribute('aria-label', 'Abrir selector de capas oficiales MOP');
        }
      }

      for (const def of DEFINITIONS) {
        if (def.active && layers.has(def.label)) layers.get(def.label).addTo(mapRef);
      }

      mapRef.on('overlayadd', event => {
        const label = event.layer?.__geoV09Label;
        if (label) setStatus('Capa activa: ' + label + '. La fecha y cobertura dependen del servicio MOP.');
      });
      mapRef.on('overlayremove', event => {
        const label = event.layer?.__geoV09Label;
        if (label) setStatus('Capa desactivada: ' + label);
      });

      setStatus('Selector único MOP listo. Activa las capas necesarias para evitar saturar el mapa.');
      console.info('[GEOTRACIA v0.9] Capas disponibles:', layers.size);
    } catch (error) {
      console.error('[GEOTRACIA v0.9]', error);
      setStatus('No se pudo cargar el complemento cartográfico MOP. El mapa base y el GPS siguen disponibles.', true);
    }
  }

  function installHook() {
    if (!window.L?.map) {
      window.setTimeout(installHook, 200);
      return;
    }
    if (window.L.map.__geoV09Wrapped) return;
    const originalMap = window.L.map;
    function wrappedMap(...args) {
      const map = originalMap.apply(this, args);
      const target = args[0];
      const isGeoMap = target === 'geoLeafletMap' || target?.id === 'geoLeafletMap';
      if (isGeoMap) window.setTimeout(() => installOnMap(map), 350);
      return map;
    }
    wrappedMap.__geoV09Wrapped = true;
    window.L.map = wrappedMap;
  }

  installHook();
})();
