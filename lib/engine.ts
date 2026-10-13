import dailyPatterns from '../config/daily-patterns.json' with {type:'json'};
import commitments from '../config/commitments.json' with {type:'json'};
import metricRoles from '../config/metric-roles.json' with {type:'json'};
import initialPeriod from '../config/initial-period.json' with {type:'json'};
import commercialPlan from '../config/commercial-plan.json' with {type:'json'};
export function isLeadMetric(metric:{id:string}):boolean{return metricRoles[metric.id as keyof typeof metricRoles]!=='tracking';}
export const areas = ['Comercial','Saúde','Estudo','Disciplina'];
export type Metric = {id:string; name:string; area:string; unit:string; target:number; weight:number; active:boolean};
export type Entry = {date:string; leads:number; visits:number; scheduled:number; calls:number; reviews:number; minutes:number; updates:boolean; makers:boolean; daily:boolean; responses?:number; sales?:number; channels?:Partial<Record<'online'|'presential',Record<string,number>>>; trainings:{type:string; quality:number; duration:number; note:string}[]};
export type Week = {metrics:Metric[]; weights:Record<string,number>; entries:Entry[]; reviewed:boolean; note:string; dailyTargets?:Record<string,number[]>; commercialDays?:{online:number[];presential:number[]}};
export type Goal = {name:string; area:string; value:number; target:number; initial:number; unit:string; stock:boolean; confirmed?:boolean; initialConfirmed?:boolean};
export type Life = {name:string; vision:string; initial:number|null; final:number|null};
export type Period = {id:string; name:string; start:string; end:string; weeks:Week[]; goals:Goal[]; life:Life[]; strategies:string; closed:boolean; commercialPlanVersion?:number; areaWeightsVersion?:number; weekOneTargetsVersion?:number; calendarVersion?:number; commitmentPrinciple?:string; commitments?:string[]; perspective?:string};
export type State = {periods:Period[]; selected:string; defaults:Metric[]; weights:Record<string,number>; green:number; yellow:number; areaWeightsVersion?:number};
export const defaults:Metric[] = [
 ['leads','Leads prospectados online','Comercial','leads',60,3],['visits','Prospecções presenciais','Comercial','empresas',8,2],['scheduled','Calls agendadas','Comercial','calls',5,2],['calls','Calls realizadas','Comercial','calls',4,2],['reviews','Revisões de call','Comercial','revisões',0,1],
 ['trainings','Treinos realizados','Saúde','treinos',5,1],['strength','Treinos de musculação','Saúde','treinos',3,1],['quality','Treinos com nota ≥ 4','Saúde','treinos',3,1],['perfect','Treinos com nota 5','Saúde','treinos',1,1],
 ['minutes','Horas líquidas de estudo','Estudo','min',300,2],['updates','Atualizações do dia','Estudo','dias',7,1],['makers','AI Makers','Estudo','dias',7,1],['daily','Revisão da programação','Disciplina','dias',7,1],['weekly','Revisão semanal','Disciplina','revisão',1,1]
].map(([id,name,area,unit,target,weight])=>({id:String(id),name:String(name),area:String(area),unit:String(unit),target:Number(target),weight:Number(weight),active:true}));
export const weights={Comercial:50,'Saúde':20,Estudo:25,Disciplina:5};
export const lifeDefaults:Life[]=[
 ['Espiritual','Quero viver “aleluiado”.',6],['Relacionamentos','Quero ter uma esposa e 4 filhos. Melhorar a forma como me relaciono, conquisto e lido com esta fase, acreditando que minha esposa chegará no momento correto.',7],['Familiar','Ter uma relação melhor dentro de casa e dedicar mais atenção à minha família.',6],['Financeira','Ganhar R$10.000 por mês com tranquilidade. Buscar R$3 milhões de patrimônio para renda passiva; no curto prazo, R$50.000.',2],['Estilo de vida','Praticar esporte com sol, ser muito estudioso e, depois dos 30, decidir quantas horas trabalhar.',4],['Saúde','Ótimo shape e longevidade: chegar aos 100 anos ou mais com qualidade de vida. Peso inicial aproximado: 70,25 kg.',6],['Social','Manter meus amigos por toda a vida, agir com lealdade e melhorar minha comunicação com novas pessoas.',8],['Intelectual','Ser formado, com uma bagagem muito maior que a formação acadêmica. Ser inteligente, curioso e estudioso.',6],['Emocional','Quero ser um cara pleno.',null]
].map(([name,vision,initial])=>({name:String(name),vision:String(vision),initial:initial===null?null:Number(initial),final:null}));
export function emptyEntry(date:string):Entry {return {date,leads:0,visits:0,scheduled:0,calls:0,reviews:0,minutes:0,updates:false,makers:false,daily:false,trainings:[]};}
export function makePeriod(name:string,start:string,metrics=defaults,areaWeights:Record<string,number>=weights):Period {
 const end=weekBounds({start} as Period,11).end;
 return {id:crypto.randomUUID(),name,start,end,closed:false,areaWeightsVersion:2,calendarVersion:1,commitmentPrinciple:commitments.principle,commitments:[...commitments.items],weeks:Array.from({length:12},()=>({metrics:structuredClone(metrics),weights:{...areaWeights},entries:[],reviewed:false,note:''})),goals:[{name:'Clientes fechados',area:'Empresa',value:0,target:8,initial:0,unit:'clientes',stock:false,confirmed:false,initialConfirmed:true},{name:'Caixa da empresa',area:'Empresa',value:0,target:16000,initial:0,unit:'R$',stock:true,confirmed:false,initialConfirmed:false},{name:'Receita nova',area:'Empresa',value:0,target:0,initial:0,unit:'R$',stock:false,confirmed:false,initialConfirmed:true},{name:'Investimentos',area:'Pessoal',value:0,target:25000,initial:0,unit:'R$',stock:true,confirmed:false,initialConfirmed:false},{name:'Peso corporal',area:'Saúde',value:0,target:70,initial:0,unit:'kg',stock:true,confirmed:false,initialConfirmed:false}],life:structuredClone(lifeDefaults),strategies:'Não distribuir lucro.\nViver apenas com pró-labore de R$3.200.\nProspectar consistentemente durante o período.'};
}
export function virtualTime(period:Period,now:number) {
 const start=Date.parse(period.start),end=Date.parse(period.end),totalDays=Math.ceil((end-start)/86400000);const progress=period.closed?1:Math.max(0,Math.min(1,(now-start)/(end-start)));
 const virtual=new Date(Date.UTC(2025,0,1)+Math.min(progress*365*86400000,365*86400000-60000));
 return {progress,virtual,future:now<start,ended:period.closed||now>=end,week:now>=end?12:Math.min(12,Math.max(1,weekIndexForDate(period,new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}))+1)),day:Math.min(totalDays,Math.max(1,Math.floor((now-start)/86400000)+1)),totalDays,remaining:Math.max(0,Math.ceil((end-now)/86400000)),virtualDays:progress*365};
}
export function scoreWeek(week:Week) {
 const total:Record<string,number>={weekly:week.reviewed?1:0};
 for(const e of week.entries){for(const source of ['online','presential'] as const){for(const [field,value] of Object.entries(e.channels?.[source]||{})){if(value!==undefined)total[source+'_'+field]=(total[source+'_'+field]||0)+value;}}for(const k of ['leads','visits','scheduled','calls','reviews','minutes','updates','makers','daily','responses','sales']){if((k==='sales'||k==='responses')&&e[k]===undefined&&!Object.values(e.channels||{}).some(c=>c[k]!==undefined))continue;total[k]=(total[k]||0)+Math.max(Number(e[k as keyof Entry]||0),['scheduled','calls','sales','responses'].includes(k)?Object.values(e.channels||{}).reduce((s,c)=>s+(c[k]||0),0):0);}for(const t of e.trainings){total.trainings=(total.trainings||0)+1;total.strength=(total.strength||0)+(t.type==='Musculação'?1:0);total.quality=(total.quality||0)+(t.quality>=4?1:0);total.perfect=(total.perfect||0)+(t.quality===5?1:0);}}
 const metrics=week.metrics.filter(m=>m.active).map(m=>{const target=m.id==='reviews'?(total.calls||0):m.target;const value=total[m.id]||0;return {...m,target,value,ratio:target>0?value/target:null,overdue:0,dueToday:0};});
 const scores:Record<string,number|null>={};for(const area of areas){const applicable=metrics.filter(m=>isLeadMetric(m)&&m.area===area&&m.ratio!==null&&m.weight>0);scores[area]=applicable.length?applicable.reduce((s,m)=>s+Math.min(1,m.ratio!)*m.weight,0)/applicable.reduce((s,m)=>s+m.weight,0):null;}
 const applicable=areas.filter(a=>scores[a]!==null&&week.weights[a]>0);const overall=applicable.length?applicable.reduce((s,a)=>s+scores[a]!*week.weights[a],0)/applicable.reduce((s,a)=>s+week.weights[a],0):null;
 return {metrics,scores,overall,total};
}
export function projection(goal:Goal,progress:number){if(progress<=0||goal.unit==='kg'||goal.confirmed===false||(goal.stock&&goal.initialConfirmed===false))return null;return goal.stock?goal.initial+(goal.value-goal.initial)/progress:goal.value/progress;}
export function initialState():State {
 const p=makePeriod(initialPeriod.name,initialPeriod.start);applyCommercialPlan(p);correctWeekOneTargets(p);
 return {periods:[p],selected:p.id,defaults:structuredClone(defaults),weights:{...weights},green:85,yellow:70,areaWeightsVersion:2};
}
// Replace only the known demonstration. Preserve existing real periods and user settings.
export function migrateDemoState(state:State):State {
 for(const p of state.periods)migrateSundayCalendar(p);
 applyRequestedWeights(state);
 for(const p of state.periods)if(Date.parse(p.start)===Date.parse(initialPeriod.start))correctWeekOneTargets(p);
 const real=state.periods.filter(p=>p.name!=='Período demonstrativo');
 if(real.length===state.periods.length){for(const p of real){if(Date.parse(p.start)===Date.parse(initialPeriod.start)&&!p.commercialPlanVersion)applyCommercialPlan(p,true);}return state;}
 if(!real.length){const p=makePeriod(initialPeriod.name,initialPeriod.start,state.defaults,state.weights);applyCommercialPlan(p,true);correctWeekOneTargets(p);return {...state,periods:[p],selected:p.id};}
 return {...state,periods:real,selected:real.some(p=>p.id===state.selected)?state.selected:real[0].id};
}

