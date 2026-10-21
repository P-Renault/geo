/* GEOTRACIA v2.1 — reconstrucción topológica de caminos y respaldo MOP.
   OSM: geometría cartográfica. MOP: datos oficiales del tramo. No guarda ni modifica datos. */
(() => {
  'use strict';
  if (window.__geoMapV21Installed) return;
  window.__geoMapV21Installed = true;

  const OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  const MOP_ROOT = 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Red_Vial_Chile/MapServer/2/query';
  const CACHE_TTL = 10 * 60 * 1000;
  const cache = new Map();
  let mapRef = null, osmActive = false, mopActive = false, osmHighlight = null;
  let osmBusy = false, mopBusy = false, activeController = null;
  let nationalLayer = null, nationalLayerControl = null, nationalLayerEnabled = false, nationalLayerBusy = false, nationalMoveTimer = null, nationalClickTimer = null;
  let osmButton = null, mopButton = null;
  let approxMode = false, approxPoints = [], approxLine = null, approxMarkers = [], approxBar = null;
  let latestOsmClick = null, latestMopClick = null;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtM = m => m < 1000
    ? new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(m) + ' m'
    : new Intl.NumberFormat('es-CL',{minimumFractionDigits:3,maximumFractionDigits:3}).format(m/1000) + ' km';
  const fmtKm = km => new Intl.NumberFormat('es-CL',{maximumFractionDigits:2}).format(km) + ' km';
  const highwayNames = {
    motorway:'Autopista', motorway_link:'Enlace de autopista', trunk:'Vía troncal', trunk_link:'Enlace de vía troncal',
    primary:'Vía principal', primary_link:'Enlace de vía principal', secondary:'Vía secundaria', secondary_link:'Enlace de vía secundaria',
    tertiary:'Vía terciaria', tertiary_link:'Enlace de vía terciaria', unclassified:'Vía pública de menor jerarquía (clasificación OSM)',
    residential:'Calle residencial', living_street:'Calle de convivencia', service:'Camino de servicio',
    track:'Camino rural o huella', path:'Sendero o camino peatonal', footway:'Vía peatonal', pedestrian:'Zona peatonal',
    steps:'Escaleras', cycleway:'Ciclovía', bridleway:'Camino para caballos', road:'Vía sin tipo definido en OSM',
    busway:'Vía exclusiva para buses', escape:'Pista de emergencia', raceway:'Pista de carreras',
    proposed:'Vía propuesta', construction:'Vía en construcción'
  };
  const surfaces = {asphalt:'Asfalto',concrete:'Hormigón',concrete_lanes:'Hormigón por franjas',paving_stones:'Adoquines',
    sett:'Piedra labrada',cobblestone:'Piedra',compacted:'Material compactado',fine_gravel:'Gravilla fina',
    gravel:'Grava',dirt:'Tierra',earth:'Tierra',ground:'Suelo natural',mud:'Barro',sand:'Arena',
    grass:'Pasto',wood:'Madera',metal:'Metal',unpaved:'Sin pavimentar',paved:'Pavimentada',bricks:'Ladrillos',rock:'Roca'};
  const accesses = {yes:'Permitido',no:'Prohibido',private:'Privado',permissive:'Permitido con condiciones',
    destination:'Solo acceso local',customers:'Solo clientes',agricultural:'Uso agrícola',forestry:'Uso forestal',delivery:'Solo reparto'};
  function status(message, error=false) {
    const el=$('#geoMapStatus'); if(!el)return;
    let span=el.querySelector('span'); if(!span){span=document.createElement('span');el.replaceChildren(span);}
    span.textContent=message; el.classList.toggle('is-error',error);
  }
  function haversine(a,b) {
    const r=Math.PI/180,R=6371008.8,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r;
    const x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(x)));
  }
  function lengthMeters(nodes) {
    let total=0; for(let i=1;i<nodes.length;i++) total+=haversine([nodes[i-1].lat,nodes[i-1].lon],[nodes[i].lat,nodes[i].lon]);
    return total;
  }
  function segDistance(p,a,b) {
    const sx=111320*Math.cos(p[0]*Math.PI/180),sy=110574;
    const A=[(a[1]-p[1])*sx,(a[0]-p[0])*sy],B=[(b[1]-p[1])*sx,(b[0]-p[0])*sy];
    const vx=B[0]-A[0],vy=B[1]-A[1],d=vx*vx+vy*vy,t=d?Math.max(0,Math.min(1,-(A[0]*vx+A[1]*vy)/d)):0;
    return Math.hypot(A[0]+t*vx,A[1]+t*vy);
  }
  function nearestMeters(p,nodes) {
    let min=Infinity; for(let i=1;i<nodes.length;i++) min=Math.min(min,segDistance(p,[nodes[i-1].lat,nodes[i-1].lon],[nodes[i].lat,nodes[i].lon]));
    return min;
  }
  function pixelDistance(map, click, nodes) {
    const p=map.latLngToContainerPoint(click); let min=Infinity;
    for(let i=1;i<nodes.length;i++) {
      const a=map.latLngToContainerPoint([nodes[i-1].lat,nodes[i-1].lon]);
      const b=map.latLngToContainerPoint([nodes[i].lat,nodes[i].lon]);
      const vx=b.x-a.x,vy=b.y-a.y,den=vx*vx+vy*vy;
      const t=den?Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/den)):0;
      min=Math.min(min,Math.hypot(p.x-(a.x+t*vx),p.y-(a.y+t*vy)));
    } return min;
  }
  function cacheKey(lat,lon) { return (Math.round(lat*700)/700).toFixed(3)+','+(Math.round(lon*700)/700).toFixed(3); }
  async function fetchWays(lat,lon) {
    const key=cacheKey(lat,lon), old=cache.get(key);
    if(old&&Date.now()-old.time<CACHE_TTL)return old.ways;
    const q='[out:json][timeout:4];way(around:80,'+lat+','+lon+')[highway];out body geom;';
    // Consultar ambos endpoints en paralelo evita esperar dos timeouts consecutivos.
    const requests=OVERPASS.map(async endpoint=>{
      const res=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},
        body:'data='+encodeURIComponent(q),
        signal:AbortSignal.timeout(4000),
        cache:'no-store'
      });
      if(!res.ok)throw new Error('Overpass HTTP '+res.status);
      const data=await res.json();
      if(data.remark)throw new Error(data.remark);
      const ways=(data.elements||[]).filter(w=>w.type==='way'&&w.geometry?.length>1);
      if(!ways.length)throw new Error('Endpoint sin geometrías viales');
      return ways;
    });
    try {
      const ways=await Promise.any(requests);
      cache.set(key,{time:Date.now(),ways});
      return ways;
    } catch(error) {
      throw new Error('Ningún endpoint Overpass devolvió geometría dentro del tiempo límite');
    }
  }
  function endpointNodeIds(way) {
    const ids=Array.isArray(way.nodes)?way.nodes:[];
    return ids.length>=2?[ids[0],ids[ids.length-1]]:[];
  }
  function roadIdentity(way) {
    const t=way.tags||{};
    // Si existe nombre o referencia, son la mejor señal de continuidad.
    if(t.name)return 'name:'+t.name.toLocaleLowerCase('es');
    if(t.ref)return 'ref:'+t.ref.toLocaleLowerCase('es');
    // Para vías sin nombre, solo se permite unir segmentos de la misma clase,
    // nunca a través de un nodo con muchas ramificaciones.
    return 'unnamed:'+String(t.highway||'')+'|'+String(t.surface||'');
  }
  function wayEndpoints(way) {
    const ids=endpointNodeIds(way),g=way.geometry||[];
    if(ids.length!==2||g.length<2)return null;
    return [{id:ids[0],point:g[0]},{id:ids[1],point:g[g.length-1]}];
  }
  function bearing(a,b) {
    const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
    return (Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*180/Math.PI+360)%360;
  }
  function turnPenalty(prev,junction,next) {
    const incoming=bearing(prev,junction),outgoing=bearing(junction,next);
    let delta=Math.abs(outgoing-incoming);if(delta>180)delta=360-delta;
    // Menor cambio de rumbo = continuación más probable. No sumar todos los ramales.
    return delta;
  }
  async function fetchWaysByNodes(nodeIds) {
    const ids=[...new Set(nodeIds)].filter(id=>Number.isFinite(Number(id))).slice(0,12);
    if(!ids.length)return [];
    const key='nodes:'+ids.slice().sort((a,b)=>Number(a)-Number(b)).join(',');
    const cached=cache.get(key);if(cached&&Date.now()-cached.time<CACHE_TTL)return cached.ways;
    const union=ids.map(id=>'way(bn:'+id+')[highway];').join('');
    const q='[out:json][timeout:3];('+union+');out body geom;';
    const requests=OVERPASS.map(async endpoint=>{
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},body:'data='+encodeURIComponent(q),signal:AbortSignal.timeout(3200),cache:'no-store'});
      if(!res.ok)throw new Error('Overpass HTTP '+res.status);
      const data=await res.json();if(data.remark)throw new Error(data.remark);
      return (data.elements||[]).filter(w=>w.type==='way'&&w.geometry?.length>1&&w.nodes?.length>1);
    });
    try {const ways=await Promise.any(requests);cache.set(key,{time:Date.now(),ways});return ways;}
    catch(e){return [];}
  }
  async function joinConnectedRoadWays(seed,initialWays) {
    const seedEnds=wayEndpoints(seed);
    if(!seedEnds||!seed.nodes?.length)return {ways:[seed],complete:false};
    const identity=roadIdentity(seed), highway=String(seed.tags?.highway||'');
    const all=new Map(initialWays.map(w=>[w.id,w]));all.set(seed.id,seed);
    const chosen=new Map([[seed.id,seed]]);
    let truncated=false,ambiguous=false;
    // Extender ambos extremos de forma independiente; la consulta por nodo permite
    // continuar más allá del radio inicial sin descargar una zona enorme.
    for(const seedEnd of seedEnds) {
      let currentNode=seedEnd.id;
      let previousPoint=seedEnds.find(e=>String(e.id)!==String(seedEnd.id)).point;
      const visited=new Set();
      for(let hop=0;hop<12;hop++) {
        const nodeKey=String(currentNode);if(visited.has(nodeKey))break;visited.add(nodeKey);
        const touching=()=>[...all.values()].filter(w=>!chosen.has(w.id)&&roadIdentity(w)===identity&&endpointNodeIds(w).some(id=>String(id)===nodeKey));
        let candidates=touching();
        if(identity.startsWith('unnamed:')) {
          candidates=candidates.filter(w=>String(w.tags?.highway||'')===highway);
          const degree=[...all.values()].filter(w=>endpointNodeIds(w).some(id=>String(id)===nodeKey)&&String(w.tags?.highway||'')===highway).length;
          if(degree>2){ambiguous=true;break;}
        }
        if(!candidates.length) {
          const connected=await fetchWaysByNodes([currentNode]);
          for(const w of connected)if(!all.has(w.id))all.set(w.id,w);
          candidates=touching();
          if(identity.startsWith('unnamed:')) {
            candidates=candidates.filter(w=>String(w.tags?.highway||'')===highway);
            const degree=[...all.values()].filter(w=>endpointNodeIds(w).some(id=>String(id)===nodeKey)&&String(w.tags?.highway||'')===highway).length;
            if(degree>2){ambiguous=true;break;}
          }
        }
        if(!candidates.length)break;
        const ranked=candidates.map(w=>{
          const ends=wayEndpoints(w),atNode=ends?.find(e=>String(e.id)===nodeKey),far=ends?.find(e=>String(e.id)!==nodeKey);
          return {way:w,atNode,far,penalty:atNode&&far?turnPenalty(previousPoint,atNode.point,far.point):Infinity};
        }).filter(x=>x.atNode&&x.far).sort((a,b)=>a.penalty-b.penalty);
        if(!ranked.length)break;
        if(ranked.length>1&&Math.abs(ranked[1].penalty-ranked[0].penalty)<12){ambiguous=true;break;}
        const next=ranked[0];chosen.set(next.way.id,next.way);
        currentNode=next.far.id;previousPoint=next.atNode.point;
        if(hop===11)truncated=true;
      }
    }
    return {ways:[...chosen.values()],complete:!truncated&&!ambiguous,ambiguous,truncated};
  }
  function mergedRoadGeometry(ways) {
    // La ficha puede mostrar la geometría de la entidad seleccionada y la suma
    // de segmentos conectados. No se dibuja una línea recta entre extremos.
    const coords=[],seen=new Set();
    for(const way of ways) {
      for(let i=0;i<(way.geometry||[]).length;i++) {
        const p=way.geometry[i],id=way.nodes?.[i];
        const key=id!=null?'n:'+id:'c:'+p.lat.toFixed(7)+','+p.lon.toFixed(7);
        if(seen.has(key))continue;
        seen.add(key);coords.push({lat:p.lat,lon:p.lon,nodeId:id});
      }
    }
    return coords;
  }
  function closeCard(id) {
    const card=document.getElementById(id); if(card)card.remove();
    if(id==='geo-osm-card'&&mapRef&&osmHighlight){mapRef.removeLayer(osmHighlight);osmHighlight=null;}
  }
  function makeCard(id,kicker,title,rows,note,source) {
    closeCard(id);
    const card=document.createElement('section'); card.id=id; card.className='geo-data-card';
    card.setAttribute('role','dialog'); card.setAttribute('aria-modal','false'); card.setAttribute('aria-label',title);
    card.innerHTML='<header class="geo-data-card-head"><div><span class="geo-data-kicker">'+esc(kicker)+'</span><h2>'+esc(title)+'</h2></div><button type="button" class="geo-data-close" aria-label="Cerrar ficha" title="Cerrar">×</button></header>'+
      '<div class="geo-data-card-body"><dl>'+rows.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl><p class="geo-data-note">'+esc(note)+'</p><p class="geo-data-source">'+esc(source)+'</p></div>';
    document.body.appendChild(card); card.querySelector('.geo-data-close').addEventListener('click',()=>closeCard(id));
    return card;
  }
  function loadingCard(id,title,message) {
    closeCard(id);
    const card=document.createElement('section'); card.id=id; card.className='geo-data-card geo-data-loading';
    card.innerHTML='<header class="geo-data-card-head"><div><span class="geo-data-kicker">GEOTRACIA · CONSULTA CARTOGRÁFICA</span><h2>'+esc(title)+'</h2></div><button type="button" class="geo-data-close" aria-label="Cerrar ficha">×</button></header><div class="geo-data-card-body"><div class="geo-data-spinner"></div><p>'+esc(message)+'</p></div>';
    document.body.appendChild(card); card.querySelector('.geo-data-close').addEventListener('click',()=>closeCard(id));
  }
  function showRetryCard(message,latlng,source='osm') {
    const old=document.getElementById('geo-retry-card');if(old)old.remove();
    const card=document.createElement('section');card.id='geo-retry-card';card.className='geo-data-card';
    card.setAttribute('role','dialog');card.setAttribute('aria-label','Reintentar consulta cartográfica');
    card.innerHTML='<header class="geo-data-card-head"><div><span class="geo-data-kicker">GEOTRACIA · CONSULTA AUTOMÁTICA</span><h2>No se pudo medir el camino</h2></div><button type="button" class="geo-data-close" aria-label="Cerrar ficha">×</button></header><div class="geo-data-card-body"><p>'+esc(message)+'</p><p>GEOTRACIA solo mostrará una longitud cuando reciba la geometría vial. No se utilizará una línea recta ni se te pedirá dibujar el camino.</p><button type="button" class="geo-approx-launch">Reintentar selección</button></div>';
    document.body.appendChild(card);
    card.querySelector('.geo-data-close').addEventListener('click',()=>card.remove());
    card.querySelector('.geo-approx-launch').addEventListener('click',()=>{card.remove();if(source==='mop')selectMop(latlng);else selectOsm(latlng);});
  }
  async function searchNationalRoads({query='',latlng=null,limit=20}={}) {
    const cfg=window.GEOTRACIA_SUPABASE_CONFIG||{};
    if(!cfg.url||!cfg.anonKey) throw new Error('Falta la configuración pública de Supabase.');
    const payload={p_query:query.trim()||null,p_lat:latlng?latlng.lat:null,p_lon:latlng?latlng.lng:null,p_limit:limit};
    const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/geotracia_search_national_roads',{
      method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.anonKey,'Authorization':'Bearer '+cfg.anonKey,'Accept':'application/json'},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(9000),cache:'no-store'
    });
    const body=await res.json().catch(()=>null);
    if(!res.ok) throw new Error(body?.message||body?.hint||('Supabase respondió HTTP '+res.status));
    return Array.isArray(body)?body:[];
  }
  async function searchVisibleNationalRoads(bounds, limit=250) {
    const cfg=window.GEOTRACIA_SUPABASE_CONFIG||{};
    if(!cfg.url||!cfg.anonKey) throw new Error('Falta la configuración pública de Supabase.');
    const params={
      p_west:bounds.getWest(),p_south:bounds.getSouth(),
      p_east:bounds.getEast(),p_north:bounds.getNorth(),p_limit:limit
    };
    const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/geotracia_visible_national_roads',{
      method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.anonKey,'Authorization':'Bearer '+cfg.anonKey,'Accept':'application/json'},
      body:JSON.stringify(params),signal:AbortSignal.timeout(12000),cache:'no-store'
    });
    const body=await res.json().catch(()=>null);
    if(!res.ok) throw new Error(body?.message||body?.hint||('Supabase respondió HTTP '+res.status));
    return Array.isArray(body)?body:[];
  }
  function nationalPopup(road) {
    const name=road.road_name||road.road_ref||'Camino sin nombre';
    const len=Number(road.length_m);
    return '<div class="geo-national-popup"><strong>'+esc(name)+'</strong><dl>'+
      '<dt>Referencia</dt><dd>'+esc(road.road_ref||'No informada')+'</dd>'+
      '<dt>Tipo de vía</dt><dd>'+esc(road.road_type||'No informado')+'</dd>'+
      '<dt>Superficie</dt><dd>'+esc(road.surface||'No informada')+'</dd>'+
      '<dt>Longitud geométrica</dt><dd>'+esc(Number.isFinite(len)&&len>0?fmtM(len):'No calculada')+'</dd>'+
      '</dl><small>Fuente: OpenStreetMap / Geofabrik Chile. No es una longitud oficial MOP.</small></div>';
  }
  async function refreshNationalLayer() {
    if(!mapRef||!nationalLayerEnabled||nationalLayerBusy)return;
    if(mapRef.getZoom()<10){nationalLayer.clearLayers();status('Red vial importada activada. Acerca el mapa a nivel de caminos para cargar los datos de Supabase.');return;}
    const b=mapRef.getBounds();
    if((b.getNorth()-b.getSouth())>.20||(b.getEast()-b.getWest())>.20){
      nationalLayer.clearLayers();status('Red vial importada activada. Acerca el mapa para consultar solo el área visible.',false);return;
    }
    nationalLayerBusy=true;status('Consultando red vial importada en Supabase para el área visible…');
    try {
      const rows=await searchVisibleNationalRoads(b,250);
      const features=rows.map(r=>{
        let g=r.geometry;if(typeof g==='string'){try{g=JSON.parse(g)}catch{g=null}}
        if(g?.type==='Feature')g=g.geometry;
        if(!g||!['LineString','MultiLineString'].includes(g.type))return null;
        return {type:'Feature',geometry:g,properties:{id:r.id,name:r.road_name,ref:r.road_ref,type:r.road_type,surface:r.surface,length_m:r.length_m,source:'OSM / Geofabrik Chile'}};
      }).filter(Boolean);
      nationalLayer.clearLayers();
      nationalLayer.addData({type:'FeatureCollection',features});
      status('Red vial importada (OSM / Supabase): '+features.length+' geometrías cargadas en el área visible'+(rows.length>=250?' (límite de 250; acerca más el mapa para ver detalle).':'.'));
    } catch(e) {
      console.error('[GEOTRACIA red vial Supabase]',e);
      status('No se pudo cargar RVI desde Supabase: '+e.message+'. Ejecuta de nuevo geotracia-national-search.sql completo en SQL Editor y espera unos segundos a que se actualice la caché de esquema.',true);
    } finally {nationalLayerBusy=false;}
  }
  function openRviActionMenu(road, latlng) {
    if (!mapRef || !latlng) return;
    closeCard('geo-national-card');
    document.getElementById('geo-rvi-action-overlay')?.remove();
    window.__geoRviPendingAction = { road, latlng: { lat: Number(latlng.lat), lng: Number(latlng.lng) } };
    const overlay = document.createElement('div');
    overlay.id = 'geo-rvi-action-overlay';
    overlay.className = 'geo-rvi-action-overlay';
    overlay.innerHTML = '<section class="geo-rvi-action-card" role="dialog" aria-modal="true" aria-labelledby="geo-rvi-action-title">' +
      '<header><div><small>GEOTRACIA · ACCIONES VIALES</small><h2 id="geo-rvi-action-title">¿Qué deseas registrar?</h2><p>' + esc(road?.road_name || road?.road_ref || 'Vía seleccionada') + '</p></div>' +
      '<button type="button" class="geo-rvi-action-close" aria-label="Cerrar">×</button></header>' +
      '<div class="geo-rvi-action-buttons"><button type="button" data-geo-rvi-action="point"><span>1</span><span><b>Registrar punto</b><small>Guardar una referencia, inspección o incidencia en esta ubicación.</small></span></button>' +
      '<button type="button" data-geo-rvi-action="road"><span>2</span><span><b>Agregar camino al proyecto</b><small>Revisar los datos detectados y agregar la vía al proyecto activo.</small></span></button></div></section>';
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); };
    overlay.querySelector('.geo-rvi-action-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-geo-rvi-action="point"]').focus();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-geo-rvi-action]');
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const action = button.dataset.geoRviAction;
    const detail = window.__geoRviPendingAction;
    document.getElementById('geo-rvi-action-overlay')?.remove();
    if (!detail) { status('Selecciona una vía RVI antes de elegir una acción.', true); return; }
    if (action === 'point') {
      window.dispatchEvent(new CustomEvent('geotracia:rvi-register-point', { detail: { latlng: detail.latlng, road: detail.road } }));
    } else if (action === 'road') {
      window.dispatchEvent(new CustomEvent('geotracia:rvi-add-road', { detail: { road: detail.road } }));
    }
  }, true);
  function addNationalLayerControl(map) {
    nationalLayer=L.geoJSON({type:'FeatureCollection',features:[]},{
      style:()=>({color:'#0d9488',weight:4,opacity:.88,lineCap:'round',lineJoin:'round'}),
      onEachFeature:(feature,layer)=>{
        // Abrir la ficha persistente de GEOTRACIA, no el tooltip efímero de Leaflet.
        const getRoad=()=>{const p=feature.properties||{};return {id:p.id,source_id:String(p.id??''),road_name:p.name||'',road_ref:p.ref||'',road_type:p.type||'',surface:p.surface||'',length_m:p.length_m,geometry:feature.geometry,source:'osm',attributes:{source:'OSM / Geofabrik Chile',source_record_id:p.id,source_name:p.name||null,source_ref:p.ref||null,source_type:p.type||null,source_surface:p.surface||null}};};
        // Retrasa la ficha de un clic para distinguirla de un doble clic.
        // Si llega el doble clic, se cancela la ficha y se abre el menú de acciones.
        layer.on('click',event=>{
          if(event?.originalEvent)L.DomEvent.stopPropagation(event.originalEvent);
          clearTimeout(nationalClickTimer);
          const road=getRoad();
          nationalClickTimer=setTimeout(()=>{
            try { showNationalRoad({...road,distance_m:null},false); }
            catch(error) { console.error('[GEOTRACIA RVI ficha]',error); status('No se pudo abrir la ficha de esta geometría vial: '+error.message,true); }
          },450);
        });
        layer.on('dblclick',event=>{
          clearTimeout(nationalClickTimer);
          // Evita que el doble clic sobre una geometría RVI también active
          // el manejador genérico del mapa que abre directamente Registrar punto.
          window.__geoRviHandledDoubleClickAt=Date.now();
          if(event?.originalEvent){L.DomEvent.stopPropagation(event.originalEvent);L.DomEvent.preventDefault(event.originalEvent);}
          const road=getRoad();
          closeCard('geo-national-card');
          window.__geoRviPendingAction={road,latlng:{lat:event.latlng.lat,lng:event.latlng.lng}};
          openRviActionMenu(road,event.latlng);
        });
        layer.on('mouseover',()=>{ if(!layer.__geoRviSelected)layer.setStyle({weight:6}); });
        layer.on('mouseout',()=>{ if(!layer.__geoRviSelected)nationalLayer.resetStyle(layer); });
      }
    });
    const Control=L.Control.extend({options:{position:'topright'},onAdd(){
      const wrap=L.DomUtil.create('div','leaflet-control geo-national-layer-control');
      wrap.innerHTML='<label class="geo-national-layer-toggle" title="RVI · Red vial importada desde Supabase"><input type="checkbox" aria-label="Activar RVI"><span class="geo-national-layer-short"><b>RVI</b></span></label>';
      L.DomEvent.disableClickPropagation(wrap);L.DomEvent.disableScrollPropagation(wrap);
      const input=wrap.querySelector('input');
      L.DomEvent.on(input,'change',()=>{
        nationalLayerEnabled=input.checked;window.__geoRviEnabled=nationalLayerEnabled;
        if(nationalLayerEnabled){if(!map.hasLayer(nationalLayer))nationalLayer.addTo(map);refreshNationalLayer();}
        else {if(map.hasLayer(nationalLayer))map.removeLayer(nationalLayer);status('Capa de red vial importada desactivada. La capa oficial MOP se controla por separado.');}
      });
      return wrap;
    }});
    nationalLayerControl=new Control();nationalLayerControl.addTo(map);
    map.on('moveend',()=>{if(!nationalLayerEnabled)return;clearTimeout(nationalMoveTimer);nationalMoveTimer=setTimeout(()=>refreshNationalLayer(),450);});
    // Fallback for mobile double-taps: Leaflet may dispatch dblclick on the map
    // rather than the thin road polyline. Resolve the closest visible RVI feature.
    map.on('dblclick',event=>{
      if(!nationalLayerEnabled||!nationalLayer)return;
      if(Date.now()-(Number(window.__geoRviHandledDoubleClickAt)||0)<100)return;
      const target=map.latLngToContainerPoint(event.latlng);let best=null,bestDistance=Infinity;
      const distanceToSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y;const den=dx*dx+dy*dy;const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));};
      const walk=(points,featureLayer)=>{
        if(!Array.isArray(points))return;
        if(points.length&&points[0]&&typeof points[0].lat==='number'){
          for(let i=1;i<points.length;i++){const a=map.latLngToContainerPoint(points[i-1]),b=map.latLngToContainerPoint(points[i]);const d=distanceToSegment(target,a,b);if(d<bestDistance){bestDistance=d;best=featureLayer;}}
        }else points.forEach(part=>walk(part,featureLayer));
      };
      nationalLayer.eachLayer(layer=>{if(layer.getLatLngs)walk(layer.getLatLngs(),layer);});
      if(best&&bestDistance<=28){
        window.__geoRviHandledDoubleClickAt=Date.now();
        const feature=best.feature||{},p=feature.properties||{};
        const road={id:p.id,source_id:String(p.id??''),road_name:p.name||'',road_ref:p.ref||'',road_type:p.type||'',surface:p.surface||'',length_m:p.length_m,geometry:feature.geometry,source:'osm',attributes:{source:'OSM / Geofabrik Chile',source_record_id:p.id,source_name:p.name||null,source_ref:p.ref||null,source_type:p.type||null,source_surface:p.surface||null}};
        clearTimeout(nationalClickTimer);if(event.originalEvent){L.DomEvent.stopPropagation(event.originalEvent);L.DomEvent.preventDefault(event.originalEvent);}openRviActionMenu(road,event.latlng);
      }
    });
  }
  function roadGeoPaths(geometry) {
    if(!geometry)return [];
    let g=geometry;
    if(typeof g==='string'){try{g=JSON.parse(g)}catch{return []}}
    if(g.type==='Feature')g=g.geometry;
    if(!g||!Array.isArray(g.coordinates))return [];
    const raw=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    return raw.filter(path=>Array.isArray(path)&&path.length>1).map(path=>path.map(c=>[Number(c[1]),Number(c[0])]).filter(c=>Number.isFinite(c[0])&&Number.isFinite(c[1]))).filter(path=>path.length>1);
  }
  function showNationalRoad(road,zoom=true) {
    const paths=roadGeoPaths(road.geometry);
    if(!paths.length)throw new Error('El registro encontrado no contiene geometría lineal válida.');
    const layers=paths.map(path=>L.polyline(path,{color:'#0d9488',weight:7,opacity:.97,lineCap:'round',lineJoin:'round'}));
    if(osmHighlight)mapRef.removeLayer(osmHighlight);
    osmHighlight=L.layerGroup(layers).addTo(mapRef);
    // L.LayerGroup no expone getBounds(); calcularlo con FeatureGroup usando las mismas polilíneas.
    const bounds=L.featureGroup(layers).getBounds();if(zoom&&bounds.isValid())mapRef.fitBounds(bounds.pad(.12),{maxZoom:16});
    const length=Number(road.length_m);
    const rows=[
      ['Nombre del camino',road.road_name||'Camino sin nombre registrado'],
      ['Referencia vial',road.road_ref||'No informada'],
      ['Tipo de vía',road.road_type||'No informado'],
      ['Superficie',road.surface||'No informada'],
      ['Longitud de geometría',Number.isFinite(length)&&length>0?fmtM(length):'No calculada'],
      ['Distancia al punto consultado',Number.isFinite(Number(road.distance_m))?fmtM(Number(road.distance_m)):'Búsqueda por nombre/localidad'],
      ['Fuente','Red vial importada · Geofabrik Chile / OpenStreetMap'],
      ['ID de registro',String(road.id??'No informado')]
    ];
    makeCard('geo-national-card','RVI · OSM / SUPABASE',road.road_name||road.road_ref||'Camino vial',rows,
      'Geometría obtenida del catálogo vial nacional importado en Supabase. La longitud se calcula siguiendo la geometría almacenada; puede corresponder a una entidad/segmento y no necesariamente a todo el camino ni a una distancia de conducción.',
      'Datos de OpenStreetMap · ODbL. No corresponde a cartografía oficial MOP.');
    status('Camino encontrado en el catálogo nacional: '+(Number.isFinite(length)&&length>0?fmtM(length):'geometría cargada')+'.');
    return true;
  }
  function openNationalSearch() {
    const old=document.getElementById('geo-national-search');if(old){old.remove();return;}
    const card=document.createElement('section');card.id='geo-national-search';card.className='geo-data-card';card.setAttribute('role','dialog');card.setAttribute('aria-label','Buscar en la red vial nacional');
    card.innerHTML='<header class="geo-data-card-head"><div><span class="geo-data-kicker">GEOTRACIA · CATÁLOGO NACIONAL</span><h2>Buscar camino por nombre o localidad</h2></div><button type="button" class="geo-data-close" aria-label="Cerrar búsqueda">×</button></header><div class="geo-data-card-body"><form class="geo-national-search-form"><label class="geo-national-label" for="geo-national-query">Nombre, ruta, referencia o localidad</label><div class="geo-national-search-row"><input id="geo-national-query" name="query" type="search" placeholder="Ej. Ruta R-720, camino rural, localidad…" minlength="2" autocomplete="off" required><button type="submit" class="geo-national-submit">Buscar</button></div></form><p class="geo-national-hint">También puedes dejar el campo vacío y usar “Buscar cerca del mapa” para consultar la geometría vial próxima al centro del mapa.</p><button type="button" class="geo-national-near">⌖ Buscar cerca del mapa</button><div class="geo-national-results" aria-live="polite"></div></div>';
    document.body.appendChild(card);
    card.querySelector('.geo-data-close').addEventListener('click',()=>card.remove());
    const form=card.querySelector('form'),input=card.querySelector('#geo-national-query'),results=card.querySelector('.geo-national-results');
    async function run(query,near=false){results.innerHTML='<p class="geo-national-state">Consultando Supabase…</p>';try{
      const latlng=near&&mapRef?mapRef.getCenter():null;
      const roads=await searchNationalRoads({query,latlng,limit:20});
      if(!roads.length){results.innerHTML='<p class="geo-national-state">No hay coincidencias. Prueba con parte del nombre, referencia vial o una localidad distinta.</p>';return;}
      results.replaceChildren();roads.forEach((road,i)=>{const b=document.createElement('button');b.type='button';b.className='geo-national-result';const name=road.road_name||road.road_ref||'Camino sin nombre';const meta=[road.road_ref,road.road_type,Number.isFinite(Number(road.length_m))&&Number(road.length_m)>0?fmtM(Number(road.length_m)):null].filter(Boolean).join(' · ');b.innerHTML='<strong>'+esc(name)+'</strong><span>'+esc(meta||'Red vial nacional')+'</span>';b.addEventListener('click',()=>{try{showNationalRoad(road,true);card.remove();}catch(e){results.innerHTML='<p class="geo-national-state is-error">'+esc(e.message)+'</p>';}});results.appendChild(b);});
    }catch(e){console.error('[GEOTRACIA catálogo nacional]',e);results.innerHTML='<p class="geo-national-state is-error">No se pudo consultar el catálogo: '+esc(e.message)+'. Verifica que hayas ejecutado la migración SQL de búsqueda y que Supabase permita la consulta.</p>';}}
    form.addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(q.length<2)return;run(q,false)});
    card.querySelector('.geo-national-near').addEventListener('click',()=>run('',true));
    setTimeout(()=>input.focus(),50);
  }
  async function tryNationalFallback(latlng) {
    try {
      const roads=await searchNationalRoads({latlng,limit:8});
      const valid=roads.map(r=>({...r,_distance:Number(r.distance_m)})).filter(r=>roadGeoPaths(r.geometry).length&&(!Number.isFinite(r._distance)||r._distance<=500));
      if(!valid.length)return false;
      valid.sort((a,b)=>(Number.isFinite(a._distance)?a._distance:Infinity)-(Number.isFinite(b._distance)?b._distance:Infinity));
      return showNationalRoad(valid[0],false);
    } catch(e) { console.warn('[GEOTRACIA catálogo nacional]',e); return false; }
  }
  async function tryMopFallback(latlng) {
    const found=await queryMop(latlng);
    if(!found||found.distance>160)return false;
    const a=found.f.attributes||{},geom=found.f.geometry;
    const paths=geom.paths||[];
    const validPaths=paths.filter(path=>path.length>1);
    if(!validPaths.length)return false;
    if(osmHighlight){mapRef.removeLayer(osmHighlight);osmHighlight=null;}
    osmHighlight=L.layerGroup(validPaths.map(path=>L.polyline(path.map(p=>[p[1],p[0]]),{color:'#2563eb',weight:7,opacity:.96,lineCap:'round',lineJoin:'round'}))).addTo(mapRef);
    const geomLength=mopGeometryLength(geom);
    const name=a.NOMBRE_CAMINO||a.ROL_LABEL||a.ROL||'Camino sin nombre informado';
    const official=Number(a.KM_TRAMO);
    const relativeDiff=Number.isFinite(official)&&official>0?Math.abs(geomLength-official*1000)/(official*1000):null;
    const rows=[
      ['Nombre del camino',name],
      ['Código de camino',a.CODIGO_CAMINO||a.ROL||'No informado'],
      ['Clasificación vial',translateMop('Clasificación',a.CLASIFICACION)],
      ['Tipo de carpeta',translateMop('Carpeta',a.CARPETA)],
      ['Longitud de la geometría MOP',fmtM(geomLength)],
      ['Longitud oficial MOP del tramo',Number.isFinite(official)&&official>0?fmtKm(official):'No informada'],
      ['Diferencia entre ambas longitudes',relativeDiff==null?'No calculable':fmtM(Math.abs(geomLength-official*1000))+(relativeDiff>0.05?' · Diferencia superior al 5 %; revisar delimitación':' · Diferencia inferior o igual al 5 %')],
      ['Distancia desde el punto consultado',fmtM(found.distance)],
      ['Fuente de la geometría','Red vial oficial MOP']
    ];
    makeCard('geo-osm-card','FUENTE DE RESPALDO · MOP',name,rows,
      'OpenStreetMap no respondió a tiempo. Se muestra la geometría oficial MOP más cercana disponible. La longitud de geometría se calcula siguiendo sus segmentos; la longitud oficial es un atributo separado. Esto no representa una distancia de conducción.',
      'Fuente: Dirección de Vialidad, Ministerio de Obras Públicas de Chile.');
    status('OSM no respondió. Se utilizó una geometría oficial MOP como respaldo: '+fmtM(geomLength)+'.');
    return true;
  }
  async function selectOsm(latlng) {
    if(osmBusy){status('La consulta anterior sigue en curso. Espera un momento.');return;} osmBusy=true; loadingCard('geo-osm-card','Buscando camino…','Identificando la vía más cercana y calculando automáticamente la longitud de su geometría.');
    try {
      const ways=await fetchWays(latlng.lat,latlng.lng);
      if(!ways.length){closeCard('geo-osm-card');status('OSM no devolvió geometría. Consultando respaldo MOP…');let recovered=await tryMopFallback(latlng);if(!recovered)recovered=await tryNationalFallback(latlng);if(!recovered){status('OSM, MOP y catálogo nacional no devolvieron geometría. No se calculó una longitud.',true);showRetryCard('Ninguna fuente devolvió geometría vial. Usa “Buscar” para localizar el camino por nombre o referencia, o acerca el mapa; no se calculará una línea recta.',latlng);}return;}
      const p=[latlng.lat,latlng.lng];
      // La distancia visual en pantalla decide primero: es más intuitiva en móvil que un radio fijo en metros.
      const candidates=ways.map(way=>({way,pixels:pixelDistance(mapRef,latlng,way.geometry),meters:nearestMeters(p,way.geometry)}));
      candidates.sort((a,b)=>a.pixels-b.pixels||a.meters-b.meters);
      const best=candidates[0];
      if(best.meters>80){closeCard('geo-osm-card');status('No se encontró una geometría próxima en 80 m. Acerca el mapa y toca directamente sobre la vía.',true);return;}
      const way=best.way,t=way.tags||{};
      const reconstruction=await joinConnectedRoadWays(way,ways); const connected=reconstruction.ways;
      // Sumar cada entidad por separado evita inventar líneas rectas entre vías
      // que no comparten geometría o que aparecen en un orden arbitrario.
      const length=connected.reduce((sum,w)=>sum+lengthMeters((w.geometry||[]).map(p=>({lat:p.lat,lon:p.lon}))),0);
      const highlightLayers=connected.filter(w=>w.geometry?.length>1).map(w=>
        L.polyline(w.geometry.map(n=>[n.lat,n.lon]),{color:'#0d9488',weight:7,opacity:.96,lineCap:'round',lineJoin:'round'})
      );
      if(osmHighlight)mapRef.removeLayer(osmHighlight);
      osmHighlight=L.layerGroup(highlightLayers).addTo(mapRef);
      const rows=[
        ['Nombre del camino',t.name||t.ref||'Sin nombre en OpenStreetMap'],
        ['Clasificación vial',highwayNames[t.highway]||('Otro tipo vial de OSM: '+(t.highway||'No informado'))],
        ['Etiqueta highway original',t.highway||'No informada'],
        ['Superficie',t.surface?(surfaces[t.surface]||('Otra superficie: '+t.surface)):'No informada en OSM'],
        ['Acceso',t.access?(accesses[t.access]||t.access):'No informado en OSM'],
        ['Referencia',t.ref||'No informada'],
        ['Longitud geométrica calculada',fmtM(length)],
        ['Entidades OSM conectadas incluidas',String(connected.length)],
        ['Estado de continuidad',reconstruction.ambiguous?'Intersección ambigua: longitud posiblemente parcial':reconstruction.truncated?'Límite de segmentos alcanzado: longitud posiblemente parcial': 'Continuidad reconstruida'],
        ['Distancia desde el punto consultado',fmtM(best.meters)],
        ['Identificador OSM seleccionado','way/'+way.id]
      ];
      makeCard('geo-osm-card','REFERENCIA CARTOGRÁFICA · OPENSTREETMAP',t.name||t.ref||'Camino sin nombre',rows,
        reconstruction.ambiguous
          ? 'Se detectó una intersección con más de una continuación plausible. Para evitar sumar ramales incorrectos, la expansión se detuvo; la longitud mostrada puede ser parcial. No equivale a longitud oficial MOP ni a distancia de conducción.'
          : reconstruction.truncated
            ? 'La reconstrucción alcanzó el límite de segmentos por consulta. La longitud puede ser parcial; no equivale a longitud oficial MOP ni a distancia de conducción.'
            : connected.length>1
              ? 'La longitud suma la geometría seleccionada y segmentos conectados siguiendo sus nodos y la continuidad direccional. La cobertura depende de la información de OSM y puede no representar todo el camino. No equivale a longitud oficial MOP ni a distancia de conducción.'
              : 'La longitud corresponde a la geometría de la entidad seleccionada. No se encontró una continuación conectada con suficiente confianza; puede representar solo un segmento. No equivale a longitud oficial MOP ni a distancia de conducción.',
        '© OpenStreetMap contributors · Datos sujetos a ODbL.');
      status('Camino seleccionado y medido automáticamente: '+fmtM(length)+' ('+connected.length+' entidad(es) OSM conectada(s)).');
    } catch(e) {
      console.warn('[GEOTRACIA v2.1 OSM; respaldo MOP]',e); closeCard('geo-osm-card');
      status('OSM no respondió dentro del tiempo límite. Consultando respaldo MOP…');
      let recovered=await tryMopFallback(latlng);
      if(!recovered)recovered=await tryNationalFallback(latlng);
      if(!recovered) {
        status('OSM, MOP y catálogo nacional no entregaron geometría vial. No se calculó una longitud.',true);
        showRetryCard('Los servicios externos y el catálogo nacional no devolvieron geometría. Pulsa “Buscar” para probar por nombre o referencia; no se utilizará una línea recta.',latlng);
      }
    } finally {osmBusy=false;}
  }
  const mopTranslations = {
    'UNCLASSIFIED':'Vía pública de menor jerarquía','FOOTWAY':'Vía peatonal','TRACK':'Camino rural o huella',
    'RESIDENTIAL':'Calle residencial','PRIMARY':'Vía principal','SECONDARY':'Vía secundaria','TERTIARY':'Vía terciaria',
    'MOTORWAY':'Autopista','TRUNK':'Vía troncal','SERVICE':'Camino de servicio','ASPHALT':'Asfalto','CONCRETE':'Hormigón',
    'GRAVEL':'Grava','DIRT':'Tierra','UNPAVED':'Sin pavimentar','PAVED':'Pavimentada','YES':'Sí','NO':'No',
    'TRUE':'Sí','FALSE':'No','PAVIMENTADO':'Pavimentado','RIPIO':'Ripio','TIERRA':'Tierra'
  };
  function translateMop(label,value) {
    const v=String(value??'').trim(); if(!v)return 'No informado';
    const u=v.toUpperCase();
    if(mopTranslations[u])return mopTranslations[u];
    if(label==='Concesionado'||label==='Enrolado') {
      if(['1','S','SI','SÍ','TRUE'].includes(u))return 'Sí';
      if(['0','N','NO','FALSE'].includes(u))return 'No';
    }
    return v;
  }
  async function queryMop(latlng) {
    const lat=latlng.lat,lon=latlng.lng;
    const dLat=.0018,dLon=.0025/Math.max(.25,Math.cos(lat*Math.PI/180));
    const params=new URLSearchParams({f:'json',where:'1=1',geometry:`${lon-dLon},${lat-dLat},${lon+dLon},${lat+dLat}`,
      geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',
      outFields:'OBJECTID,ROL,ROL_ID,ROL_LABEL,CODIGO_CAMINO,NOMBRE_CAMINO,CLASIFICACION,CARPETA,KM_I,KM_F,KM_TRAMO,ENROLADO,CONCESIONADO,REGION,TUICION',
      returnGeometry:'true',outSR:'4326',returnZ:'false',returnM:'false',resultRecordCount:'25'});
    const res=await fetch(MOP_ROOT+'?'+params.toString(),{signal:AbortSignal.timeout(5500)});
    if(!res.ok)throw new Error('MOP HTTP '+res.status);
    const data=await res.json(); if(data.error)throw new Error(data.error.message||'Error MOP');
    const features=(data.features||[]).filter(f=>f.geometry?.paths?.length);
    if(!features.length)return null;
    const point=[lon,lat];
    function dist(g) {
      let min=Infinity; const sx=111320*Math.cos(lat*Math.PI/180),sy=110574;
      for(const path of (g.paths||[]))for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i],A=[(a[0]-lon)*sx,(a[1]-lat)*sy],B=[(b[0]-lon)*sx,(b[1]-lat)*sy];
        const vx=B[0]-A[0],vy=B[1]-A[1],d=vx*vx+vy*vy,t=d?Math.max(0,Math.min(1,-(A[0]*vx+A[1]*vy)/d)):0;
        min=Math.min(min,Math.hypot(A[0]+t*vx,A[1]+t*vy));
      }return min;
    }
    const candidates=features.map(f=>({f,distance:dist(f.geometry)})).sort((a,b)=>a.distance-b.distance);
    return candidates[0];
  }
  function mopGeometryLength(g) {
    let total=0;for(const path of (g?.paths||[]))for(let i=1;i<path.length;i++)total+=haversine([path[i-1][1],path[i-1][0]],[path[i][1],path[i][0]]);
    return total;
  }
  async function selectMop(latlng) {
    if(mopBusy)return;mopBusy=true;loadingCard('geo-mop-card','Consultando red vial MOP…','Buscando el tramo oficial más cercano.');
    try {
      const found=await queryMop(latlng);
      if(!found||found.distance>350){closeCard('geo-mop-card');status('No se encontró un tramo MOP cercano. No se calculó una longitud.',true);showRetryCard('No se encontró un tramo MOP cercano. Puedes acercar el mapa o consultar la geometría OSM.',latlng);return;}
      const a=found.f.attributes||{},official=Number(a.KM_TRAMO),hasOfficial=Number.isFinite(official)&&official>0;
      const geometryLength=mopGeometryLength(found.f.geometry);
      const name=a.NOMBRE_CAMINO||a.ROL_LABEL||a.ROL||'Camino sin nombre informado';
      const rawRows=[
        ['Camino',name],['Código de camino',a.CODIGO_CAMINO||a.ROL||'No informado'],
        ['Clasificación vial',a.CLASIFICACION],['Tipo de carpeta',a.CARPETA],['Región',a.REGION],
        ['Kilómetro inicial',a.KM_I!=null?'Km '+a.KM_I:null],['Kilómetro final',a.KM_F!=null?'Km '+a.KM_F:null],
        ['Longitud oficial MOP del tramo',hasOfficial?fmtKm(official):'No informada por el servicio'],
        ['Longitud calculada de geometría devuelta',geometryLength?fmtM(geometryLength):'No disponible'],
        ['Distancia desde el punto consultado',fmtM(found.distance)],['Tuición MOP',a.TUICION],
        ['Concesionado',a.CONCESIONADO!=null?translateMop('Concesionado',a.CONCESIONADO):null]
      ];
      const rows=rawRows.filter(([k,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>[k, k==='Clasificación vial'||k==='Tipo de carpeta'?translateM(k,String(v)):v]);
      makeCard('geo-mop-card','RED VIAL OFICIAL · MOP',name,rows,
        'Longitud oficial MOP y longitud calculada de la geometría son campos distintos. La distancia desde el punto solo indica proximidad; ninguna de estas cifras equivale a una ruta de conducción calculada.',
        'Fuente: Dirección de Vialidad, Ministerio de Obras Públicas de Chile. Cobertura y atributos sujetos al servicio oficial.');
      status('Ficha MOP consultada. Revisa por separado la longitud oficial y la longitud geométrica.');
    } catch(e) {
      console.error('[GEOTRACIA v2.1 MOP]',e);closeCard('geo-mop-card');
      status('La consulta MOP no respondió. No se calculó una longitud.',true);
      showRetryCard('La consulta oficial MOP no respondió a tiempo. Puedes volver a intentarlo.',latlng,'mop');
    } finally {mopBusy=false;}
  }
  function addControl(map,kind,label,title,callback) {
    const Control=L.Control.extend({options:{position:'topright'},onAdd(){
      const wrap=L.DomUtil.create('div','leaflet-bar geo-v13-control');
      const btn=L.DomUtil.create('button','geo-v13-button',wrap);btn.type='button';btn.textContent=label;btn.title=title;
      btn.setAttribute('aria-label',title);btn.setAttribute('aria-pressed','false');
      if(kind==='osm')osmButton=btn;else if(kind==='mop')mopButton=btn;
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(btn,'click',()=>{callback(btn);});
      return wrap;
    }});
    new Control().addTo(map);
  }
  function setup(map) {
    if(!map||mapRef===map)return;mapRef=map;
    addNationalLayerControl(map);
    addControl(map,'national','Buscar','Buscar camino por nombre, referencia o localidad en la red vial nacional',()=>openNationalSearch());
    addControl(map,'osm','OSM','Seleccionar y medir geometría cartográfica OSM',btn=>{
      osmActive=!osmActive;btn.classList.toggle('is-active',osmActive);btn.setAttribute('aria-pressed',String(osmActive));
      map.getContainer().classList.toggle('geo-osm-select-mode',osmActive);
      if(osmActive){mopActive=false;if(mopButton){mopButton.classList.remove('is-active');mopButton.setAttribute('aria-pressed','false');}map.getContainer().classList.remove('geo-mop-select-mode');closeCard('geo-mop-card');status('OSM activo: toca una vía; el sistema seleccionará la geometría más cercana en pantalla.');}
      else status('Selección OSM desactivada.');
    });
    addControl(map,'mop','km','Consultar tramo y longitud oficial MOP',btn=>{
      mopActive=!mopActive;btn.classList.toggle('is-active',mopActive);btn.setAttribute('aria-pressed',String(mopActive));
      map.getContainer().classList.toggle('geo-mop-select-mode',mopActive);
      if(mopActive){osmActive=false;if(osmButton){osmButton.classList.remove('is-active');osmButton.setAttribute('aria-pressed','false');}map.getContainer().classList.remove('geo-osm-select-mode');closeCard('geo-osm-card');status('MOP activo: toca cerca de una vía para consultar el tramo oficial más cercano.');}
      else status('Consulta MOP desactivada.');
    });
    map.on('click',e=>{if(osmActive)selectOsm(e.latlng);else if(mopActive)selectMop(e.latlng);});
  }
  function hook() {
    if(!window.L?.map){setTimeout(hook,150);return;}
    if(window.L.map.__geoV13Wrapped)return;
    const original=L.map;
    function wrapped(...args){const map=original.apply(this,args),target=args[0];if(target==='geoLeafletMap'||target?.id==='geoLeafletMap')setTimeout(()=>setup(map),250);return map;}
    wrapped.__geoV13Wrapped=true;L.map=wrapped;
  }
  hook();
})();