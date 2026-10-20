/* GEOTRACIA v1.3 — selección vial rápida, fichas flotantes y medición cartográfica.
   OSM: geometría cartográfica. MOP: datos oficiales del tramo. No guarda ni modifica datos. */
(() => {
  'use strict';
  if (window.__geoMapV13Installed) return;
  window.__geoMapV13Installed = true;

  const OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  const MOP_ROOT = 'https://rest-sit.mop.gob.cl/arcgis/rest/services/VIALIDAD/Red_Vial_Chile/MapServer/2/query';
  const CACHE_TTL = 5 * 60 * 1000;
  const cache = new Map();
  let mapRef = null, osmActive = false, mopActive = false, osmHighlight = null;
  let osmBusy = false, mopBusy = false, activeController = null;
  let osmButton = null, mopButton = null;
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
  function cacheKey(lat,lon) { return (Math.round(lat*1000)/1000).toFixed(3)+','+(Math.round(lon*1000)/1000).toFixed(3); }
  async function fetchWays(lat,lon) {
    const key=cacheKey(lat,lon), old=cache.get(key);
    if(old&&Date.now()-old.time<CACHE_TTL)return old.ways;
    // Menos carga que una consulta de 180 m: limita el área inicial, pero admite caminos rurales.
    const q='[out:json][timeout:18];way(around:95,'+lat+','+lon+')[highway];out tags geom;';
    let last;
    for(const endpoint of OVERPASS) {
      try {
        const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
          body:'data='+encodeURIComponent(q),signal:AbortSignal.timeout(20000)});
        if(!res.ok)throw new Error('HTTP '+res.status);
        const data=await res.json(); if(data.remark)throw new Error(data.remark);
        const ways=(data.elements||[]).filter(w=>w.type==='way'&&w.geometry?.length>1);
        cache.set(key,{time:Date.now(),ways}); return ways;
      } catch(e){last=e;}
    }
    throw last||new Error('Overpass no disponible');
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
  async function selectOsm(latlng) {
    if(osmBusy)return; osmBusy=true; loadingCard('geo-osm-card','Buscando camino…','Consultando geometrías cercanas. La primera consulta puede tardar unos segundos; las zonas consultadas se guardan temporalmente en caché.');
    try {
      const ways=await fetchWays(latlng.lat,latlng.lng);
      if(!ways.length){closeCard('geo-osm-card');status('OSM no devolvió geometrías viales cercanas. Esto no demuestra que el camino no exista ni que esté inventariado por el MOP.',true);return;}
      const p=[latlng.lat,latlng.lng];
      // La distancia visual en pantalla decide primero: es más intuitiva en móvil que un radio fijo en metros.
      const candidates=ways.map(way=>({way,pixels:pixelDistance(mapRef,latlng,way.geometry),meters:nearestMeters(p,way.geometry)}));
      candidates.sort((a,b)=>a.pixels-b.pixels||a.meters-b.meters);
      const best=candidates[0];
      if(best.meters>95){closeCard('geo-osm-card');status('No se encontró una geometría próxima. Acerca el mapa y toca directamente sobre la vía.',true);return;}
      const way=best.way,t=way.tags||{},length=lengthMeters(way.geometry);
      osmHighlight=L.polyline(way.geometry.map(n=>[n.lat,n.lon]),{color:'#0d9488',weight:7,opacity:.96,lineCap:'round'}).addTo(mapRef);
      const rows=[
        ['Nombre del camino',t.name||t.ref||'Sin nombre en OpenStreetMap'],
        ['Clasificación vial',highwayNames[t.highway]||('Otro tipo vial de OSM: '+(t.highway||'No informado'))],
        ['Etiqueta highway original',t.highway||'No informada'],
        ['Superficie',t.surface?(surfaces[t.surface]||('Otra superficie: '+t.surface)):'No informada en OSM'],
        ['Acceso',t.access?(accesses[t.access]||t.access):'No informado en OSM'],
        ['Referencia',t.ref||'No informada'],
        ['Longitud de esta geometría',fmtM(length)],
        ['Distancia desde el punto consultado',fmtM(best.meters)],
        ['Identificador OSM','way/'+way.id]
      ];
      makeCard('geo-osm-card','REFERENCIA CARTOGRÁFICA · OPENSTREETMAP',t.name||t.ref||'Camino sin nombre',rows,
        'La longitud es la suma geodésica de los segmentos de esta entidad OSM. Si el camino está dividido en varias entidades, no representa necesariamente su longitud completa. No es distancia de conducción ni longitud oficial MOP.',
        '© OpenStreetMap contributors · Datos sujetos a ODbL.');
      status('Geometría OSM seleccionada. Longitud de esta entidad: '+fmtM(length)+'.');
    } catch(e) {
      console.error('[GEOTRACIA v1.3 OSM]',e); closeCard('geo-osm-card');
      status('No se pudo consultar OSM. Puede estar saturado; vuelve a intentarlo. Las consultas recientes se reutilizan temporalmente.',true);
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
    const dLat=.006,dLon=.008/Math.max(.25,Math.cos(lat*Math.PI/180));
    const params=new URLSearchParams({f:'json',where:'1=1',geometry:`${lon-dLon},${lat-dLat},${lon+dLon},${lat+dLat}`,
      geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',
      outFields:'OBJECTID,ROL,ROL_ID,ROL_LABEL,CODIGO_CAMINO,NOMBRE_CAMINO,CLASIFICACION,CARPETA,KM_I,KM_F,KM_TRAMO,ENROLADO,CONCESIONADO,REGION,TUICION',
      returnGeometry:'true',outSR:'4326',returnZ:'false',returnM:'false',resultRecordCount:'60'});
    const res=await fetch(MOP_ROOT+'?'+params.toString(),{signal:AbortSignal.timeout(18000)});
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
      if(!found||found.distance>350){closeCard('geo-mop-card');status('No se encontró un tramo MOP suficientemente cercano. Puede no existir cobertura oficial en este sector.',true);return;}
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
      console.error('[GEOTRACIA v1.3 MOP]',e);closeCard('geo-mop-card');
      status('No se pudo consultar la red vial MOP. Comprueba la conexión e inténtalo nuevamente.',true);
    } finally {mopBusy=false;}
  }
  function addControl(map,kind,label,title,callback) {
    const Control=L.Control.extend({options:{position:'topright'},onAdd(){
      const wrap=L.DomUtil.create('div','leaflet-bar geo-v13-control');
      const btn=L.DomUtil.create('button','geo-v13-button',wrap);btn.type='button';btn.textContent=label;btn.title=title;
      btn.setAttribute('aria-label',title);btn.setAttribute('aria-pressed','false');
      if(kind==='osm')osmButton=btn;else mopButton=btn;
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(btn,'click',()=>{callback(btn);});
      return wrap;
    }});
    new Control().addTo(map);
  }
  function setup(map) {
    if(!map||mapRef===map)return;mapRef=map;
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