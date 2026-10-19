import type {Entry,Week} from './engine';
export type Training={type:string;abdomen?:boolean;quality:number;duration:number;note:string;scale?:5|10};
export type Visit={id:string;date:string;company:string;outcome:'owner'|'manager'|'time'|'nothing';contact:string;nextStep:string;note:string;reviewed:boolean;reviewNote?:string};
export type Meeting={id:string;visitId?:string;date:string;company:string;outcome:'scheduled'|'won'|'followup'|'lost'|'cancelled';note:string;reviewed:boolean;reviewNote?:string};
export type Horizon={years:3|5|10|20;description:string;photos:{id:string;src:string;caption:string;createdAt:string}[]};
export function trainingGrade(t:Training):number {return t.scale===10?t.quality:0;}
export function validTraining(t:Training):boolean{return t.scale!==10||(Number.isInteger(t.quality)&&t.quality>=1&&t.quality<=10);}
export function before2330(time?:string):boolean{return !!time&&/^\d{2}:\d{2}$/.test(time)&&time>='12:00'&&time<'23:30';}
export function operationalEntries(week:Week):Entry[]{
 const entries=structuredClone(week.entries);
 const get=(date:string)=>{let e=entries.find(e=>e.date===date);if(!e){e={date,leads:0,visits:0,scheduled:0,calls:0,reviews:0,minutes:0,updates:false,makers:false,daily:false,trainings:[]};entries.push(e);}return e;};
 for(const date of new Set([...(week.visitRecords||[]).map(v=>v.date),...(week.meetings||[]).map(m=>m.date)])){
  const e=get(date),visits=(week.visitRecords||[]).filter(v=>v.date===date),meetings=(week.meetings||[]).filter(m=>m.date===date);
  const done=meetings.filter(m=>!['scheduled','cancelled'].includes(m.outcome));
  e.visits=Math.max(e.visits,visits.length);e.scheduled=Math.max(e.scheduled,meetings.filter(m=>m.outcome==='scheduled').length);e.calls=Math.max(e.calls,done.length);
  if(done.length){e.sales=Math.max(e.sales||0,done.filter(m=>m.outcome==='won').length);e.channels={...e.channels,presential:{...e.channels?.presential,calls:Math.max(e.channels?.presential?.calls||0,done.length),sales:Math.max(e.channels?.presential?.sales||0,done.filter(m=>m.outcome==='won').length)}};}
  e.reviews=Math.max(e.reviews,(e.onlineReviews||0)+done.filter(m=>m.reviewed).length);
  e.visitReviews=Math.max(e.visitReviews||0,visits.filter(v=>v.reviewed).length);
 }
 for(const e of entries)e.reviews=Math.max(e.reviews,e.onlineReviews||0);
 return entries;
}
export const addedMetrics=[
 {id:'followups',name:'Follow-ups revisados e executados',area:'Comercial',unit:'dias',target:7,weight:2,active:true},
 {id:'sleep',name:'Dormir antes de 23h30',area:'Disciplina',unit:'dias',target:7,weight:2,active:true},
 {id:'p4',name:'Atividades P4 concluídas na semana',area:'Disciplina',unit:'atividades',target:0,weight:2,active:true},
 {id:'commitments',name:'Compromissos cumpridos na semana',area:'Disciplina',unit:'fechamento',target:1,weight:1,active:true}
];
