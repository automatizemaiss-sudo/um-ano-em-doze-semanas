import commercialPlan from '../config/commercial-plan.json' with {type:'json'};
import type {Period,Week,Metric} from './engine';
export type StudySession={id:string;date:string;minutes:number;stage:number|null;note:string};
export type StudyStage={status:'Não iniciado'|'Em andamento'|'Concluído';level:''|'Noção'|'Aplicação'|'Domínio prático';evidence:string;note:string;demonstrated:boolean};
export type StudyMaterial={id:string;title:string;url:string;source:string;subject:string;week:number;status:'Pendente'|'Em estudo'|'Concluído'};
export type BodyRecord={id:string;date:string;weight?:number;waist?:number;arm?:number;bicepsRightRelaxed?:number;bicepsLeftRelaxed?:number;bicepsRightContracted?:number;bicepsLeftContracted?:number;quadricepsRightRelaxed?:number;quadricepsLeftRelaxed?:number;quadricepsRightContracted?:number;quadricepsLeftContracted?:number;hip?:number;photos?:{front?:string;side?:string;back?:string}};
export const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const syllabus=[
 ['Fundamentos essenciais de LLMs e aprofundamento no X','Explicar os componentes e o funcionamento de uma requisição e aprofundar um tema selecionado no X.'],
 ['Engenharia de contexto — fundamentos','Entender composição, seleção e organização do contexto.'],
 ['Engenharia de contexto — aplicação','Modificar contextos e comparar resultados.'],
 ['RAG — ingestão','Entender documentos, chunks, embeddings e armazenamento.'],
 ['RAG — recuperação','Compreender buscas, filtros, recuperação e geração.'],
 ['Ferramentas e orquestração — fundamentos','Entender componentes e responsabilidades, identificar problemas e comparar configurações.'],
 ['Ferramentas e orquestração — ação','Implementar execução, roteamento, tratamento de falhas e responsabilidades.'],
 ['Escolha de modelos, testes, diagnóstico e manutenção','Comparar custos, latência e qualidade; realizar testes e diagnosticar falhas.'],
 ['System Design — fundamentos','Compreender arquitetura, componentes, interfaces e fluxos de dados.'],
 ['System Design — aplicação','Projetar e justificar tecnicamente a arquitetura de uma solução.']
];
export const emptyStage=():StudyStage=>({status:'Não iniciado',level:'',evidence:'',note:'',demonstrated:false});
export const cap=(v:number)=>Math.max(0,Math.min(1,v));
export function trainingPoints(strength:number,cardio:number){return Math.min(50,cap(strength/3)*22.5+cap(cardio)*15+Number(strength>=4||cardio>=2)*12.5);}
export function isCardio(type:string){return ['Corrida','Bicicleta','Caminhada cardiovascular estruturada','Futsal','Aeróbico estruturado'].includes(type);}
export function studyUpdates(week:Week){
 const dates=week.studyDates??Array.from({length:7},(_,i)=>String(i));
 let done=0,expected=dates.length*3;
 for(const e of week.entries){if(week.studyDates&&!dates.includes(e.date))continue;for(const key of ['news','superhuman','instagram'] as const){const value=e.newsUpdates?.[key];if(value==='Sem edição'&&key!=='instagram')expected--;else if(value==='Concluído')done++;}}
 const daily=expected>0?cap(done/expected):null;
 const x=week.xSession?.done?1:0;
 return {done,expected,daily,score:daily===null?x:daily*.7+x*.3};
}
// Each week owns its rule version. Existing snapshots are never rewritten by later versions.
export function applyStrategy(period:Period){
 if(period.strategyVersion===1)return;
 for(let i=2;i<period.weeks.length;i++){
  const w=period.weeks[i];
  if(w.strategyVersion===1)continue;
  const first=new Date(period.start).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  if(first!=='2026-10-06')continue;
  w.strategyVersion=1;
  w.metrics=w.metrics.filter(m=>!['Estudo','Saúde'].includes(m.area));
  const add=(id:string,name:string,area:string,unit:string,target:number,weight:number)=>w.metrics.push({id,name,area,unit,target,weight,active:true});
  add('minutes','Horas líquidas de estudo','Estudo','min',300,70);
  add('studyUpdates','Atualizações','Estudo','%',100,30);
  add('nutrition','Alimentação cumprida','Saúde','dias',6,40);
  add('trainingCombined','Treinamento (musculação + cardio)','Saúde','pontos',50,50);
  add('abdomen','Abdômen','Saúde','sessões',2,10);
  // Commercial records require a validated integration before a definitive score.
  w.commercialVersion=1;
  const definitions:[string,string,number,number][]=[['leads','Prospecção online',i<4?40:(w.metrics.find(m=>m.id==='leads')?.target===60?commercialPlan[i].leads:w.metrics.find(m=>m.id==='leads')?.target??commercialPlan[i].leads),3],['visits','Prospecção presencial',i<4?12:(w.metrics.find(m=>m.id==='visits')?.target===8?commercialPlan[i].visits:w.metrics.find(m=>m.id==='visits')?.target??commercialPlan[i].visits),3],['followups','Follow-ups previstos concluídos',0,3],['visitReviews','Revisões presenciais',0,1],['meetingReviews','Revisões de reuniões/apresentações',0,1],['commercialWeekly','Revisão semanal comercial',1,1]];
  w.metrics=w.metrics.filter(m=>m.area!=='Comercial'||['scheduled','calls'].includes(m.id));
  for(const [id,name,target,weight] of definitions)add(id,name,'Comercial',id==='commercialWeekly'?'revisão':'atividades',target,weight);
  w.metrics.sort((a,b)=>{const order=['leads','visits','scheduled','calls'];return (order.includes(a.id)?order.indexOf(a.id):99)-(order.includes(b.id)?order.indexOf(b.id):99);});
 }
 period.strategyVersion=1;
}
export function revisedTotals(week:Week,total:Record<string,number>){
 if(week.strategyVersion!==1)return;
 const sessions=week.studySessions??[];
 total.minutes=(total.minutes||0)+sessions.reduce((s,e)=>s+e.minutes,0);
 total.studyUpdates=studyUpdates(week).score*100;
 total.nutrition=week.entries.filter(e=>e.nutrition===true).length;
 total.caloriesMet=week.entries.filter(e=>e.caloriesMet??(e.nutrition===true)).length;
 total.proteinMet=week.entries.filter(e=>e.proteinMet??(e.nutrition===true)).length;
 const ts=week.entries.flatMap(e=>e.trainings);
 total.strength=ts.filter(t=>t.type==='Musculação').length;
 total.cardio=ts.filter(t=>isCardio(t.type)).length;
 total.trainingCombined=trainingPoints(total.strength,total.cardio);
 total.abdomen=week.entries.reduce((s,e)=>s+(e.abdomenSessions||0)+e.trainings.filter(t=>t.abdomen).length,0);
 total.commercialWeekly=Number(week.reviewed);
 total.meetingReviews=(week.meetings||[]).filter(m=>!['scheduled','cancelled'].includes(m.outcome)&&m.reviewed).length;
 total.visitReviews=(week.visitRecords||[]).filter(v=>v.reviewed).length;
}