export function applyCommercialPlan(period:Period,preserveCustom=false):void {
 period.weeks.forEach((w,i)=>{
  if(w.entries.length||w.reviewed)return;
  for(const m of w.metrics){
   if(!['leads','visits'].includes(m.id))continue;
   if(preserveCustom&&m.target!==defaults.find(d=>d.id===m.id)?.target)continue;
   m.target=m.id==='leads'?commercialPlan[i].leads:commercialPlan[i].visits;
  }
 });
 period.commercialPlanVersion=1;
}

// Apply the requested distribution once, without changing recorded historical weeks.
export function applyRequestedWeights(state:State,now=Date.now()):void {
 if((state.areaWeightsVersion??0)>=2)return;
 state.weights.Estudo=25;state.weights.Disciplina=5;state.areaWeightsVersion=2;
 for(const p of state.periods){
  if((p.areaWeightsVersion??0)>=2)continue;
  const activeIndex=virtualTime(p,now).week-1;
  if(!p.closed&&now<Date.parse(p.end)){
   p.weeks.forEach((w,i)=>{if(i<activeIndex)return;w.weights.Estudo=25;w.weights.Disciplina=5;});
  }
  p.areaWeightsVersion=2;
 }
}

export function correctWeekOneTargets(period:Period):void {
 if(period.weekOneTargetsVersion===1)return;
 for(const m of period.weeks[0].metrics){if(m.id==='scheduled')m.target=1;if(m.id==='calls')m.target=0;}
 period.weekOneTargetsVersion=1;
}

