import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCommercial, commercialStats} from '../lib/commercial.ts';

const code=readFileSync(new URL('./comercial.gs',import.meta.url),'utf8');
let serial=0;
const ctx=vm.createContext({Date,JSON,Utilities:{
  getUuid:()=>`id-${++serial}`,
  formatDate:(date,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
},LockService:{getDocumentLock:()=>({waitLock(){},releaseLock(){}})}});
vm.runInContext(code,ctx);
const clone=x=>JSON.parse(JSON.stringify(x));
const base=(over={})=>({name:'Empresa teste',origin:'Presencial',stage:'A visitar',action:'',first:'',response:'',decisor:'',status:'',context:'',due:'',meeting:'',activity:'',outcome:'',retro:'',...over});
const seed=x=>ctx.comSeed(base(x));
const evolve=(s,x,fields,today='2026-10-24')=>ctx.comEvolve(s,base({...x}),today,`${today}T15:00:00Z`,fields);

test('semana começa segunda, inclusive domingo e virada do ano',()=>{
  for(const [d,w] of [['2026-10-19','2026-10-19'],['2026-10-25','2026-10-19'],['2026-10-26','2026-10-26'],['2027-01-01','2026-12-28']])assert.equal(ctx.comWeek(d),w);
});
test('datas brasileiras e ISO válidas; datas impossíveis não viram campos vazios',()=>{
  assert.equal(ctx.comDate('19/10/2026'),'2026-10-19');
  assert.throws(()=>ctx.comDate('31/02/2026'),/inválida/);assert.throws(()=>ctx.comDate('01-12'),/inválida/);
});
test('visita exige resultado; data automática persiste e só a primeira conta',()=>{
  const original=seed();assert.throws(()=>evolve(original,{activity:'Abordagem com contato'},['activity']),/Resultado/);
  const a=evolve(original,{activity:'Abordagem com contato',outcome:'Falei com gerente; reunião terça'},['activity']);
  assert.equal(original.events.length,0);assert.equal(a.first,'2026-10-24');assert.equal(a.lastActivity,'2026-10-24');
  const b=evolve(a,{activity:'Abordagem com contato',outcome:'Retorno ao gerente'},['activity'],'2026-10-26');
  assert.equal(b.events.filter(e=>e.type==='Primeira abordagem').length,1);
  assert.equal(b.events.at(-1).type,'Acompanhamento presencial');assert.equal(b.first,'2026-10-24');
});
test('tentativa sem contato e simples mudança para Visitado não contam abordagem',()=>{
  const a=evolve(seed(),{activity:'Tentativa sem contato'},['activity']);assert.equal(a.first,'');assert.equal(a.lastActivity,'2026-10-24');
  const b=evolve(a,{stage:'Visitado'},['stage']);assert.equal(b.first,'');
});
test('retroativa substitui hoje uma vez; última data visível não vira entrada',()=>{
  const a=evolve(seed(),{activity:'Abordagem com contato',outcome:'Conversa com dono',retro:'2026-10-19'},['activity']);
  assert.equal(a.first,'2026-10-19');assert.equal(a.consumeRetro,true);
  const b=evolve(a,{activity:'Follow-up realizado',effective:'2026-10-19'},['activity']);
  assert.equal(b.tasks[0].done,'2026-10-24');assert.equal(b.lastActivity,'2026-10-24');
  assert.throws(()=>evolve(a,{activity:'Follow-up realizado',retro:'2026-10-26'},['activity']),/futura/);
});
test('Feito direto registra sem planejamento fictício; repetição de Feito é idempotente',()=>{
  const a=evolve(seed(),{status:'Feito',due:'2026-10-27'},['status']);
  assert.equal(a.tasks.length,1);assert.equal(a.tasks[0].original,'');assert.equal(a.tasks[0].done,'2026-10-24');
  const b=evolve(a,{status:'Feito'},['status']);assert.equal(b.tasks.length,1);assert.equal(b.tasks[0].done,'2026-10-24');
});
test('follow-up preserva previsão original, reagendamento, conclusão e abre tarefa seguinte',()=>{
  let s=evolve(seed(),{status:'A fazer',due:'2026-10-22'},['status']);
  s=evolve(s,{status:'A fazer',due:'2026-10-24'},['due']);
  s=evolve(s,{status:'Feito',due:'2026-10-24'},['status']);
  assert.equal(s.tasks[0].original,'2026-10-22');assert.equal(s.tasks[0].changes.length,1);assert.equal(s.tasks[0].done,'2026-10-24');
  s=evolve(s,{status:'A fazer',due:'2026-10-24'},['status']);
  assert.equal(s.tasks.length,2);assert.equal(s.tasks[1].original,'');assert.equal(s.tasks[0].done,'2026-10-24');
  s=evolve(s,{status:'A fazer',due:'2026-10-28'},['due']);assert.equal(s.tasks[1].original,'2026-10-28');
});
test('próxima ação genérica não cria follow-up; data alterada com Feito não apaga conclusão',()=>{
  let s=evolve(seed(),{due:'2026-10-27'},['due']);assert.equal(s.tasks.length,0);
  s=evolve(s,{status:'Feito'},['status']);s=evolve(s,{status:'Feito',due:'2026-10-28'},['due']);
  assert.equal(s.tasks.length,1);assert.equal(s.tasks[0].done,'2026-10-24');
});
test('reunião planejada, reagendada, realizada: mantém uma identidade',()=>{
  let s=evolve(seed(),{stage:'Reunião marcada',meeting:'2026-10-27'},['stage','meeting']);
  s=evolve(s,{stage:s.stage,meeting:'2026-10-28'},['meeting']);
  s=evolve(s,{stage:s.stage,activity:'Reunião realizada'},['activity'],'2026-10-28');
  assert.equal(s.meetings.length,1);assert.equal(s.meetings[0].original,'2026-10-27');assert.equal(s.meetings[0].done,'2026-10-28');
  assert.equal(s.tasks.length,0);
});
test('etapa e comando de reunião juntos não duplicam; Feito e Perdido preservam conclusão',()=>{
  let s=evolve(seed(),{stage:'Reunião/apresentação realizada',activity:'Reunião realizada'},['stage','activity']);assert.equal(s.meetings.length,1);
  s=evolve(s,{stage:s.stage,status:'A fazer',due:'2026-10-24'},['status']);
  s=evolve(s,{stage:'Perdido',status:'Feito'},['stage','status']);
  assert.equal(s.tasks[0].done,'2026-10-24');assert.equal(s.tasks[0].cancelled,false);
});
test('migração conserva eventos e tarefas; divergência não é execução em hoje',()=>{
  const legacy={...seed({status:'A fazer',due:'2026-10-19',stage:'Follow-up'}),v:1};
  const copy=clone(legacy);
  const s=ctx.comUpgrade(legacy,base({status:'Feito',stage:'Perdido',due:'2026-12-01'}));
  assert.deepEqual(clone(legacy),copy);assert.deepEqual(clone(s.tasks),copy.tasks);assert.equal(s.tasks[0].done,'');
  assert.equal(s.lastActivity,'');assert.equal(s.current,null);assert.ok(s.migrationWarnings.length);
});
test('cadastro antigo avançado sem histórico não ganha execução fictícia',()=>{
  const s=seed({stage:'Proposta enviada',status:'Feito',due:'2026-10-27'});
  assert.equal(s.events.length,0);assert.equal(s.tasks.length,0);assert.ok(s.migrationWarnings.length);
});
test('exportação mantém N:AG e é lida pelo dashboard com data do registro sem horário',()=>{
  let s=evolve(seed(),{activity:'Abordagem com contato',outcome:'Falei com dono'},['activity'],'2026-10-19');
  s=evolve(s,{status:'A fazer',due:'2026-10-22'},['status']);s=evolve(s,{status:'Feito',due:'2026-10-22'},['status']);
  const header=vm.runInContext('COM.resultHeaders',ctx),rows=ctx.comResultRows('Presencial',s);
  const csv=[header,...rows].map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
  const parsed=parseCommercial(csv);assert.deepEqual(parsed.warnings,[]);
  const stats=commercialStats({commercialRows:parsed.rows,commercialDates:['2026-10-19','2026-10-22','2026-10-24']});
  assert.equal(stats.presential,1);assert.equal(stats.planned.length,1);assert.equal(stats.completed.length,1);
  assert.equal(parsed.rows.find(r=>r.kind==='Evento').recorded,'2026-10-19');
});
test('ocorrências repetidas no dia ficam no histórico sem duplicar identidade exportada',()=>{
  let s=evolve(seed(),{activity:'Tentativa sem contato'},['activity']);s=evolve(s,{activity:'Tentativa sem contato'},['activity']);
  assert.equal(s.events.length,2);assert.equal(ctx.comResultRows('Presencial',s).filter(r=>r[2]==='Evento').length,1);
});

class Range {
  constructor(sh,r,c,n=1,m=1){Object.assign(this,{sh,r,c,n,m});}
  getSheet(){return this.sh;} getRow(){return this.r;} getColumn(){return this.c;}
  getLastRow(){return this.r+this.n-1;} getLastColumn(){return this.c+this.m-1;}
  getNumColumns(){return this.m;}
  getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.cells[this.r+i-1]?.[this.c+j-1]??''));}
  getValue(){return this.getValues()[0][0];}
  setValues(v){assert.equal(v.length,this.n);v.forEach((row,i)=>{assert.equal(row.length,this.m);row.forEach((val,j)=>{this.sh.cells[this.r+i-1]??=[];this.sh.cells[this.r+i-1][this.c+j-1]=val;});});return this;}
  setValue(v){return this.setValues([[v]]);}
  clearContent(){return this.setValues(Array.from({length:this.n},()=>Array(this.m).fill('')));}
  setNumberFormat(){return this;} setBackground(){return this;} setFontColor(){return this;} setFontWeight(){return this;} setWrap(){return this;}
  setDataValidation(){return this;}setNote(){return this;}
  createFilter(){const range=this;return this.sh.filter={getRange:()=>range,getColumnFilterCriteria:()=>null,setColumnFilterCriteria(){},remove:()=>{this.sh.filter=null;}};}
}
class Sheet {
  constructor(name,ss,cells=[]){Object.assign(this,{name,ss,cells,maxRows:1000,maxCols:60});}
  getName(){return this.name;}getParent(){return this.ss;}getMaxRows(){return this.maxRows;}getMaxColumns(){return this.maxCols;}
  getLastRow(){return this.cells.length;}getLastColumn(){return Math.max(1,...this.cells.map(r=>r.length));}
  getRange(...args){return new Range(this,...args);}setFrozenRows(){}insertRowsAfter(_,n){this.maxRows+=n;}insertColumnsAfter(_,n){this.maxCols+=n;}
  insertColumnBefore(c){this.cells.forEach(r=>{while(r.length<c-1)r.push('');r.splice(c-1,0,'');});this.maxCols++;}
  getFilter(){return this.filter;}hideColumns(){}showColumns(){}
}
function workbook(){
  const ss={sheets:{},getId(){return 'sheet-test';},getSheetByName(n){return this.sheets[n];},insertSheet(n){return this.sheets[n]=new Sheet(n,this);},getSpreadsheetTimeZone(){return 'America/Los_Angeles';},toast(){}};
  for(const name of ['Leads','Presencial']) {
    const headers=['Nome','Etapa',name==='Leads'?'Data de follow-up':'Data da próxima ação',name==='Leads'?'Data em que foi chamado':'Primeira abordagem (automático)','Próxima ação',...vm.runInContext(`COM.added.${name}.concat(COM.extra)`,ctx)];
    const unique=[...new Set(headers)];ss.sheets[name]=new Sheet(name,ss,[unique]);
  }
  return ss;
}
function addCompany(ss,input={}) {
  const sh=ss.getSheetByName('Presencial'),h=ctx.comHeaders(sh),m=ctx.comMap('Presencial',h),x=base(input);
  const vals=Array(sh.getLastColumn()).fill('');for(const [k,v] of Object.entries(x))if(m[k])vals[m[k]-1]=v;
  sh.cells.push(vals);return {sh,h,m,row:sh.getLastRow()};
}
test('gatilho real: marca Feito, mantém data visível, salva auditoria e atualiza exportação',()=>{
  const ss=workbook(),x=base({status:'A fazer',due:'2026-10-24'}),s=seed(x);
  const {sh,m,row}=addCompany(ss,{...x,history:JSON.stringify(s),status:'Feito'});
  ctx.comercialAoEditar({source:ss,range:sh.getRange(row,m.status)});
  const saved=JSON.parse(sh.getRange(row,m.history).getValue());
  assert.ok(saved.tasks[0].done);assert.ok(sh.getRange(row,m.effective).getValue() instanceof Date);
  assert.ok(ss.getSheetByName('Histórico comercial').getLastRow()>1);
  const out=ss.getSheetByName('Resultados').cells.slice(1).map(r=>r.slice(13,33));
  assert.ok(out.some(r=>r[2]==='Follow-up'&&r[12]==='Feito'));
});
test('atualizar inclui empresas sem JSON, preserva A:M e limpa só sobras N:AG',()=>{
  const ss=workbook();addCompany(ss,{name:'Nova empresa'});
  const out=ss.insertSheet('Resultados');out.cells=[['Resumo'],['Preservar'],[],Array(33).fill('')];out.cells[3][13]='antigo';
  ctx.comRefresh(ss);assert.equal(out.cells[0][0],'Resumo');assert.equal(out.cells[1][0],'Preservar');
  assert.equal(out.cells[1][14],'Nova empresa');assert.equal(out.cells[3][13],'');
});
test('histórico inválido interrompe antes de substituir exportação anterior',()=>{
  const ss=workbook();addCompany(ss,{history:'{invalido'});const out=ss.insertSheet('Resultados');out.cells=[['Preservar']];
  assert.throws(()=>ctx.comRefresh(ss),/Histórico inválido/);assert.deepEqual(out.cells,[['Preservar']]);
});
test('colagem de várias linhas valida lote antes de gravar eventos',()=>{
  const ss=workbook();const a=addCompany(ss,{activity:'Abordagem com contato',outcome:'Conversa com dono'});
  addCompany(ss,{activity:'Abordagem com contato',outcome:''});
  assert.throws(()=>ctx.comercialAoEditar({source:ss,range:a.sh.getRange(2,a.m.activity,2,1)}),/Resultado/);
  assert.equal(a.sh.getRange(2,a.m.history).getValue(),'');assert.equal(ss.getSheetByName('Histórico comercial'),undefined);
});
test('instalação preserva dados antigos, separa listas do filtro e é repetível',()=>{
  const ss=workbook();
  const sh=ss.getSheetByName('Presencial');
  const extras=vm.runInContext('COM.extra',ctx);
  sh.cells[0]=sh.cells[0].filter(h=>!extras.includes(h));
  sh.cells[0].push('Prioridade MCMV','Opções de etapa','Opções de próxima ação');
  const p=addCompany(ss,{stage:'Follow-up',status:'Feito',due:'2026-10-23'});
  const oldDue=p.sh.getRange(p.row,p.m.due).getValue(),oldStatus=p.sh.getRange(p.row,p.m.status).getValue();
  sh.cells[1][sh.cells[0].indexOf('Opções de etapa')]='Reserva';
  const menu={addItem(){return this;},addToUi(){}};
  ctx.SpreadsheetApp={getActive:()=>ss,getUi:()=>({createMenu:()=>menu}),newDataValidation:()=>({requireValueInList(){return this;},setAllowInvalid(){return this;},build(){return {};}})};
  const triggers=[];
  ctx.ScriptApp={getProjectTriggers:()=>triggers,deleteTrigger(t){triggers.splice(triggers.indexOf(t),1);},newTrigger(handler){return {forSpreadsheet(){return this;},onEdit(){return this;},onOpen(){return this;},create(){triggers.push({getHandlerFunction:()=>handler,getTriggerSourceId:()=>ss.getId()});}};}};
  ctx.instalarAutomacaoComercial();
  const h=ctx.comHeaders(sh),m=ctx.comMap('Presencial',h);
  assert.ok(h['ID comercial (automático)']<h['Opções de etapa']);
  assert.equal(sh.getFilter().getRange().getLastColumn(),h['ID comercial (automático)']);
  assert.equal(sh.getRange(2,h['Opções de etapa']).getValue(),'Reserva');
  assert.equal(sh.getRange(2,m.status).getValue(),oldStatus);assert.equal(sh.getRange(2,m.due).getValue(),oldDue);
  const raw=sh.getRange(2,m.history).getValue(),snapshot=JSON.parse(raw);
  assert.equal(snapshot.tasks.length,0);assert.equal(snapshot.lastActivity,'');assert.equal(triggers.length,2);
  ctx.instalarAutomacaoComercial();
  assert.equal(sh.getRange(2,m.history).getValue(),raw);assert.equal(triggers.length,2);
});
test('horário próximo à meia-noite usa a data de São Paulo ao exportar o registro',()=>{
  assert.equal(ctx.comStampDay('2026-10-25T01:30:00.000Z'),'2026-10-24');
});
