import type {CommercialRow} from './commercial';
export type QualityCounts={responses:number;scheduled:number;calls:number;sales:number};
const empty=():QualityCounts=>({responses:0,scheduled:0,calls:0,sales:0});
export function commercialQuality(legacy:Record<string,number>,rows:CommercialRow[],dates:string[],asOf:string){
 const selected=new Set(dates),within=(d:string)=>!!d&&selected.has(d)&&d<=asOf,valid=(d:string)=>!!d&&d<=asOf;
 const channels={online:empty(),presential:empty()},total=empty(),unassigned=empty();
 const historicalScheduling={online:legacy.online_scheduled||0,presential:legacy.presential_scheduled||0,total:Math.max(legacy.scheduled||0,(legacy.online_scheduled||0)+(legacy.presential_scheduled||0)),unassigned:0};
 historicalScheduling.unassigned=Math.max(0,historicalScheduling.total-historicalScheduling.online-historicalScheduling.presential);
 for(const key of Object.keys(total) as (keyof QualityCounts)[]){
  if(key==='scheduled')continue;
  for(const channel of ['online','presential'] as const)channels[channel][key]=legacy[channel+'_'+key]||0;
  total[key]=Math.max(legacy[key]||0,channels.online[key]+channels.presential[key]);
  unassigned[key]=Math.max(0,total[key]-channels.online[key]-channels.presential[key]);
 }
 for(const [channel,origin] of [['online','Leads'],['presential','Presencial']] as const){
  const source=rows.filter(r=>r.origin===origin);
  const contacts=new Set(source.filter(r=>r.kind==='Cadastro'&&within(r.response)).map(r=>r.name));
  const events=source.filter(r=>r.kind==='Evento');
  for(const r of events)if(r.activity==='Primeira resposta'&&within(r.done))contacts.add(r.name);
  const meetings=source.filter(r=>r.kind==='Reunião');
  const counts:QualityCounts={responses:contacts.size,scheduled:meetings.filter(r=>within(r.due||r.original)).length,calls:meetings.filter(r=>within(r.done)).length,sales:new Set(events.filter(r=>r.activity==='Fechamento'&&within(r.done)).map(r=>r.name)).size};
  // Source rows supplied by the caller cover only weeks using the new rules.
  for(const key of Object.keys(total) as (keyof QualityCounts)[]){channels[channel][key]+=counts[key];total[key]+=counts[key];}
 }
 const cohorts=Object.fromEntries((['online','presential'] as const).map(channel=>{
  const origin=channel==='online'?'Leads':'Presencial',source=rows.filter(r=>r.origin===origin);
  const cohort=source.filter(r=>r.kind==='Cadastro'&&within(r.first));
  // A repeated name makes a cohort ambiguous; never silently merge it.
  const unique=cohort.length===new Set(cohort.map(r=>r.name)).size;
  const base=cohort.length,responded=cohort.filter(r=>valid(r.response)).length;
  const met=cohort.filter(r=>source.some(m=>m.kind==='Reunião'&&m.name===r.name&&valid(m.done))).length;
  return [channel,{base,response:unique&&base?responded/base:null,meeting:unique&&base?met/base:null}];
 })) as Record<'online'|'presential',{base:number;response:number|null;meeting:number|null}>;
 return {total,channels,unassigned,cohorts,historicalScheduling};
}