export function scorePeriod(period:Period,now=Date.now()) {
 const last=virtualTime(period,now).week-1;
 const included=period.weeks.slice(0,last+1).map((w,i)=>{const plan=dailyTargets(period,i),dates=weekDates(period,i),today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});return {...w,metrics:w.metrics.map(m=>({...m,target:dates.reduce((s,d,j)=>s+(d<=today?plan[m.id]?.[j]||0:0),0)})),reviewed:w.reviewed&&dates[dates.length-1]<=today};});
 const combined:Week={metrics:[],weights:{...included[0].weights},entries:included.flatMap(w=>w.entries.filter(e=>Date.parse(e.date+'T00:00:00-03:00')<=now)),reviewed:false,note:''};
 const byId=new Map<string,Metric>();
 for(const w of included){for(const m of w.metrics){if(!m.active)continue;const existing=byId.get(m.id);if(existing){existing.target+=m.target;existing.weight+=m.weight;}else byId.set(m.id,{...m});}}
 combined.metrics=[...byId.values()].map(m=>({...m,weight:m.weight/included.length}));
 for(const a of areas)combined.weights[a]=included.reduce((s,w)=>s+w.weights[a],0)/included.length;
 const result=scoreWeek(combined);
 const weekly=result.metrics.find(m=>m.id==='weekly');if(weekly){weekly.value=included.filter(w=>w.reviewed).length;weekly.ratio=weekly.target>0?weekly.value/weekly.target:null;}
 for(const a of areas){const ms=result.metrics.filter(m=>isLeadMetric(m)&&m.area===a&&m.ratio!==null&&m.weight>0);result.scores[a]=ms.length?ms.reduce((s,m)=>s+Math.min(1,m.ratio!)*m.weight,0)/ms.reduce((s,m)=>s+m.weight,0):null;}
 const eligible=areas.filter(a=>result.scores[a]!==null&&combined.weights[a]>0);
 result.overall=eligible.length?eligible.reduce((s,a)=>s+result.scores[a]!*combined.weights[a],0)/eligible.reduce((s,a)=>s+combined.weights[a],0):null;
 const today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 for(const m of result.metrics){let past=0;let dueToday=0;period.weeks.slice(0,last+1).forEach((w,i)=>{const plan=dailyTargets(period,i),dates=weekDates(period,i);dates.forEach((d,j)=>{if(d<today)past+=plan[m.id]?.[j]||0;if(d===today)dueToday+=plan[m.id]?.[j]||0;});});if(m.id==='reviews'){past=scoreWeek({...combined,entries:combined.entries.filter(e=>e.date<today)}).total.calls||0;dueToday=(result.total.calls||0)-past;}m.overdue=Math.max(0,past-m.value);m.dueToday=dueToday;}
 return {...result,weights:combined.weights,entries:combined.entries};
}

