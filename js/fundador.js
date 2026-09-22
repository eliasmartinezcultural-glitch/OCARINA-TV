const KEY='ocarinaFounderPinHash',STATE='ocarinaFounderState',FOUNDER_SCHEMA='final-1.1';
let DATA=[],PROGRAMS=[],SCHEDULE=[],state={retired:[],incomes:[],expenses:[],notes:'',tasks:[],decisions:[],targets:[]};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>'$ '+Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2});
const dateText=d=>new Date(d).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
async function hash(v){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function loadState(){try{const saved=JSON.parse(localStorage.getItem(STATE)||'{}');state={...state,...saved};for(const k of ['retired','incomes','expenses','tasks','decisions','targets'])if(!Array.isArray(state[k]))state[k]=[]}catch{}}
function saveState(){localStorage.setItem(STATE,JSON.stringify(state))}
async function boot(){
 loadState();const has=!!localStorage.getItem(KEY);
 $('setupBox').classList.toggle('hidden',has);$('loginBox').classList.toggle('hidden',!has);
 $('setupBtn').onclick=async()=>{const p=$('setupPin').value.trim();if(p.length<6)return alert('Usá al menos 6 caracteres.');localStorage.setItem(KEY,await hash(p));$('setupPin').value='';$('setupBox').classList.add('hidden');$('loginBox').classList.remove('hidden');$('loginPin').focus()};
 $('loginBtn').onclick=async()=>{if(await hash($('loginPin').value)===localStorage.getItem(KEY))openConsole();else $('loginMsg').textContent='Clave incorrecta.'};
 $('loginPin').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click()});
}
async function getJSON(path){
 const r=await fetch(path+'?founder='+Date.now(),{cache:'no-store'});
 if(!r.ok)throw new Error(path+' '+r.status);
 return r.json();
}
async function syncSignalData(){
 const results=await Promise.allSettled([getJSON('data/episodios.json'),getJSON('data/programas.json'),getJSON('data/programacion.json')]);
 DATA=results[0].status==='fulfilled'?results[0].value:[];
 PROGRAMS=results[1].status==='fulfilled'?results[1].value:[];
 SCHEDULE=results[2].status==='fulfilled'?results[2].value:[];
 renderSignal();
}
function activeData(){return DATA.filter(x=>!state.retired.includes(x.id))}
function totals(){return{income:state.incomes.reduce((s,x)=>s+Number(x.amount||0),0),expense:state.expenses.reduce((s,x)=>s+Number(x.amount||0),0)}}
function renderSignal(){
 const active=activeData(),ids=active.map(x=>x.videoId).filter(Boolean),unique=new Set(ids).size,dupes=ids.length-unique;
 const checks=[
  ['Catálogo','episodios.json',DATA.length>0],
  ['Programación',SCHEDULE.length+' bloques',SCHEDULE.length>0],
  ['Programas',PROGRAMS.length+' programas',PROGRAMS.length>0],
  ['Videos reproducibles',active.filter(x=>x.videoId).length+'/'+active.length,active.length>0&&active.every(x=>x.videoId)],
  ['IDs únicos',dupes?('Revisar '+dupes+' duplicados'):'OK',dupes===0]
 ];
 $('signalBridge').innerHTML='<div class="bridge-grid">'+checks.map(x=>'<div class="bridge-card"><span class="'+(x[2]?'ok':'warn')+'">'+(x[2]?'● CONECTADO':'● REVISAR')+'</span><b>'+esc(x[0])+'</b><small>'+esc(x[1])+'</small></div>').join('')+'</div><div class="bridge-summary"><b>'+active.filter(x=>String(x.estado||'').toUpperCase()==='PUBLICADO').length+' publicados</b><span>'+active.length+' activos · '+DATA.length+' registros · '+SCHEDULE.length+' bloques · '+PROGRAMS.length+' programas</span><small>Sincronizado '+new Date().toLocaleString('es-AR')+' · esquema '+FOUNDER_SCHEMA+'</small></div><p class="bridge-note">La Central lee las mismas fuentes JSON que alimentan la señal pública. Las marcas de retiro, finanzas, tareas y notas son locales a este navegador. No se guardan credenciales de GitHub aquí.</p>';
}
function render(){
 const a=activeData(),cats=new Set(a.map(x=>x.categoria||'Otros')),horizontal=a.filter(x=>String(x.formato||'').includes('HORIZONTAL')).length,t=totals();
 $('stats').innerHTML=[['Videos activos',a.length],['Categorías',cats.size],['Horizontales',horizontal],['Balance',money(t.income-t.expense)]].map(x=>'<div class="stat"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('');
 renderExecutive(a);renderFinance();renderCatalog();renderHealth(a,horizontal);renderBreakdown(a);renderTasks();renderTargets();renderDecisions();renderWeekly(a);$('notes').value=state.notes||'';
}
function renderExecutive(a){
 const t=totals(),open=state.tasks.filter(x=>!x.done).length;
 $('executive').innerHTML=[['Contenido activo',a.length],['Ingresos',money(t.income)],['Egresos',money(t.expense)],['Tareas abiertas',open],['Metas',state.targets.length],['Decisiones',state.decisions.length]].map(x=>'<div class="exec"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('');
}
function renderFinance(){
 const t=totals();
 $('moneyline').innerHTML=[['Ingresos',money(t.income)],['Egresos',money(t.expense)],['Balance',money(t.income-t.expense)]].map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
 $('incomeTotal').textContent='Movimientos: '+state.incomes.length+' ingresos · '+state.expenses.length+' egresos';
 $('incomeList').innerHTML=state.incomes.slice().reverse().map(x=>'<div class="income-row"><span>'+esc(x.desc)+' <small>'+dateText(x.date)+'</small></span><b>'+money(x.amount)+'</b></div>').join('')||'<p class="muted">Todavía no hay ingresos cargados.</p>';
 $('expenseList').innerHTML=state.expenses.slice().reverse().map(x=>'<div class="income-row expense-row"><span>'+esc(x.desc)+' <small>'+dateText(x.date)+'</small></span><b>'+money(x.amount)+'</b></div>').join('')||'<p class="muted">Todavía no hay egresos cargados.</p>';
}
function renderHealth(a,f){
 const open=state.tasks.filter(x=>!x.done).length,t=totals();
 const rows=[
  ['Catálogo activo',Math.min(100,Math.round(a.length/40*100)),a.length+' videos'],
  ['Formato horizontal',a.length?Math.round(f/a.length*100):0,(a.length?Math.round(f/a.length*100):0)+'%'],
  ['Control económico',t.income||t.expense?100:0,(state.incomes.length+state.expenses.length)+' movimientos'],
  ['Agenda',open?100:25,open+' tareas abiertas']
 ];
 $('health').innerHTML=rows.map(x=>'<div class="health-row"><span>'+x[0]+'</span><div class="bar"><i style="width:'+x[1]+'%"></i></div><b>'+x[2]+'</b></div>').join('');
}
function renderBreakdown(a){
 const m={};a.forEach(x=>m[x.categoria||'Otros']=(m[x.categoria||'Otros']||0)+1);
 $('breakdown').innerHTML=Object.entries(m).sort((a,b)=>b[1]-a[1]).map(x=>'<div class="break"><b>'+x[1]+'</b><span>'+esc(x[0])+'</span></div>').join('')||'<p class="muted">Sin datos.</p>';
}
function renderCatalog(){
 const q=($('search').value||'').toLowerCase().trim();
 const list=DATA.filter(x=>(x.titulo+' '+(x.categoria||'')+' '+(x.territorio||'')).toLowerCase().includes(q));
 $('catalog').innerHTML=list.map(e=>{const ret=state.retired.includes(e.id);return '<div class="item '+(ret?'retired':'')+'"><div><h3>'+esc(e.titulo)+'</h3><p>'+esc(e.categoria||'')+' · '+esc(e.formato||'')+' · '+esc(e.estado||'')+'</p></div><button data-id="'+esc(e.id)+'">'+(ret?'Restaurar':'Retirar')+'</button></div>'}).join('')||'<p class="muted">Sin resultados.</p>';
}
function renderTasks(){$('tasks').innerHTML=state.tasks.map((x,i)=>'<div class="task '+(x.done?'done':'')+'"><span>'+esc(x.text)+' · '+esc(x.priority)+'</span><button data-task="'+i+'">'+(x.done?'Reabrir':'Hecho')+'</button></div>').join('')||'<p class="muted">No hay tareas abiertas.</p>'}
function renderTargets(){
 const inc=totals().income;
 $('targets').innerHTML=state.targets.map((x,i)=>{const pct=x.value?Math.min(100,Math.round(inc/x.value*100)):0;return '<div class="target"><div><b>'+esc(x.name)+'</b><small>'+money(inc)+' / '+money(x.value)+'</small><div class="bar"><i style="width:'+pct+'%"></i></div></div><strong>'+pct+'%</strong><button data-target="'+i+'">Eliminar</button></div>'}).join('')||'<p class="muted">No hay metas cargadas.</p>';
}
function renderDecisions(){$('decisions').innerHTML=state.decisions.slice().reverse().map(x=>'<div class="decision">'+esc(x.text)+'<time>'+dateText(x.date)+'</time></div>').join('')||'<p class="muted">La bitácora todavía está vacía.</p>'}
function renderWeekly(a){
 const t=totals(),open=state.tasks.filter(x=>!x.done),ret=state.retired.length;
 const alerts=[];
 if(!a.length)alerts.push('El catálogo no pudo leerse o quedó vacío.');
 if(ret)alerts.push(ret+' pieza(s) están retiradas localmente.');
 if(!open.length)alerts.push('No hay una próxima acción abierta.');
 if(t.income-t.expense<0)alerts.push('El balance registrado es negativo.');
 const next=open.slice().sort((x,y)=>({Alta:0,Media:1,Baja:2}[x.priority]-({Alta:0,Media:1,Baja:2}[y.priority])))[0];
 $('weeklyReview').innerHTML='<div class="weekly">'+[['Balance',money(t.income-t.expense)],['Activos',a.length],['Retirados',ret],['Tareas abiertas',open.length]].map(x=>'<div class="weekly-card"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')+'</div><div class="weekly-alert"><strong>ATENCIÓN</strong><div>'+ (alerts.length?alerts.map(esc).join(' · '):'No hay alertas operativas registradas.')+'</div></div><div class="weekly-next"><strong>PRÓXIMO MOVIMIENTO</strong><div>'+(next?esc(next.text):'Definí una tarea concreta para la próxima revisión.')+'</div></div>';
}
function bind(){
 $('lockBtn').onclick=()=>location.reload();
 $('syncSignal').onclick=async()=>{const b=$('syncSignal');b.disabled=true;b.textContent='Actualizando…';await syncSignalData();render();b.disabled=false;b.textContent='Actualizar señal'};
 $('search').oninput=renderCatalog;
 $('incomeForm').onsubmit=e=>{e.preventDefault();const amount=Number($('incomeAmount').value);if(!(amount>0))return alert('Ingresá un importe mayor que cero.');state.incomes.push({desc:$('incomeDesc').value.trim(),amount,date:new Date().toISOString()});saveState();e.target.reset();render()};
 $('expenseForm').onsubmit=e=>{e.preventDefault();const amount=Number($('expenseAmount').value);if(!(amount>0))return alert('Ingresá un importe mayor que cero.');state.expenses.push({desc:$('expenseDesc').value.trim(),amount,date:new Date().toISOString()});saveState();e.target.reset();render()};
 $('targetForm').onsubmit=e=>{e.preventDefault();const value=Number($('targetValue').value);if(!(value>0))return alert('Ingresá una meta mayor que cero.');state.targets.push({name:$('targetName').value.trim(),value,date:new Date().toISOString()});saveState();e.target.reset();render()};
 $('taskForm').onsubmit=e=>{e.preventDefault();state.tasks.push({text:$('taskText').value.trim(),priority:$('taskPriority').value,done:false,date:new Date().toISOString()});saveState();e.target.reset();render()};
 $('decisionForm').onsubmit=e=>{e.preventDefault();state.decisions.push({text:$('decisionText').value.trim(),date:new Date().toISOString()});saveState();e.target.reset();render()};
 $('saveNotes').onclick=()=>{state.notes=$('notes').value;saveState();alert('Notas guardadas localmente.')};
 $('copyBtn').onclick=async()=>{await navigator.clipboard.writeText(state.retired.join('\n'));alert('Lista de retiros copiada.')};
 $('copyReportBtn').onclick=async()=>{const t=totals(),a=activeData();const report=['OCARINA TV · INFORME DEL FUNDADOR','Fecha: '+new Date().toLocaleString('es-AR'),'Videos activos: '+a.length,'Retirados: '+state.retired.length,'Ingresos: '+money(t.income),'Egresos: '+money(t.expense),'Balance: '+money(t.income-t.expense),'Tareas abiertas: '+state.tasks.filter(x=>!x.done).length,'Decisiones: '+state.decisions.length,'Notas: '+(state.notes||'Sin notas')].join('\n');await navigator.clipboard.writeText(report);alert('Informe copiado.')};
 $('copyWeeklyBtn').onclick=async()=>{const open=state.tasks.filter(x=>!x.done);const t=totals();const report=['REVISIÓN SEMANAL · OCARINA TV','Fecha: '+new Date().toLocaleDateString('es-AR'),'Balance: '+money(t.income-t.expense),'Videos activos: '+activeData().length,'Tareas abiertas: '+open.length,'Próxima acción: '+(open[0]?.text||'Definir próxima acción')].join('\n');await navigator.clipboard.writeText(report);alert('Revisión copiada.')};
 $('exportBtn').onclick=()=>{const b=new Blob([JSON.stringify({schema:FOUNDER_SCHEMA,exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='ocarina-fundador-estado.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
 $('clearBtn').onclick=()=>{if(confirm('¿Vaciar todos los registros locales de esta central? El catálogo público no se modifica.')){state={retired:[],incomes:[],expenses:[],notes:'',tasks:[],decisions:[],targets:[]};saveState();render()}};
 document.addEventListener('click',e=>{const id=e.target.dataset.id;if(id){state.retired.includes(id)?state.retired=state.retired.filter(x=>x!==id):state.retired.push(id);saveState();render();return}const ti=e.target.dataset.task;if(ti!==undefined){state.tasks[ti].done=!state.tasks[ti].done;saveState();render();return}const tg=e.target.dataset.target;if(tg!==undefined){state.targets.splice(Number(tg),1);saveState();render()}});
}
async function openConsole(){$('gate').classList.add('hidden');$('console').classList.remove('hidden');await syncSignalData();render();bind()}
boot();