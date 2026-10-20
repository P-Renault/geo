/* GEOTRACIA v1.2 — selección ágil, ficha OSM en español y longitud cartográfica.
   Calcula la longitud geodésica de la geometría OSM devuelta por Overpass.
   No escribe en OSM/Supabase ni reemplaza la longitud oficial MOP. */
(() => {
  'use strict';
  if (window.__geoMapV12OsmInstalled) return;
  window.__geoMapV12OsmInstalled = true;

  const OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  let mapRef = null, active = false, highlight = null, busy = false, controlButton = null;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const highwayNames = {
    motorway:'Autopista', motorway_link:'Enlace de autopista',
    trunk:'Vía troncal', trunk_link:'Enlace de vía troncal',
    primary:'Vía principal', primary_link:'Enlace de vía principal',
    secondary:'Vía secundaria', secondary_link:'Enlace de vía secundaria',
    tertiary:'Vía terciaria', tertiary_link:'Enlace de vía terciaria',
    unclassified:'Vía pública de menor jerarquía (clasificación OSM)',
    residential:'Calle residencial', living_street:'Calle de convivencia',
    service:'Camino de servicio', track:'Camino rural o huella',
    track_grade1:'Camino rural firme', track_grade2:'Camino rural de superficie compacta',
    track_grade3:'Camino rural de superficie mixta', track_grade4:'Camino rural de superficie blanda',
    track_grade5:'Camino rural de baja transitabilidad',
    path:'Sendero o camino peatonal', footway:'Vía peatonal',
    pedestrian:'Zona peatonal', steps:'Escaleras', cycleway:'Ciclovía',
    bridleway:'Camino para caballos', road:'Vía sin tipo definido en OSM',
    busway:'Vía exclusiva para buses', escape:'Pista de emergencia',
    raceway:'Pista de carreras', proposed:'Vía propuesta', construction:'Vía en construcción'
  };
  const surfaceNames = {
    asphalt:'Asfalto', concrete:'Hormigón', concrete_lanes:'Hormigón por franjas',
    concrete: 'Hormigón', paving_stones:'Adoquines', sett:'Piedra labrada',
    cobblestone:'Piedra', compacted:'Material compactado', fine_gravel:'Gravilla fina',
    gravel:'Grava', pebblestone:'Piedra pequeña', dirt:'Tierra', earth:'Tierra',
    ground:'Suelo natural', mud:'Barro', sand:'Arena', grass:'Pasto',
    wood:'Madera', metal:'Metal', unpaved:'Sin pavimentar', paved:'Pavimentada',
    paving_stones:'Adoquines', bricks:'Ladrillos', rock:'Roca', shell:'Conchilla'
  };
  const accessNames = {
    yes:'Permitido', no:'Prohibido', private:'Privado', permissive:'Permitido con condiciones',
    destination:'Solo acceso local', customers:'Solo clientes', agricultural:'Uso agrícola',
    forestry:'Uso forestal', delivery:'Solo reparto'
  };
  const highwayLabel = v => highwayNames[v] || (v ? 'Otro tipo vial de OSM: ' + v : 'No informado');
  const surfaceLabel = v => surfaceNames[v] || (v ? 'Otra superficie: ' + v : 'No informada');
  const accessLabel = v => accessNames[v] || (v ? 'Condición OSM: ' + v : 'No informado');
  const fmt = m => m < 1000
    ? new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(m) + ' m'
    : new Intl.NumberFormat('es-CL',{minimumFractionDigits:3,maximumFractionDigits:3}).format(m/1000) + ' km';
  const status = (message, error=false) => {
    const el = $('#geoMapStatus');
    if (!el) return;
    let span = el.querySelector('span');
    if (!span) { span = document.createElement('span'); el.replaceChildren(span); }
    span.textContent = message;
    el.classList.toggle('is-error', error);
  };
  const haversine = (a,b) => {
    const r=Math.PI/180,R=6371008.8,dLat=(b[0]-a[0])*r,dLon=(b[1]-a[1])*r;
    const x=Math.sin(dLat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));
  };
  function segmentDistance(p,a,b) {
    const sx=111320*Math.cos(p[0]*Math.PI/180),sy=110574;
    const A=[(a[1]-p[1])*sx,(a[0]-p[0])*sy],B=[(b[1]-p[1])*sx,(b[0]-p[0])*sy];
    const vx=B[0]-A[0],vy=B[1]-A[1],d=vx*vx+vy*vy;
    const t=d?Math.max(0,Math.min(1,-(A[0]*vx+A[1]*vy)/d)):0;
    return Math.hypot(A[0]+t*vx,A[1]+t*vy);
  }
  function lengthMeters(nodes) {
    let total=0;
    for(let i=1;i<nodes.length;i++) total+=haversine(
      [nodes[i-1].lat,nodes[i-1].lon],[nodes[i].lat,nodes[i].lon]
    );
    return total;
  }
  function distanceMeters(point,nodes) {
    let min=Infinity;
    for(let i=1;i<nodes.length;i++)
      min=Math.min(min,segmentDistance(point,[nodes[i-1].lat,nodes[i-1].lon],[nodes[i].lat,nodes[i].lon]));
    return min;
  }
  async function queryWays(lat,lon) {
    // Radio ampliado para facilitar la selección en móvil y caminos rurales.
    const query='[out:json][timeout:25];way(around:180,'+lat+','+lon+')[highway];out tags geom;';
    let lastError;
    for(const endpoint of OVERPASS) {
      try {
        const response=await fetch(endpoint,{
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
          body:'data='+encodeURIComponent(query),
          signal:AbortSignal.timeout(30000)
        });
        if(!response.ok) throw new Error('Servicio cartográfico HTTP '+response.status);
        const data=await response.json();
        if(data.remark) throw new Error(data.remark);
        return (data.elements||[]).filter(e=>e.type==='way'&&Array.isArray(e.geometry)&&e.geometry.length>1);
      } catch(error) { lastError=error; }
    }
    throw lastError || new Error('Servicio OSM no disponible');
  }
  function closeCard() {
    const card=$('#geo-osm-card');
    if(card) card.remove();
    if(mapRef && highlight) { mapRef.removeLayer(highlight); highlight=null; }
  }
  function showCard(latlng,way,distance) {
    closeCard();
    const tags=way.tags||{},nodes=way.geometry||[],length=lengthMeters(nodes);
    highlight=L.polyline(nodes.map(n=>[n.lat,n.lon]),{
      color:'#0d9488',weight:7,opacity:.96,lineCap:'round',lineJoin:'round'
    }).addTo(mapRef);
    const rows=[
      ['Nombre del camino',tags.name||tags.ref||'Sin nombre en OpenStreetMap'],
      ['Clasificación vial',highwayLabel(tags.highway)],
      ['Código OSM original',tags.highway||'No informado'],
      ['Superficie',surfaceLabel(tags.surface)],
      ['Acceso',accessLabel(tags.access)],
      ['Referencia',tags.ref||'No informada'],
      ['Longitud de esta geometría',fmt(length)],
      ['Distancia desde el punto seleccionado',fmt(distance)],
      ['Identificador cartográfico','way/'+way.id]
    ];
    const card=document.createElement('section');
    card.id='geo-osm-card';
    card.className='geo-osm-card';
    card.setAttribute('role','dialog');
    card.setAttribute('aria-modal','false');
    card.setAttribute('aria-label','Ficha de referencia cartográfica OpenStreetMap');
    card.innerHTML='<header class="geo-osm-card-head"><div><span class="geo-osm-kicker">REFERENCIA CARTOGRÁFICA · OPENSTREETMAP</span><h2>'+esc(tags.name||tags.ref||'Camino sin nombre')+'</h2></div><button type="button" class="geo-osm-close" aria-label="Cerrar ficha" title="Cerrar">×</button></header><div class="geo-osm-card-body"><dl>'+rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl><p class="geo-osm-note">La longitud es la suma geodésica de los segmentos de esta entidad OSM. Si el camino está dividido en varias entidades, no representa necesariamente su longitud completa. No es distancia de conducción ni medición oficial MOP.</p><p class="geo-osm-attribution">© OpenStreetMap contributors · Datos sujetos a ODbL.</p></div>';
    document.body.appendChild(card);
    card.querySelector('.geo-osm-close').addEventListener('click',closeCard);
    if(highlight) {
      try { mapRef.fitBounds(highlight.getBounds(),{padding:[50,50],maxZoom:17}); }
      catch(_) {}
    }
    status('Longitud cartográfica calculada: '+fmt(length)+'. Entidad OSM '+way.id+'.');
  }
  async function selectWay(latlng) {
    if(busy) return;
    busy=true; status('Buscando caminos y senderos cercanos…');
    try {
      const ways=await queryWays(latlng.lat,latlng.lng),p=[latlng.lat,latlng.lng];
      const candidates=ways.map(way=>({way,distance:distanceMeters(p,way.geometry)})).sort((a,b)=>a.distance-b.distance);
      if(!candidates.length) {
        status('OpenStreetMap no devolvió caminos en el entorno consultado. Esto no demuestra que la vía no exista ni que esté en el inventario MOP.',true);
        return;
      }
      const best=candidates[0];
      if(best.distance>180) {
        status('No se encontró una geometría suficientemente cercana. Acércate más al camino y vuelve a tocar.',true);
        return;
      }
      showCard(latlng,best.way,best.distance);
    } catch(error) {
      console.error('[GEOTRACIA OSM]',error);
      status('No se pudo consultar OpenStreetMap. El servicio puede estar saturado; inténtalo nuevamente.',true);
    } finally { busy=false; }
  }
  function setup(map) {
    if(!map||mapRef===map) return;
    mapRef=map;
    const Control=L.Control.extend({
      options:{position:'topright'},
      onAdd() {
        const container=L.DomUtil.create('div','leaflet-bar geo-osm-measure-control');
        const button=L.DomUtil.create('button','geo-osm-measure-button',container);
        controlButton=button; button.type='button'; button.textContent='OSM';
        button.title='Consultar camino y medir su longitud cartográfica';
        button.setAttribute('aria-label','Activar selección y medición cartográfica OSM');
        button.setAttribute('aria-pressed','false');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(button,'click',()=>{
          active=!active;
          button.classList.toggle('is-active',active);
          button.setAttribute('aria-pressed',String(active));
          map.getContainer().classList.toggle('geo-osm-measure-mode',active);
          if(active) {
            status('Selección OSM activa: toca cerca de cualquier calle, camino rural o sendero.');
            closeCard();
          } else status('Selección OSM desactivada.');
        });
        return container;
      }
    });
    new Control().addTo(map);
    map.on('click',event=>{if(active)selectWay(event.latlng);});
  }
  function hook() {
    if(!window.L?.map){setTimeout(hook,200);return;}
    if(window.L.map.__geoV12Wrapped)return;
    const original=L.map;
    function wrapped(...args) {
      const map=original.apply(this,args),target=args[0];
      if(target==='geoLeafletMap'||target?.id==='geoLeafletMap')setTimeout(()=>setup(map),500);
      return map;
    }
    wrapped.__geoV12Wrapped=true; L.map=wrapped;
  }

  // Traduce valores conocidos de la ficha MOP y eleva sus ventanas por encima de controles.
  const mopValueTranslations={
    'UNCLASSIFIED':'Vía pública de menor jerarquía (código OSM)',
    'FOOTWAY':'Vía peatonal','TRACK':'Camino rural o huella','RESIDENTIAL':'Calle residencial',
    'PRIMARY':'Vía principal','SECONDARY':'Vía secundaria','TERTIARY':'Vía terciaria',
    'MOTORWAY':'Autopista','TRUNK':'Vía troncal','SERVICE':'Camino de servicio',
    'ASPHALT':'Asfalto','CONCRETE':'Hormigón','GRAVEL':'Grava','DIRT':'Tierra',
    'UNPAVED':'Sin pavimentar','PAVED':'Pavimentada','YES':'Sí','NO':'No',
    'TRUE':'Sí','FALSE':'No'
  };
  function translateMopPopup(root) {
    root.querySelectorAll('.geo-road-popup dl>div').forEach(row=>{
      const dt=row.querySelector('dt'),dd=row.querySelector('dd');
      if(!dt||!dd||dd.dataset.geoTranslated==='1')return;
      const key=(dt.textContent||'').trim().toLocaleLowerCase('es');
      let val=(dd.textContent||'').trim(),upper=val.toUpperCase();
      if(key.includes('clasificación')||key.includes('tipo de carpeta')||key.includes('concesionado')) {
        if(mopValueTranslations[upper]) {dd.textContent=mopValueTranslations[upper];dd.dataset.geoTranslated='1';}
      }
    });
  }
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations) {
      for(const node of mutation.addedNodes) {
        if(node.nodeType!==1)continue;
        if(node.matches?.('.leaflet-popup,.leaflet-popup-content'))translateMopPopup(node);
        node.querySelectorAll?.('.leaflet-popup').forEach(translateMopPopup);
      }
    }
  });
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  hook();
})();