export function weekBounds(period:Pick<Period,'start'>,index:number):{start:string;end:string}{
 const startDay=new Date(period.start).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const weekday=new Date(startDay+'T12:00:00-03:00').getUTCDay();
 const firstEnd=Date.parse(startDay+'T00:00:00-03:00')+(7-(weekday+6)%7)*86400000;
 return {start:index===0?period.start:new Date(firstEnd+(index-1)*604800000).toISOString(),end:new Date(firstEnd+index*604800000).toISOString()};
}
export function weekIndexForDate(period:Period,date:string):number {
 if(date<new Date(period.start).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}))return -1;
 const time=Date.parse(date+'T12:00:00-03:00');
 if(time>=Date.parse(period.end))return -1;
 const firstEnd=Date.parse(weekBounds(period,0).end);
 return time<firstEnd?0:Math.min(11,Math.floor((time-firstEnd)/604800000)+1);
}
export function weekDates(period:Period,index:number):string[]{const bounds=weekBounds(period,index);const startDay=new Date(bounds.start).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});const first=Date.parse(startDay+'T00:00:00-03:00');return Array.from({length:Math.ceil((Date.parse(bounds.end)-first)/86400000)},(_,d)=>new Date(first+d*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}));}
export function migrateSundayCalendar(period:Period):void {
 if(period.calendarVersion===1)return;
 const entries=period.weeks.flatMap(w=>w.entries);
 // Keep the original snapshots as an archive, then remap daily targets by date.
 const old=structuredClone(period.weeks);
 (period as Period&{previousCalendarWeeks?:Week[]}).previousCalendarWeeks=old;
 period.end=weekBounds(period,11).end;
 period.weeks.forEach((w,index)=>{
  w.entries=[];
  if(!old.some(w=>w.dailyTargets))return;
  const dates=weekDates(period,index);const targets:Record<string,number[]>={};
  for(const m of w.metrics){targets[m.id]=dates.map(date=>{
   const offset=Math.floor((Date.parse(date+'T12:00:00-03:00')-Date.parse(period.start))/86400000);
   const oldWeek=old[index],day=offset-index*7;
   return day>=0&&day<7?(oldWeek?.dailyTargets?.[m.id]?.[day]??0):0;
  });
  if(targets[m.id].reduce((s,v)=>s+v,0)===0&&m.target>0)delete targets[m.id];
  }
  w.dailyTargets=targets;
 });
 for(const e of entries){const index=weekIndexForDate(period,e.date);if(index>=0)period.weeks[index].entries.push(e);else{const extended=period as Period&{unassignedEntries?:Entry[]};extended.unassignedEntries=[...(extended.unassignedEntries||[]),e];}}
 period.calendarVersion=1;
}

