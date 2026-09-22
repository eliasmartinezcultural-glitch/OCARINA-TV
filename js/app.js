const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const SETTINGS=window.OTV_SETTINGS||{readSettings:()=>({autoplay:false,volume:70,rememberVolume:true,reducedMotion:false}),saveSettings:s=>s};
let DATA=null,ytPlayer=null,playerReady=false,currentEpisode=null,progressTimer=null;

async function load(){
 if(DATA)return DATA;
 const get=async(path,fallback)=>{try{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path+' '+r.status);return await r.json()}catch(err){console.warn('OCARINA TV: no se pudo cargar',path,err);return fallback}};
 const [programas,episodios,programacion,publicidad]=await Promise.all([
  get('data/programas.json',[]),
  get('data/episodios.json',[]),
  get('data/programacion.json',[]),
  get('data/publicidad.json',[])
 ]);
 if(!programacion.length)throw new Error('La grilla 24h no está disponible.');
 return DATA={programas,episodios,programacion,publicidad};
}
function header(){
 return '<header><div class="nav"><a class="brand" href="index.html">OCARINA <span>TV</span></a><nav>'+
 '<a href="index.html">Señal</a><a href="episodio.html">Episodios</a><a href="programacion.html">Programación</a><a href="programas.html">Programas</a><a href="archivo.html">Archivo</a><a href="publicidad.html">Publicidad</a><a href="configuracion.html" aria-label="Configuración">⚙</a></nav></div></header>';
}
function foot(){return '<footer><strong>OCARINA TV</strong> · San Patricio del Chañar · Una producción de Ocarina Producciones · <a href="creditos.html">Créditos</a> · <a href="configuracion.html">Configuración</a></footer>'}
function shell(title,body){document.title=title+' · OCARINA TV';document.body.innerHTML=header()+body+foot();if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});if(SETTINGS.readSettings().reducedMotion)document.body.classList.add('reduced-motion')}
function card(e){return '<article class="card"><img class="thumb" src="'+esc(e.thumbnail)+'" alt="" loading="lazy"><div class="cardbody"><span class="tag">'+esc(e.categoria)+'</span><h3>'+esc(e.titulo)+'</h3><p>'+esc(e.descripcion)+'</p><div class="chips">'+(e.tags||[]).map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><a class="play" href="episodio.html?id='+encodeURIComponent(e.id)+'">▶ VER EPISODIO</a></div></article>'}
function scheduleIndex(list,date=new Date()){const h=date.getHours();return h%24}
function currentSlot(list){return list[scheduleIndex(list)]||list[0]}
function nextSlot(list){return list[(scheduleIndex(list)+1)%list.length]||list[0]}
function findEpisode(slot){return DATA.episodios.find(e=>e.id===slot?.episodioId)||DATA.episodios.find(e=>e.programaId===slot?.programaId)||DATA.episodios[0]||{id:'sin-contenido',titulo:'Señal Ocarina TV',descripcion:'Continuidad editorial',categoria:'Señal',videoId:''}}
function formatClock(){return new Intl.DateTimeFormat('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())}
function formatTime(sec){if(!Number.isFinite(sec))return '00:00';sec=Math.max(0,Math.floor(sec));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function ensureYT(){
 if(window.YT?.Player){initYT();return}
 if(document.getElementById('youtube-api'))return;
 const s=document.createElement('script');s.id='youtube-api';s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);
 window.onYouTubeIframeAPIReady=initYT;
}
function initYT(){
 const holder=document.getElementById('ytplayer');if(!holder||ytPlayer)return;
 const id=holder.dataset.video;
 ytPlayer=new YT.Player('ytplayer',{videoId:id,width:'100%',height:'100%',playerVars:{autoplay:0,controls:0,playsinline:1,rel:0,enablejsapi:1,origin:location.origin},events:{
  onReady:e=>{playerReady=true;const s=SETTINGS.readSettings();e.target.setVolume(Number(s.volume)||70);updatePlayerUI();if(s.autoplay){e.target.mute();e.target.playVideo()}},
  onStateChange:e=>{updatePlayerUI();if(window.navigator.mediaSession)navigator.mediaSession.playbackState=e.data===1?'playing':e.data===2?'paused':'none';if(e.data===0)markEnded()},
  onError:e=>{const el=document.getElementById('playerError');if(el)el.textContent='Este video no puede reproducirse dentro del canal (código '+e.data+'). También podés abrirlo en YouTube desde la ficha.'}
 }});
}
function buildPlayer(ep,mode='signal'){
 currentEpisode=ep;
 return '<div class="tv-player"><div class="player-frame"><div id="ytplayer" data-video="'+esc(ep.videoId)+'"></div><div class="player-overlay"><span class="channel-bug">OCARINA TV</span><span class="live-bug">● SEÑAL</span></div></div>'+
 '<div class="player-title"><div><span class="kicker">'+esc(ep.categoria)+'</span><h2 id="playerTitle">'+esc(ep.titulo)+'</h2><p id="playerDesc">'+esc(ep.descripcion)+'</p></div><span class="player-state" id="playerState">LISTO</span></div>'+
 '<div class="controls"><button id="playBtn" class="control primary">▶</button><button id="backBtn" class="control">↶ 15s</button><button id="forwardBtn" class="control">15s ↷</button><button id="muteBtn" class="control">🔊</button><label class="volume"><span>Vol</span><input id="volume" type="range" min="0" max="100" value="'+Number(SETTINGS.readSettings().volume||70)+'"></label><span id="clock" class="clock">'+formatClock()+'</span><button id="fullscreenBtn" class="control">⛶</button></div>'+
 '<div class="progress"><input id="seek" type="range" min="0" max="1000" value="0" aria-label="Progreso"><div class="time"><span id="currentTime">00:00</span><span id="duration">00:00</span></div></div>'+
 '<div id="playerError" class="player-error"></div></div>';
}
function bindPlayerControls(){
 const $=id=>document.getElementById(id);ensureYT();
 $('playBtn')?.addEventListener('click',()=>{if(!ytPlayer)return;const st=ytPlayer.getPlayerState();if(st===1)ytPlayer.pauseVideo();else ytPlayer.playVideo()});
 $('backBtn')?.addEventListener('click',()=>ytPlayer?.seekTo(Math.max(0,ytPlayer.getCurrentTime()-15),true));
 $('forwardBtn')?.addEventListener('click',()=>ytPlayer?.seekTo(ytPlayer.getCurrentTime()+15,true));
 $('muteBtn')?.addEventListener('click',()=>{if(!ytPlayer)return;if(ytPlayer.isMuted()){ytPlayer.unMute();$('muteBtn').textContent='🔊'}else{ytPlayer.mute();$('muteBtn').textContent='🔇'}});
 $('volume')?.addEventListener('input',e=>{const v=Number(e.target.value);if(ytPlayer){ytPlayer.setVolume(v);if(v>0)ytPlayer.unMute()}if(SETTINGS.readSettings().rememberVolume)SETTINGS.saveSettings({volume:v})});
 $('seek')?.addEventListener('input',e=>{if(ytPlayer&&ytPlayer.getDuration())ytPlayer.seekTo(Number(e.target.value)/1000*ytPlayer.getDuration(),true)});
 $('fullscreenBtn')?.addEventListener('click',()=>{const f=document.querySelector('.player-frame');if(f?.requestFullscreen)f.requestFullscreen()});
 clearInterval(progressTimer);progressTimer=setInterval(updatePlayerUI,500);
}
function updatePlayerUI(){
 const p=ytPlayer;if(!p)return;let st=-1;try{st=p.getPlayerState()}catch{return}
 const b=document.getElementById('playBtn'),state=document.getElementById('playerState'),seek=document.getElementById('seek'),cur=document.getElementById('currentTime'),dur=document.getElementById('duration');
 if(b)b.textContent=st===1?'❚❚':'▶';if(state)state.textContent=st===1?'AL AIRE':st===3?'CARGANDO':st===2?'PAUSADO':'LISTO';
 try{const d=p.getDuration(),c=p.getCurrentTime();if(d&&seek)seek.value=Math.round(c/d*1000);if(cur)cur.textContent=formatTime(c);if(dur)dur.textContent=formatTime(d)}catch{}
 const c=document.getElementById('clock');if(c)c.textContent=formatClock();
}
function markEnded(){const n=document.getElementById('playerState');if(n)n.textContent='FINALIZADO'}
function mediaMetadata(ep){if(!navigator.mediaSession)return;try{navigator.mediaSession.metadata=new MediaMetadata({title:ep.titulo,artist:'OCARINA TV',album:'San Patricio del Chañar',artwork:[{src:ep.thumbnail,sizes:'480x360',type:'image/jpeg'}]});navigator.mediaSession.setActionHandler('play',()=>ytPlayer?.playVideo());navigator.mediaSession.setActionHandler('pause',()=>ytPlayer?.pauseVideo());navigator.mediaSession.setActionHandler('seekbackward',()=>ytPlayer?.seekTo(Math.max(0,ytPlayer.getCurrentTime()-10),true));navigator.mediaSession.setActionHandler('seekforward',()=>ytPlayer?.seekTo(ytPlayer.getCurrentTime()+10,true))}catch{}}
function adBlock(ad){return '<a class="ad-slot" href="'+esc(ad.url||'publicidad.html')+'"><span class="ad-label">PUBLICIDAD</span><strong>'+esc(ad.titulo)+'</strong><p>'+esc(ad.texto)+'</p><b>'+esc(ad.cta||'Consultar')+' →</b></a>'}

async function renderHome(){
 const d=await load(),slot=currentSlot(d.programacion),next=nextSlot(d.programacion),ep=findEpisode(slot),nextEp=findEpisode(next);
 shell('Señal','<main><section class="tv-hero"><div><div class="screen-head"><span class="live-dot">● EN VIVO EDITORIAL</span><span id="dateClock">'+formatClock()+'</span></div>'+buildPlayer(ep)+'</div><aside class="now-panel"><div class="kicker">CANAL LOCAL</div><h1>Historias.<br>Personas.<br>Territorio.</h1><div class="onair-card"><span>AHORA · '+esc(slot.inicio)+'–'+esc(slot.fin)+'</span><strong id="nowTitle">'+esc(slot.titulo)+'</strong><small>'+esc(slot.descripcion)+'</small></div><div class="next-card"><span>SIGUE</span><strong id="nextTitle">'+esc(next.titulo)+'</strong><small>'+esc(next.inicio)+'–'+esc(next.fin)+' · '+esc(next.descripcion)+'</small><button id="nextBtn" class="btn">▶ Preparar siguiente</button></div><div class="quick-links"><a href="programacion.html">▦ Grilla 24 h</a><a href="publicidad.html">▤ Publicidad</a><a href="configuracion.html">⚙ Configuración</a></div></aside></section>'+
 '<section class="section"><div class="sectionhead"><div><div class="kicker">CONTINUIDAD</div><h2>Qué sigue en la señal</h2></div><span class="muted">Actualización automática</span></div><div class="continuity" id="continuity"></div></section>'+
 '<section class="section"><div class="sectionhead"><div><div class="kicker">ESPACIO COMERCIAL</div><h2>Publicidad</h2></div></div><div class="ads-grid">'+d.publicidad.filter(a=>a.activo).map(adBlock).join('')+'</div></section>'+
 '<section class="section"><div class="sectionhead"><div><div class="kicker">A DEMANDA</div><h2>Últimos episodios</h2></div><a class="muted" href="archivo.html">Ver archivo →</a></div><div class="grid">'+d.episodios.slice(0,4).map(card).join('')+'</div></section></main>');
 bindPlayerControls();mediaMetadata(ep);
 const nextBtn=document.getElementById('nextBtn');nextBtn?.addEventListener('click',()=>{if(nextEp&&ytPlayer){ytPlayer.loadVideoById(nextEp.videoId);currentEpisode=nextEp;mediaMetadata(nextEp);document.getElementById('playerTitle').textContent=nextEp.titulo;document.getElementById('playerDesc').textContent=nextEp.descripcion}});
 const refresh=()=>{const s=currentSlot(d.programacion),n=nextSlot(d.programacion),se=document.getElementById('dateClock');if(se)se.textContent=formatClock();const c=document.getElementById('continuity');if(c)c.innerHTML=continuity(d.programacion);const nt=document.getElementById('nowTitle');if(nt)nt.textContent=s.titulo;const nn=document.getElementById('nextTitle');if(nn)nn.textContent=n.titulo};
 refresh();setInterval(refresh,1000);
}
function continuity(list){const idx=scheduleIndex(list);return [0,1,2,3].map(offset=>{const s=list[(idx+offset)%list.length];return '<div class="cont-item '+(offset===0?'current':'')+'"><span>'+esc(offset===0?'AHORA':offset===1?'SIGUE':'DESPUÉS')+'</span><b>'+esc(s.inicio)+' · '+esc(s.titulo)+'</b><small>'+esc(s.descripcion)+'</small></div>'}).join('')}
async function renderSchedule(){
 const d=await load(),idx=scheduleIndex(d.programacion);
 shell('Programación','<main><div class="kicker">SEÑAL OCARINA TV</div><h1>Programación · 24 horas</h1><p class="muted">Grilla editorial de continuidad. La señal web usa contenido bajo demanda y requiere la interacción del usuario para iniciar reproducción con sonido cuando el navegador lo exige.</p><div class="schedule-summary"><div><span>AHORA</span><strong>'+esc(d.programacion[idx].inicio)+' · '+esc(d.programacion[idx].titulo)+'</strong></div><div><span>SIGUE</span><strong>'+esc(d.programacion[(idx+1)%24].inicio)+' · '+esc(d.programacion[(idx+1)%24].titulo)+'</strong></div></div><div class="schedule-grid">'+d.programacion.map((s,i)=>'<a class="schedule-row '+(i===idx?'now':'')+'" href="index.html"><time>'+esc(s.inicio)+'<br><small>'+esc(s.fin)+'</small></time><div><b>'+esc(s.titulo)+'</b><span>'+esc(s.descripcion)+'</span></div><em>'+(i===idx?'AHORA':i===(idx+1)%24?'SIGUE':'')+'</em></a>').join('')+'</div></main>');
}
async function renderPrograms(){
 const d=await load(),q=new URLSearchParams(location.search),id=q.get('id');
 if(id){const p=d.programas.find(x=>x.id===id),eps=d.episodios.filter(x=>x.programaId===id);shell(p?.nombre||'Programa','<main><div class="kicker">PROGRAMA</div><h1>'+esc(p?.nombre||'No encontrado')+'</h1><p class="muted">'+esc(p?.descripcion||'')+'</p><div class="grid">'+eps.map(card).join('')+'</div><p class="muted">'+eps.length+' episodios publicados.</p></main>');return}
 shell('Programas','<main><div class="kicker">OCARINA TV</div><h1>Programas</h1><p class="muted">Colecciones editoriales del canal.</p><div class="programs">'+d.programas.map(p=>'<a class="program" href="programas.html?id='+encodeURIComponent(p.id)+'"><b>'+esc(p.nombre)+'</b><span>'+esc(p.descripcion)+' · '+esc(p.categoria)+'</span></a>').join('')+'</div></main>')
}
async function renderArchive(){
 const d=await load(),q=new URLSearchParams(location.search),pid=q.get('programa');let list=pid?d.episodios.filter(e=>e.programaId===pid):d.episodios;
 shell('Archivo','<main><div class="kicker">ARCHIVO TERRITORIAL</div><h1>Archivo Ocarina</h1><input class="search" id="search" placeholder="Buscar episodio, tema, territorio o etiqueta…" autofocus><p class="muted" id="count"></p><div class="grid" id="list"></div></main>');
 const draw=()=>{const term=document.getElementById('search').value.toLowerCase().trim();const out=list.filter(e=>([e.titulo,e.descripcion,e.categoria,e.territorio,e.paraje,...(e.tags||[]),...(e.protagonistas||[])].filter(Boolean).join(' ')).toLowerCase().includes(term));document.getElementById('list').innerHTML=out.map(card).join('');document.getElementById('count').textContent=out.length+' episodios encontrados'};document.getElementById('search').oninput=draw;draw()
}
async function renderEpisode(){
 const d=await load(),id=new URLSearchParams(location.search).get('id'),e=d.episodios.find(x=>x.id===id);
 if(!e){shell('Episodio no encontrado','<main><h1>Episodio no encontrado</h1><p class="muted">La pieza solicitada no existe en el catálogo.</p><a class="btn" href="archivo.html">Volver al archivo</a></main>');return}
 const p=d.programas.find(x=>x.id===e.programaId),related=d.episodios.filter(x=>x.id!==e.id&&((x.tags||[]).some(t=>(e.tags||[]).includes(t))||x.programaId===e.programaId)).slice(0,4);
 shell(e.titulo,'<main class="detail"><div class="kicker">'+esc(p?.nombre||'OCARINA TV')+' · '+esc(e.categoria)+'</div><h1>'+esc(e.titulo)+'</h1>'+buildPlayer(e,'episode')+'<p>'+esc(e.descripcion)+'</p><div class="meta"><span>Territorio: '+esc(e.territorio||'No especificado')+'</span><span>Fecha: '+esc(e.fecha||'No cargada')+'</span><span>Duración: '+esc(e.duracion||'No cargada')+'</span></div><div class="chips">'+(e.tags||[]).map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><p class="muted">Programa: <a href="programas.html?id='+encodeURIComponent(e.programaId)+'">'+esc(p?.nombre||'Archivo Ocarina')+'</a> · Estado: '+esc(e.estado)+'</p><a class="btn" href="archivo.html">← Volver al archivo</a><section class="section"><div class="kicker">CONTENIDO RELACIONADO</div><h2>También puede interesarte</h2><div class="grid">'+related.map(card).join('')+'</div></section></main>');
 bindPlayerControls();mediaMetadata(e)
}
async function renderConfig(){
 const s=SETTINGS.readSettings();
 shell('Configuración','<main class="narrow"><div class="kicker">CENTRO DEL CANAL</div><h1>Configuración</h1><p class="muted">Preferencias guardadas en este dispositivo. No se envían a Ocarina.</p><div class="settings-card"><label class="setting"><span><b>Reproducción al entrar</b><small>Intentar iniciar la señal automáticamente. El navegador puede bloquear el sonido; el canal respeta esa política.</small></span><input id="autoplay" type="checkbox" '+(s.autoplay?'checked':'')+'></label><label class="setting"><span><b>Volumen recordado</b><small>Conservar el volumen elegido para próximas visitas.</small></span><input id="remember" type="checkbox" '+(s.rememberVolume?'checked':'')+'></label><label class="setting"><span><b>Animaciones reducidas</b><small>Reduce transiciones y movimientos de la interfaz.</small></span><input id="motion" type="checkbox" '+(s.reducedMotion?'checked':'')+'></label><label class="setting"><span><b>Volumen inicial</b><small><output id="volOut">'+s.volume+'</output>%</small></span><input id="setVol" type="range" min="0" max="100" value="'+s.volume+'"></label><div class="settings-actions"><button id="saveSettings" class="btn">Guardar configuración</button><button id="resetSettings" class="control">Restablecer</button></div></div></main>');
 document.getElementById('setVol').oninput=e=>document.getElementById('volOut').textContent=e.target.value;
 document.getElementById('saveSettings').onclick=()=>{SETTINGS.saveSettings({autoplay:document.getElementById('autoplay').checked,rememberVolume:document.getElementById('remember').checked,reducedMotion:document.getElementById('motion').checked,volume:Number(document.getElementById('setVol').value)});location.reload()};
 document.getElementById('resetSettings').onclick=()=>{localStorage.removeItem('ocarinaTVSettings');location.reload()}
}
async function renderCredits(){shell('Créditos','<main class="narrow"><div class="kicker">IDENTIDAD DEL CANAL</div><h1>Créditos</h1><div class="credits"><section><span class="kicker">PRODUCCIÓN</span><h2>OCARINA PRODUCCIONES</h2><p>Historias, personas y territorio.</p></section><section><span class="kicker">DIRECCIÓN EDITORIAL</span><h2>Elías Martínez</h2><p>Concepto, curaduría y desarrollo del canal.</p></section><section><span class="kicker">TECNOLOGÍA</span><p>Arquitectura estática sobre GitHub Pages, datos JSON y reproductor web integrado.</p></section><section><span class="kicker">CONTENIDO</span><p>El archivo distingue producción propia, referencias externas y estados editoriales. Encontrar un video no implica autorización para republicarlo.</p></section></div></main>')}
async function renderAds(){
 const d=await load();shell('Publicidad','<main class="narrow"><div class="kicker">ESPACIO COMERCIAL</div><h1>Publicidad en OCARINA TV</h1><p class="muted">Espacios preparados para comercios, emprendimientos, instituciones y propuestas del territorio.</p><div class="ads-page">'+d.publicidad.filter(a=>a.activo).map(adBlock).join('')+'</div><div class="notice"><strong>Inventario editable.</strong> Los espacios se administran desde <code>data/publicidad.json</code>. No se publican anunciantes ficticios.</div></main>')}
const page=document.body.dataset.page;
(async()=>{try{if(page==='home')await renderHome();else if(page==='programs')await renderPrograms();else if(page==='episode')await renderEpisode();else if(page==='schedule')await renderSchedule();else if(page==='archive')await renderArchive();else if(page==='config')await renderConfig();else if(page==='credits')await renderCredits();else if(page==='ads')await renderAds()}catch(err){console.error(err);document.getElementById('app').innerHTML='<main><h1>No se pudo cargar el canal</h1><p class="muted">Revisá la conexión y recargá.</p></main>'}})();
window.OTV={load,renderPrograms,renderSchedule,renderArchive,renderEpisode,renderConfig,renderCredits,renderAds};
