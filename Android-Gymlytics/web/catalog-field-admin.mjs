/* GymLytics 01.12: administración offline de campos personalizados, en Catálogos y Registro. */
const get=id=>document.getElementById(id);
const fixed=new Set(['Agrupación','Anotación','Máquina','Instrumento','Agarre / Implemento','Técnica','Nombre del ejercicio']);
function createPanel(kind){
 const panel=document.createElement('section');panel.className='gym-extra-field-panel';
 panel.dataset.fieldPanel=kind;
 panel.innerHTML='<details><summary>➕ Nuevos detalles · Administrar campos</summary>'+
 '<p class="gym-extra-help">Añade características a tus ejercicios y registros. Puedes renombrarlas o eliminarlas desde aquí.</p>'+
 '<label>Nuevo campo<input data-field-new maxlength="120" placeholder="Ej.: Ángulo de trabajo"></label>'+
 '<button type="button" class="outline-btn" data-field-action="add">+ Agregar campo</button>'+
 '<label>Campo existente<select data-field-existing aria-label="Campo personalizado"></select></label>'+
 '<label>Nombre modificado<input data-field-name maxlength="120" placeholder="Nombre actualizado"></label>'+
 '<div class="gym-extra-actions"><button type="button" class="outline-btn" data-field-action="rename">✎ Modificar</button>'+
 '<button type="button" class="outline-btn gym-danger" data-field-action="delete">⚠ Eliminar</button></div>'+
 '<p data-field-status role="status"></p></details>';
 const selectField=panel.querySelector('[data-field-existing]');
 selectField.addEventListener('change',()=>{
  panel.querySelector('[data-field-name]').value=selectField.value;
  setButtonState(panel);
 });
 panel.addEventListener('click',async event=>{
  const button=event.target.closest('[data-field-action]');if(!button)return;
  const action=button.dataset.fieldAction,selected=panel.querySelector('[data-field-existing]').value;
  const newName=panel.querySelector('[data-field-new]').value.trim();
  const replacement=panel.querySelector('[data-field-name]').value.trim();
  const status=panel.querySelector('[data-field-status]');
  const api=window.GymCloud;
  if(!api?.canWrite?.()){status.textContent='Selecciona primero un perfil editable.';return;}
  try{
   if(action==='delete'){
    if(!selected)throw Error('Selecciona primero el campo que deseas eliminar.');
    const use=api.detailFieldStats(selected);
    const warning='⚠️ PELIGRO: Eliminar el campo «'+selected+'» retirará sus valores de '+use.exercises+
      ' ejercicios de Catálogos y '+use.records+' series registradas. Puede afectar múltiples registros. Esta operación no puede deshacerse sin un respaldo. ¿Confirmas la eliminación?';
    if(!confirm(warning))return;
   }
   button.disabled=true;
   if(action==='add'){if(!newName)throw Error('Escribe el nombre del campo.');await api.addDetailField(newName);}
   if(action==='rename'){if(!selected||!replacement)throw Error('Selecciona un campo y escribe un nuevo nombre.');
    await api.renameDetailField(selected,replacement);}
   if(action==='delete')await api.removeDetailField(selected);
   refresh();
   status.textContent=action==='add'?'Campo creado. Ya aparece en los detalles de ejercicios y en Registro.':
    action==='rename'?'Campo y valores relacionados actualizados offline.':'Campo eliminado únicamente del perfil actual.';
  }catch(error){status.textContent=String(error.message||error);}
  finally{button.disabled=false;setButtonState(panel);}
 });
 return panel;
}
function setButtonState(panel){
 const has=!!panel.querySelector('[data-field-existing]').value;
 for(const b of panel.querySelectorAll('[data-field-action="rename"],[data-field-action="delete"]'))b.disabled=!has;
}
const catalog=document.querySelector('[data-catalog-kind="exercise"]');
const browser=get('catalogDetailBrowser')?.closest('.catalog-detail-disambiguator');
const registro=get('registroNuevosDetalles');
const catalogPanel=createPanel('catalog'),registroPanel=createPanel('registro');
if(catalog){
 if(browser)browser.before(catalogPanel);else catalog.after(catalogPanel);
}
if(registro)registro.append(registroPanel);
function refresh(){
 const names=window.GymCloud?.detailFieldList?.()||[];
 for(const panel of [catalogPanel,registroPanel]){
  const picker=panel.querySelector('[data-field-existing]'),previous=picker.value;
  picker.replaceChildren(new Option(names.length?'Seleccionar campo…':'Sin campos personalizados',''));
  for(const name of names)picker.add(new Option(name,name));
  picker.value=names.includes(previous)?previous:'';
  const input=panel.querySelector('[data-field-name]');
  input.value=picker.value;
  setButtonState(panel);
 }
 const register=get('registroDetalleValores');if(!register)return;
 const chosen=window.GymExerciseLibrary?.find(e=>e.id===window.GymSelectedExerciseId);
 const existing=Object.fromEntries((chosen?.detalles||[]).map(d=>[d.campo,d.valor]));
 const previous=Object.fromEntries([...register.querySelectorAll('[data-reg-extra]')].map(x=>[x.dataset.regExtra,x.value]));
 register.replaceChildren();
 for(const name of names){
  if(fixed.has(name))continue;
  const label=document.createElement('label');label.textContent=name;
  const field=document.createElement('input');field.dataset.regExtra=name;field.maxLength=500;
  field.placeholder='Valor (opcional)';
  field.value=previous[name]??existing[name]??'';
  label.append(field);register.append(label);
 }
}
window.GymCatalogFieldRefresh=refresh;
window.GymRegistroNewDetails=()=>Object.fromEntries([...document.querySelectorAll('#registroDetalleValores [data-reg-extra]')]
 .map(input=>[input.dataset.regExtra,input.value.trim()]).filter(([,value])=>!!value));
document.addEventListener('change',event=>{
 if(event.target.id==='registroVariante'||event.target.id==='ejercicio')refresh();
});
document.addEventListener('click',event=>{if(event.target.matches('[data-page="registro"]'))refresh();});
refresh();