export function dailyTargets(period:Period,index:number):Record<string,number[]>{
 const week=period.weeks[index],dates=weekDates(period,index),result:Record<string,number[]>={};
 for(const m of week.metrics){
  const stored=week.dailyTargets?.[m.id];
  const sum=stored?.reduce((s,v)=>s+v,0)||0;
  if(stored&&stored.length===dates.length&&Math.abs(sum-m.target)<.00001){result[m.id]=[...stored];continue;}
  if(stored&&stored.length===dates.length&&sum>0){result[m.id]=stored.map(v=>v*m.target/sum);continue;}
  const weekdays=dates.map(d=>new Date(d+'T12:00:00-03:00').getUTCDay());
  let days:number[];
  if(m.id==='leads')days=week.commercialDays?.online??(index===1&&Date.parse(period.start)===Date.parse(initialPeriod.start)?dailyPatterns.initialPeriodWeek2.online:dailyPatterns.online);
  else if(m.id==='visits')days=week.commercialDays?.presential??(index===1&&Date.parse(period.start)===Date.parse(initialPeriod.start)?dailyPatterns.initialPeriodWeek2.presential:dailyPatterns.presential);
  else if(m.id==='weekly')days=[weekdays[weekdays.length-1]];
  else if(['updates','makers','daily'].includes(m.id))days=weekdays;
  else days=weekdays.slice(0,5);
  const slots=weekdays.map((day,i)=>days.includes(day)?i:-1).filter(i=>i>=0);
  result[m.id]=Array(dates.length).fill(0);
  if(slots.length)slots.forEach((i,j)=>{result[m.id][i]=Number.isInteger(m.target)?Math.floor(m.target/slots.length)+(j<m.target%slots.length?1:0):m.target/slots.length;});
 }
 return result;
}
export function scoreWeekToDate(period:Period,index:number,now=Date.now(),day?:string){
 const source=period.weeks[index],dates=weekDates(period,index),today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),plan=dailyTargets(period,index);
 const selected=dates.map((d,i)=>(day?d===day:d<=today)?i:-1).filter(i=>i>=0);
 const week:Week={...source,metrics:source.metrics.map(m=>({...m,target:selected.reduce((s,i)=>s+(plan[m.id]?.[i]||0),0)})),entries:source.entries.filter(e=>day?e.date===day:e.date<=today),reviewed:source.reviewed&&selected.includes(dates.length-1)};
 const result=scoreWeek(week);for(const m of result.metrics){let past=selected.reduce((s,i)=>s+(dates[i]<today?plan[m.id]?.[i]||0:0),0);if(m.id==='reviews')past=scoreWeek({...week,entries:week.entries.filter(e=>e.date<today)}).total.calls||0;m.overdue=Math.max(0,past-m.value);m.dueToday=selected.reduce((s,i)=>s+(dates[i]===today?plan[m.id]?.[i]||0:0),0);}
 return {...result,entries:week.entries,weights:week.weights};
}
