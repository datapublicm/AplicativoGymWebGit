'use strict';
/* Dashboard Gymlytics: todos los valores nacen del historial completo de Supabase.
   No se infiere calidad técnica, RPE, calorías ni fuerza a partir de series incomparables. */
(function(){
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,max=1)=>Number(v).toLocaleString('es-PE',{maximumFractionDigits:max});
 const clean=v=>String(v??'').trim();
 const unique=a=>[...new Set(a.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true}));
 const kg=r=>Number(r.weight)*(r.unit==='lb'?0.45359237:1);
 const seriesNo=r=>{const m=clean(r.series).match(/(\d+)/);return m?Number(m[1]):null};
 const dateStr=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const addDays=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return dateStr(d)};
 const days=a=>new Set(a.map(x=>x.date)).size;
 const value=(id)=>$(id)?.value||'';
 const techOn=()=>!!$('dashTechnique')?.checked;
 const matchSide=r=>{const s=clean(r.subdivision);return s&&s!=='-'?s:'Sin subdivisiones'};
 const grip=r=>[clean(r.grip),clean(r.accessory)].filter(x=>x&&x!=='No especificado'&&x!=='-').join(' / ')||'Sin implemento';
 const valid=r=>r&&/^\d{4}-\d\d-\d\d$/.test(r.date||'')&&clean(r.exercise)&&Number.isFinite(Number(r.weight))&&Number.isFinite(Number(r.reps))&&Number(r.weight)>=0&&Number(r.reps)>=0;
 const comparable=(a,b,checkTech=true)=>clean(a.exercise)===clean(b.exercise)&&clean(a.gym)===clean(b.gym)&&
  clean(a.sede)===clean(b.sede)&&clean(a.equipment)===clean(b.equipment)&&grip(a)===grip(b)&&
  matchSide(a)===matchSide(b)&&seriesNo(a)!==null&&seriesNo(a)===seriesNo(b)&&
  (!checkTech||clean(a.technique)===clean(b.technique));
 function classify(a,b){
  if(!comparable(a,b,true))return 'no-comparable';
  const dw=kg(a)-kg(b),dr=Number(a.reps)-Number(b.reps);
  if(Math.abs(dw)<0.001&&dr===0)return 'mantiene';
  if(dw>=-0.001&&dr>=0&&(dw>0.001||dr>0))return 'mejora';
  if(dw<=0.001&&dr<=0&&(dw<-.001||dr<0))return 'retrocede';
  return 'mixto';
 }
 function pickPairs(records){
  const sorted=[...records].sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''));
  const dates=unique(sorted.map(r=>r.date)).reverse();
  if(dates.length<2)return {latest:dates[0]||'',previous:'',pairs:[],newRows:sorted.filter(r=>r.date===dates[0])};
  const [latest,previous]=dates;
  const curr=sorted.filter(r=>r.date===latest);
  const prev=sorted.filter(r=>r.date===previous);
  const used=new Set(),pairs=[];
  for(const row of curr){
   const idx=prev.findIndex((p,i)=>!used.has(i)&&comparable(row,p,false));
   if(idx>=0){used.add(idx);pairs.push({current:row,previous:prev[idx],state:classify(row,prev[idx])});}
   else pairs.push({current:row,previous:null,state:'no-comparable'});
  }
  return {latest,previous,pairs,newRows:curr};
 }
 function exerciseStatus(rows){
  const result=pickPairs(rows),matched=result.pairs.filter(p=>p.state!=='no-comparable');
  if(!matched.length)return {state:'sin datos comparables',message:result.previous?'No hay series equivalentes entre las dos últimas sesiones':'Solo una fecha de entrenamiento',...result};
  const better=matched.filter(p=>p.state==='mejora').length,decline=matched.filter(p=>p.state==='retrocede').length;
  if(better&&!decline)return {state:'mejora',message:better+' serie(s) comparable(s) con mejora',...result};
  if(decline&&!better)return {state:'por revisar',message:decline+' serie(s) comparable(s) con menor rendimiento',...result};
  if(better&&decline)return {state:'por revisar',message:'Resultados mixtos entre series',...result};
  if(matched.some(p=>p.state==='mixto'))return {state:'sin datos comparables',message:'Se intercambió peso por repeticiones',...result};
  return {state:'mantiene',message:'Sin cambios concluyentes en las series equivalentes',...result};
 }
 let all=[],tab='resumen';
 const latestDate=()=>dateStr(new Date());
 function select(id,names,placeholder,keep=true){
  const el=$(id);if(!el)return;
  const old=el.value;
  el.replaceChildren(new Option(placeholder,''));
  names.forEach(n=>el.add(new Option(n,n)));
  el.value=keep&&names.includes(old)?old:'';
 }
 function filters(){
  const now=latestDate(),range=value('dashRange');
  const from=range==='custom'?value('dashFrom'):range==='all'?'':addDays(now,-(Number(range)||90)+1);
  const to=range==='custom'?value('dashTo'):now;
  return {gym:value('dashGym'),sede:value('dashSede'),from,to,technique:techOn()};
 }
 function filteredRows(){
  const f=filters();
  if(f.from&&f.to&&f.from>f.to)return [];
  return all.filter(r=>(!f.gym||r.gym===f.gym)&&(!f.sede||r.sede===f.sede)&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to));
 }
 const group=(arr,key)=>{const out=new Map();for(const r of arr){const k=key(r);if(!out.has(k))out.set(k,[]);out.get(k).push(r);}return out};
 function statusList(rows){
  const list=[...group(rows,r=>r.exercise).entries()].map(([name,rs])=>({name, ...exerciseStatus(rs),frequency:days(rs)}));
  return list.sort((a,b)=>b.frequency-a.frequency||a.name.localeCompare(b.name,'es'));
 }
 const empty=txt=>'<p class="dash-empty">'+esc(txt)+'</p>';
 function labelRow(left,right,kind=''){
  return '<div class="dash-list-row '+kind+'"><span>'+esc(left)+'</span><strong>'+esc(right)+'</strong></div>';
 }
 function barChart(entries,options={}){
  if(!entries.length)return empty('No hay datos en el período.');
  const max=Math.max(1,...entries.map(x=>Number(x.value)||0));
  const width=660,height=240,padL=52,padR=15,bottom=195,top=22;
  const plot=width-padL-padR,step=plot/entries.length,bw=Math.min(55,step*.62);
  const lines=[0,.25,.5,.75,1].map(t=>{const y=bottom-t*(bottom-top);return '<line x1="'+padL+'" y1="'+y+'" x2="'+(width-padR)+'" y2="'+y+'" stroke="#214a67" stroke-dasharray="3 6"/><text x="'+(padL-7)+'" y="'+(y+4)+'" fill="#93b7d0" font-size="12" text-anchor="end">'+esc(fmt(max*t,0))+'</text>';}).join('');
  const bars=entries.map((p,i)=>{
   const x=padL+(i+.5)*step-bw/2,y=bottom-(Number(p.value)||0)/max*(bottom-top);
   return '<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw+'" height="'+(bottom-y).toFixed(1)+'" rx="6" fill="'+(p.color||'#1acbf4')+'"><title>'+esc(p.label+': '+fmt(p.value))+'</title></rect><text x="'+(x+bw/2)+'" y="'+Math.max(12,y-6)+'" text-anchor="middle" font-size="12" font-weight="700" fill="#bff5ff">'+esc(fmt(p.value))+'</text><text x="'+(x+bw/2)+'" y="217" font-size="11" text-anchor="middle" fill="#b6d7ed">'+esc(String(p.label).slice(0,12))+'</text>';
  }).join('');
  return '<svg class="dash-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(options.title||'Gráfico de barras de datos históricos')+'">'+lines+bars+'</svg>';
 }
 function trendChart(points,name,unit){
  if(!points.length)return empty('No existen sesiones con valores para este gráfico.');
  const width=660,height=242,L=56,R=640,top=25,bottom=190,max=Math.max(1,...points.map(p=>Number(p.value)||0));
  const xy=points.map((p,i)=>({x:points.length===1?(L+R)/2:L+i*(R-L)/(points.length-1),y:bottom-p.value/max*(bottom-top),...p}));
  const grid=[0,.25,.5,.75,1].map(k=>{const y=bottom-k*(bottom-top);return '<line x1="'+L+'" x2="'+R+'" y1="'+y+'" y2="'+y+'" stroke="#244b69" stroke-dasharray="4 6"/><text x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end" font-size="12" fill="#93b7d0">'+esc(fmt(max*k,0))+'</text>'}).join('');
  const dots=xy.map((p,i)=>'<g><circle cx="'+p.x+'" cy="'+p.y+'" r="5.5" stroke="#04243f" stroke-width="2.5" fill="#39f7d4"><title>'+esc(p.date+': '+fmt(p.value)+' '+unit+' · '+(p.technique||'Sin técnica'))+'</title></circle><text x="'+p.x+'" y="222" fill="#a5c4db" font-size="11" text-anchor="middle">'+esc(p.date.slice(8)+'/'+p.date.slice(5,7))+'</text></g>').join('');
  return '<svg class="dash-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(name)+'">'+grid+'<polyline fill="none" points="'+xy.map(p=>p.x+','+p.y).join(' ')+'" stroke="#18d7f6" stroke-width="3" stroke-linejoin="round"/>'+dots+'</svg>';
 }
 function countWeeks(rows){
  const today=latestDate(),entries=[];
  for(let i=5;i>=0;i--){
   const to=addDays(today,-7*i),from=addDays(to,-6);
   const n=new Set(rows.filter(r=>r.date>=from&&r.date<=to).map(r=>r.date)).size;
   entries.push({label:i===0?'Actual':'-'+i+' sem.',value:n});
  }
  return entries;
 }
 function drawCalendar(rows){
  const dates=new Set(rows.map(r=>r.date)),today=latestDate(),cells=[];
  for(let i=27;i>=0;i--){const d=addDays(today,-i);cells.push('<span class="dash-day '+(dates.has(d)?'trained':'')+'" title="'+esc(d+(dates.has(d)?' · Entrenamiento':' · Sin registro'))+'"></span>');}
  return '<div class="dash-heatmap">'+cells.join('')+'</div><p class="dash-micro">28 días recientes · Los cuadros iluminados tienen registros.</p>';
 }
 function renderSummary(rows){
  const list=statusList(rows),trained=days(rows),weekly=countWeeks(rows);
  const improved=list.filter(x=>x.state==='mejora'),review=list.filter(x=>x.state==='por revisar');
  const avg=weekly.reduce((v,x)=>v+x.value,0)/weekly.length;
  const cards=[
   ['Días entrenados',trained,'Fechas diferentes en el período','calendar-days'],
   ['Frecuencia reciente',fmt(avg)+' / sem.','Promedio de 6 semanas','activity'],
   ['Ejercicios con mejora',improved.length,'Comparaciones equivalentes','trending-up'],
   ['Por revisar',review.length,'Sin confundir técnica distinta con retroceso','alert-triangle']
  ];
  $('dashCards').innerHTML=cards.map(([label,n,note,icon])=>'<div class="dash-kpi"><small>'+esc(label)+'</small><strong>'+esc(n)+'</strong><span>'+esc(note)+'</span></div>').join('');
  $('dashWeekly').innerHTML=barChart(weekly,{title:'Frecuencia semanal en días entrenados'});
  $('dashCalendar').innerHTML=drawCalendar(rows);
  $('dashTop').innerHTML=improved.length?improved.slice(0,7).map(x=>labelRow(x.name,x.message,'positive')).join(''):empty('No hay mejoras confirmadas con dos sesiones comparables.');
  $('dashReview').innerHTML=review.length?review.slice(0,7).map(x=>labelRow(x.name,x.message,'caution')).join(''):empty('Ningún ejercicio presenta un retroceso comparable confirmado.');
  const zones=[...group(rows,r=>clean(r.zone)||'Sin anotación').entries()].map(([name,rs])=>({name,n:days(rs)})).sort((a,b)=>b.n-a.n).slice(0,8);
  $('dashZones').innerHTML=zones.length?zones.map(x=>'<div class="dash-hbar"><span>'+esc(x.name)+'</span><div><i style="width:'+Math.max(2,Math.round(x.n/Math.max(...zones.map(z=>z.n),1)*100))+'%"></i></div><strong>'+x.n+' días</strong></div>').join(''):empty('No hay anotaciones en el período.');
 }
 function updateDetailOptions(rows){
  select('dashExercise',unique(rows.map(r=>r.exercise)),'Selecciona ejercicio');
  const exercise=value('dashExercise')||$('dashExercise')?.options[1]?.value||'';
  if(exercise&&!value('dashExercise'))$('dashExercise').value=exercise;
  const subset=rows.filter(r=>r.exercise===exercise);
  select('dashEquipment',unique(subset.map(r=>clean(r.equipment))),'Todos los instrumentos');
  const matchEquip=subset.filter(r=>!value('dashEquipment')||r.equipment===value('dashEquipment'));
  select('dashAccessory',unique(matchEquip.map(grip)),'Todos los agarres / implementos');
  const matchGrip=matchEquip.filter(r=>!value('dashAccessory')||grip(r)===value('dashAccessory'));
  select('dashSubdivision',unique(matchGrip.map(matchSide)),'Todas las subdivisiones');
  const matchSub=matchGrip.filter(r=>!value('dashSubdivision')||matchSide(r)===value('dashSubdivision'));
  const serials=unique(matchSub.map(r=>seriesNo(r)).filter(x=>x!==null).map(String));
  select('dashSeries',serials,'Mayor valor de cada sesión');
 }
 function detailRows(rows){
  return rows.filter(r=>r.exercise===value('dashExercise')&&
   (!value('dashEquipment')||r.equipment===value('dashEquipment'))&&
   (!value('dashAccessory')||grip(r)===value('dashAccessory'))&&
   (!value('dashSubdivision')||matchSide(r)===value('dashSubdivision')));
 }
 function renderProgress(rows){
  updateDetailOptions(rows);
  const rs=detailRows(rows);
  if(!rs.length){
   $('dashProgressCards').innerHTML='';$('dashTrend').innerHTML=empty('Selecciona un ejercicio con registros.');
   $('dashSeriesChart').innerHTML='';$('dashSeriesTable').innerHTML='';$('dashTechniques').innerHTML='';
   return;
  }
  const serial=value('dashSeries'),metric=value('dashMetric')||'weight',one=serial?rs.filter(r=>seriesNo(r)===Number(serial)):rs;
  const ordered=group(one,r=>r.date);
  const latest=[...ordered.keys()].sort().at(-1)||'';
  const latestRows=ordered.get(latest)||[];
  const refTech=latestRows.slice().sort((a,b)=>kg(b)-kg(a))[0]?.technique||'';
  const points=[...ordered.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([date,series])=>{
   const eligible=techOn()?series.filter(r=>r.technique===refTech):series;
   if(!eligible.length)return null;
   const top=eligible.slice().sort((a,b)=>metric==='weight'?kg(b)-kg(a):Number(b.reps)-Number(a.reps))[0];
   return {date,technique:top.technique,value:metric==='weight'?kg(top):Number(top.reps)};
  }).filter(Boolean);
  const maxKg=Math.max(...rs.map(kg),0),maxReps=Math.max(...rs.map(r=>Number(r.reps)),0);
  const status=exerciseStatus(rs);
  $('dashProgressCards').innerHTML=[
   ['Última sesión',latest||'—','Fecha con registros'],
   ['Peso mayor registrado',fmt(maxKg)+' kg','No equivale por sí solo a una mejora'],
   ['Máximas repeticiones',fmt(maxReps,0),'En una serie, no suma de series'],
   ['Comparación reciente',status.state,status.message]
  ].map(x=>'<div class="dash-kpi"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong><span>'+esc(x[2])+'</span></div>').join('');
  $('dashTrendNote').textContent=(serial?'Serie '+serial:'Mejor valor individual por sesión')+' · '+(metric==='weight'?'Peso en kg':'Repeticiones')+(techOn()?' · Misma técnica que la serie reciente':' · Varias técnicas: interpretar con cautela');
  $('dashTrend').innerHTML=trendChart(points,'Evolución de '+value('dashExercise'),metric==='weight'?'kg':'repeticiones');
  const paired=pickPairs(rs);
  const current=paired.pairs.filter(p=>!serial||seriesNo(p.current)===Number(serial));
  if(!paired.previous||!current.length){
   $('dashSeriesChart').innerHTML=empty('Se requieren registros de al menos dos fechas diferentes.');
   $('dashSeriesTable').innerHTML=''; 
  }else{
   const unit=metric==='weight'?'kg':'rep.',number=r=>metric==='weight'?kg(r):Number(r.reps);
   const labels=current.map(p=>({title:'Serie '+(seriesNo(p.current)??'?')+' · '+matchSide(p.current),old:p.previous?number(p.previous):0,new:number(p.current),p}));
   const max=Math.max(1,...labels.flatMap(x=>[x.old,x.new]));
   $('dashSeriesChart').innerHTML='<div class="dash-compare-legend"><span>■ '+esc(paired.previous)+'</span><span>■ '+esc(paired.latest)+'</span></div>'+
    labels.map(x=>'<div class="dash-comp-row"><strong>'+esc(x.title)+'</strong><div class="dash-comp-bars"><i style="width:'+Math.round(x.old/max*100)+'%"></i><b style="width:'+Math.round(x.new/max*100)+'%"></b></div><span>'+esc(fmt(x.old)+' / '+fmt(x.new)+' '+unit)+'</span></div>').join('');
   $('dashSeriesTable').innerHTML='<table class="dash-table"><thead><tr><th>Serie / lado</th><th>Anterior</th><th>Actual</th><th>Resultado</th></tr></thead><tbody>'+
    labels.map(x=>{
     const p=x.p,reason=!p.previous?'Sin serie equivalente':p.state==='no-comparable'?'Técnica o condiciones distintas':p.state==='mixto'?'Peso y repeticiones cambiaron en sentidos opuestos':p.state==='mejora'?'Mejora comparable':p.state==='retrocede'?'Menor rendimiento comparable':'Sin cambio';
     return '<tr><td>'+esc(x.title)+'</td><td>'+esc(p.previous?fmt(kg(p.previous))+' kg × '+fmt(p.previous.reps,0):'—')+'</td><td>'+esc(fmt(kg(p.current))+' kg × '+fmt(p.current.reps,0))+'</td><td>'+esc(reason)+'</td></tr>';
    }).join('')+'</tbody></table>';
  }
  const tecs=[...group(rs,r=>clean(r.technique)||'Sin técnica').entries()].map(([name,arr])=>({name,last:arr.map(r=>r.date).sort().at(-1),dates:days(arr)})).sort((a,b)=>b.last.localeCompare(a.last));
  $('dashTechniques').innerHTML=tecs.map(t=>labelRow(t.name,t.dates+' fecha(s) · última '+t.last)).join('')||empty('Sin técnicas registradas.');
 }
 function renderAnalysis(rows){
  const statuses=statusList(rows);
  const states=['mejora','mantiene','por revisar','sin datos comparables'];
  const counts=states.map(state=>({label:state==='sin datos comparables'?'Sin comparación':state,value:statuses.filter(s=>s.state===state).length}));
  $('dashAnalysisCards').innerHTML=counts.map(x=>'<div class="dash-kpi"><small>'+esc(x.label)+'</small><strong>'+x.value+'</strong><span>Ejercicios en el período</span></div>').join('');
  $('dashStates').innerHTML=barChart(counts,{title:'Estado de los ejercicios según series comparables'});
  const now=latestDate(),startLast=addDays(now,-27),startOld=addDays(now,-55),endOld=addDays(now,-28);
  const current=rows.filter(r=>r.date>=startLast&&r.date<=now),previous=rows.filter(r=>r.date>=startOld&&r.date<=endOld);
  const zones=unique(rows.map(r=>clean(r.zone)||'Sin anotación')).map(name=>{
   const f=x=>x.zone===name||(name==='Sin anotación'&&!clean(x.zone));
   return {name,new:days(current.filter(f)),old:days(previous.filter(f))};
  }).sort((a,b)=>b.new+b.old-a.new-a.old).slice(0,8);
  $('dashPeriodicity').innerHTML=zones.length?zones.map(z=>'<div class="dash-period-row"><strong>'+esc(z.name)+'</strong><span>Previo: '+z.old+' días / 4 sem.</span><span>Actual: '+z.new+' días / 4 sem.</span></div>').join(''):empty('Se necesitan registros de las últimas ocho semanas.');
  const reviews=statuses.filter(s=>s.state==='por revisar');
  $('dashStalled').innerHTML=reviews.length?reviews.map(s=>labelRow(s.name,s.message,'caution')).join(''):empty('No se identificaron retrocesos confirmados en series comparables.');
  const sides=[];
  for(const [name,rs] of group(rows,r=>r.exercise)){
   const lat=[...new Set(rs.map(r=>r.date))].sort().at(-1);
   const currentRows=rs.filter(r=>r.date===lat);
   const left=currentRows.filter(r=>/izquierda|izquierdo/i.test(matchSide(r)));
   const right=currentRows.filter(r=>/derecha|derecho/i.test(matchSide(r)));
   for(const l of left){
    const r=right.find(x=>seriesNo(x)!==null&&seriesNo(x)===seriesNo(l)&&
     clean(l.technique)===clean(x.technique)&&clean(l.equipment)===clean(x.equipment)&&grip(l)===grip(x)&&Number(l.reps)===Number(x.reps));
    if(r)sides.push({name,series:seriesNo(l),left:kg(l),right:kg(r),date:lat});
   }
  }
  $('dashSides').innerHTML=sides.length?sides.slice(0,8).map(s=>labelRow(s.name+' · Serie '+s.series,fmt(s.left)+' / '+fmt(s.right)+' kg · I/D')).join(''):
   empty('No hay pares derecha/izquierda con la misma técnica, serie y repeticiones.');
  const changes=[];
  for(const [name,rs] of group(rows,r=>r.exercise)){
   const data=[...rs].sort((a,b)=>a.date.localeCompare(b.date));
   const last=new Map();
   for(const r of data)last.set(r.date,clean(r.technique)||'Sin técnica');
   const sequence=[...last.entries()];
   if(sequence.length>=2&&sequence.at(-1)[1]!==sequence.at(-2)[1])
    changes.push({name,from:sequence.at(-2)[1],to:sequence.at(-1)[1],date:sequence.at(-1)[0]});
  }
  $('dashTechniqueChanges').innerHTML=changes.length?changes.slice(0,9).map(x=>labelRow(x.name,x.from+' → '+x.to+' · '+x.date)).join(''):
   empty('No se detectaron cambios en la técnica registrada entre las últimas sesiones.');
 }
 function render(rows){
  all=(Array.isArray(rows)?rows:[]).filter(valid);
  const oldGym=value('dashGym'),oldSede=value('dashSede');
  select('dashGym',unique(all.map(r=>clean(r.gym))),'Todos los gimnasios');
  if(oldGym&&$('dashGym'))$('dashGym').value=unique(all.map(r=>clean(r.gym))).includes(oldGym)?oldGym:'';
  const gyms=all.filter(r=>!value('dashGym')||r.gym===value('dashGym'));
  select('dashSede',unique(gyms.map(r=>clean(r.sede))),'Todas las sedes');
  if(oldSede&&$('dashSede'))$('dashSede').value=unique(gyms.map(r=>clean(r.sede))).includes(oldSede)?oldSede:'';
  $('dashCustomDates').hidden=value('dashRange')!=='custom';
  const f=filters(),invalid=!!(f.from&&f.to&&f.from>f.to),subset=filteredRows();
  $('dashStatus').textContent=invalid?'La fecha «Desde» debe ser anterior o igual a «Hasta».':
   subset.length?fmt(days(subset),0)+' días con actividad · '+unique(subset.map(r=>r.exercise)).length+' ejercicios con registros · '+(f.technique?'comparación estricta de técnica':'se muestran todas las técnicas, con advertencias al comparar'):
   'No hay registros para los filtros elegidos.';
  renderSummary(subset);renderProgress(subset);renderAnalysis(subset);
 }
 function show(tabName){
  tab=['resumen','progreso','analisis'].includes(tabName)?tabName:'resumen';
  document.querySelectorAll('[data-dash-tab]').forEach(button=>{
   const selected=button.dataset.dashTab===tab;
   button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));
  });
  ['resumen','progreso','analisis'].forEach(n=>{const pane=$('dash-'+n);if(pane)pane.hidden=n!==tab;});
 }
 function init(){
  if(!$('dash-resumen'))return;
  document.querySelectorAll('[data-dash-tab]').forEach(btn=>btn.addEventListener('click',()=>show(btn.dataset.dashTab)));
  const ids=['dashGym','dashSede','dashRange','dashFrom','dashTo','dashTechnique','dashExercise','dashEquipment','dashAccessory','dashSubdivision','dashSeries','dashMetric'];
  for(const id of ids){const el=$(id);if(el)el.addEventListener('change',()=>{
   if(id==='dashGym')$('dashSede').value='';
   if(id==='dashExercise'){for(const other of ['dashEquipment','dashAccessory','dashSubdivision','dashSeries'])$(other).value='';}
   if(id==='dashEquipment'){for(const other of ['dashAccessory','dashSubdivision','dashSeries'])$(other).value='';}
   if(id==='dashAccessory'){for(const other of ['dashSubdivision','dashSeries'])$(other).value='';}
   render(typeof model!=='undefined'&&Array.isArray(model.records)?model.records:[]);
  });}
  show('resumen');render(typeof model!=='undefined'&&Array.isArray(model.records)?model.records:[]);
 }
 window.GymDashboard={init,render,show,compare:comparable,classify,pickPairs,exerciseStatus,filterRows:filteredRows};
 init();
})();