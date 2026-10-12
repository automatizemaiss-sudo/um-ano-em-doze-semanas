export const areas = ['Comercial','Saúde','Estudo','Disciplina'];
export type Metric = {id:string; name:string; area:string; unit:string; target:number; weight:number; active:boolean};
export type Entry = {date:string; leads:number; visits:number; scheduled:number; calls:number; reviews:number; minutes:number; updates:boolean; makers:boolean; daily:boolean; trainings:{type:string; quality:number; duration:number; note:string}[]};
export type Week = {metrics:Metric[]; weights:Record<string,number>; entries:Entry[]; reviewed:boolean; note:string};
export type Goal = {name:string; area:string; value:number; target:number; initial:number; unit:string; stock:boolean};
export type Life = {name:string; vision:string; initial:number|null; final:number|null};
export type Period = {id:string; name:string; start:string; end:string; weeks:Week[]; goals:Goal[]; life:Life[]; strategies:string; closed:boolean};
export type State = {periods:Period[]; selected:string; defaults:Metric[]; weights:Record<string,number>; green:number; yellow:number};
export const defaults:Metric[] = [
 ['leads','Leads prospectados online','Comercial','leads',60,3],['visits','Prospecções presenciais','Comercial','empresas',8,2],['scheduled','Calls agendadas','Comercial','calls',5,2],['calls','Calls realizadas','Comercial','calls',4,2],['reviews','Revisões de call','Comercial','revisões',0,1],
 ['trainings','Treinos realizados','Saúde','treinos',5,1],['strength','Treinos de musculação','Saúde','treinos',3,1],['quality','Treinos com nota ≥ 4','Saúde','treinos',3,1],['perfect','Treinos com nota 5','Saúde','treinos',1,1],
 ['minutes','Horas líquidas de estudo','Estudo','min',300,2],['updates','Atualizações do dia','Estudo','dias',7,1],['makers','AI Makers','Estudo','dias',7,1],['daily','Revisão da programação','Disciplina','dias',7,1],['weekly','Revisão semanal','Disciplina','revisão',1,1]
].map(([id,name,area,unit,target,weight])=>({id:String(id),name:String(name),area:String(area),unit:String(unit),target:Number(target),weight:Number(weight),active:true}));
export const weights={Comercial:50,'Saúde':20,Estudo:15,Disciplina:15};
export const lifeDefaults:Life[]=[
 ['Espiritual','Quero viver “aleluiado”.',6],['Relacionamentos','Quero ter uma esposa e 4 filhos. Melhorar a forma como me relaciono, conquisto e lido com esta fase, acreditando que minha esposa chegará no momento correto.',7],['Familiar','Ter uma relação melhor dentro de casa e dedicar mais atenção à minha família.',6],['Financeira','Ganhar R$10.000 por mês com tranquilidade. Buscar R$3 milhões de patrimônio para renda passiva; no curto prazo, R$50.000.',2],['Estilo de vida','Praticar esporte com sol, ser muito estudioso e, depois dos 30, decidir quantas horas trabalhar.',4],['Saúde','Ótimo shape e longevidade: chegar aos 100 anos ou mais com qualidade de vida. Peso inicial aproximado: 70,25 kg.',6],['Social','Manter meus amigos por toda a vida, agir com lealdade e melhorar minha comunicação com novas pessoas.',8],['Intelectual','Ser formado, com uma bagagem muito maior que a formação acadêmica. Ser inteligente, curioso e estudioso.',6],['Emocional','Quero ser um cara pleno.',null]
].map(([name,vision,initial])=>({name:String(name),vision:String(vision),initial:initial===null?null:Number(initial),final:null}));
export function emptyEntry(date:string):Entry {return {date,leads:0,visits:0,scheduled:0,calls:0,reviews:0,minutes:0,updates:false,makers:false,daily:false,trainings:[]};}
export function makePeriod(name:string,start:string,metrics=defaults,areaWeights:Record<string,number>=weights):Period {
 const end=new Date(new Date(start).getTime()+84*86400000).toISOString();
 return {id:crypto.randomUUID(),name,start,end,closed:false,weeks:Array.from({length:12},()=>({metrics:structuredClone(metrics),weights:{...areaWeights},entries:[],reviewed:false,note:''})),goals:[{name:'Clientes fechados',area:'Empresa',value:0,target:8,initial:0,unit:'clientes',stock:false},{name:'Caixa da empresa',area:'Empresa',value:0,target:16000,initial:0,unit:'R$',stock:true},{name:'Receita nova',area:'Empresa',value:0,target:0,initial:0,unit:'R$',stock:false},{name:'Investimentos',area:'Pessoal',value:24225,target:25000,initial:24225,unit:'R$',stock:true},{name:'Peso corporal',area:'Saúde',value:70.25,target:70,initial:70.25,unit:'kg',stock:true}],life:structuredClone(lifeDefaults),strategies:'Não distribuir lucro.\nViver apenas com pró-labore de R$3.200.\nProspectar consistentemente durante o período.'};
}
export function virtualTime(period:Period,now:number) {
 const start=Date.parse(period.start),end=Date.parse(period.end);const progress=period.closed?1:Math.max(0,Math.min(1,(now-start)/(end-start)));
 const virtual=new Date(Date.UTC(2025,0,1)+Math.min(progress*365*86400000,365*86400000-60000));
 return {progress,virtual,future:now<start,ended:period.closed||now>=end,week:Math.min(12,Math.max(1,Math.floor((now-start)/604800000)+1)),day:Math.min(84,Math.max(1,Math.floor((now-start)/86400000)+1)),remaining:Math.max(0,Math.ceil((end-now)/86400000)),virtualDays:progress*365};
}
export function scoreWeek(week:Week) {
 const total:Record<string,number>={weekly:week.reviewed?1:0};
 for(const e of week.entries){for(const k of ['leads','visits','scheduled','calls','reviews','minutes','updates','makers','daily'])total[k]=(total[k]||0)+Number(e[k as keyof Entry]);for(const t of e.trainings){total.trainings=(total.trainings||0)+1;total.strength=(total.strength||0)+(t.type==='Musculação'?1:0);total.quality=(total.quality||0)+(t.quality>=4?1:0);total.perfect=(total.perfect||0)+(t.quality===5?1:0);}}
 const metrics=week.metrics.filter(m=>m.active).map(m=>{const target=m.id==='reviews'?(total.calls||0):m.target;const value=total[m.id]||0;return {...m,target,value,ratio:target>0?value/target:null};});
 const scores:Record<string,number|null>={};for(const area of areas){const applicable=metrics.filter(m=>m.area===area&&m.ratio!==null&&m.weight>0);scores[area]=applicable.length?applicable.reduce((s,m)=>s+Math.min(1,m.ratio!)*m.weight,0)/applicable.reduce((s,m)=>s+m.weight,0):null;}
 const applicable=areas.filter(a=>scores[a]!==null&&week.weights[a]>0);const overall=applicable.length?applicable.reduce((s,a)=>s+scores[a]!*week.weights[a],0)/applicable.reduce((s,a)=>s+week.weights[a],0):null;
 return {metrics,scores,overall,total};
}
export function projection(goal:Goal,progress:number){if(progress<=0||goal.unit==='kg')return null;return goal.stock?goal.initial+(goal.value-goal.initial)/progress:goal.value/progress;}
export function initialState():State {const p=makePeriod('Período 1','2026-10-05T00:00:00-03:00');p.name='Período demonstrativo';p.goals[0].value=2;p.goals[1].value=5200;p.goals[2].value=6400;for(let w=0;w<2;w++){for(let d=0;d<7;d++){const e=emptyEntry(new Date(Date.parse(p.start)+(w*7+d)*86400000).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}));e.leads=[20,0,18,0,16,0,0][d];e.visits=d===1||d===3?3:0;e.scheduled=d<4?1:0;e.calls=d<3?1:0;e.reviews=d<2?1:0;e.minutes=d<5?54:0;e.updates=d!==5;e.makers=d<5;e.daily=d!==6;if(d<5)e.trainings=[{type:d<3?'Musculação':'Corrida',quality:d===0?5:d<3?4:3,duration:50,note:''}];p.weeks[w].entries.push(e);}p.weeks[w].reviewed=w===0;}
 return {periods:[p],selected:p.id,defaults:structuredClone(defaults),weights:{...weights},green:85,yellow:70};}
