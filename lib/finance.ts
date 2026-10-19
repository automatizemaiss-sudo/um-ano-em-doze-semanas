import {weekBounds,weekDates,weekIndexForDate,type Period,type Goal} from './engine.ts';
export type FinancePayment={id:string;date:string;amount:number;note:string};
export type FinanceContract={id:string;date:string;name:string};
export type FinanceMonth={
 revenue:number|null;received:number|null;operatingCosts:number|null;operatingPaid:number|null;
 ownerCharges:number|null;ownerChargesPaid:number|null;cashAvailable:number|null;ownerDebt:number|null;
 obligations:number|null;payments:FinancePayment[];note:string;closedAt?:string;policySnapshot?:FinancePolicy;
};
export type FinancePolicy={workingCapital:number|null;obligationScope:''|'all'|'month';initialOperatingCash:number|null};
export type FinanceState={version:1;legacyGoals:Goal[];legacyStrategies:string;legacyClients:number|null;months:Record<number,FinanceMonth>;contracts:FinanceContract[];opening:{revenue:number|null;received:number|null;costs:number|null;paid:number|null};policy:FinancePolicy};
export const financeObjective='Construir uma operação comercialmente validada e financeiramente sustentável, capaz de remunerar seu proprietário em R$ 3.200 mensais até dezembro de 2026.';
export const emptyFinanceMonth=():FinanceMonth=>({revenue:null,received:null,operatingCosts:null,operatingPaid:null,ownerCharges:null,ownerChargesPaid:null,cashAvailable:null,ownerDebt:null,obligations:null,payments:[],note:''});
export function financeState(p:Period):FinanceState{
 if(p.finance)return p.finance;
 const clients=p.goals.find(g=>g.name==='Clientes fechados');
 return {version:1,legacyGoals:structuredClone(p.goals),legacyStrategies:p.strategies,legacyClients:clients&&clients.confirmed!==false?clients.value:null,months:{},contracts:[],opening:{revenue:null,received:null,costs:null,paid:null},policy:{workingCapital:null,obligationScope:'',initialOperatingCash:null}};
}
export const cents=(n:number)=>Math.round((n+Number.EPSILON)*100);
export const currency=(n:number)=>cents(n)/100;
function sum(values:number[]){return values.reduce((s,n)=>s+cents(n),0)/100;}
export function payBand(result:number):number{return cents(result)<300000?0:cents(result)<520000?2000:3200;}
export function monthFinancials(m:FinanceMonth){
 const paid=sum(m.payments.map(p=>p.amount));
 const resultBefore=m.revenue===null||m.operatingCosts===null||m.ownerCharges===null?null:currency(m.revenue-m.operatingCosts-m.ownerCharges);
 const costs=m.operatingCosts===null||m.ownerCharges===null?null:sum([m.operatingCosts,m.ownerCharges,paid]);
 const profit=m.revenue===null||costs===null?null:currency(m.revenue-costs);
 const netCash=m.cashAvailable===null||m.ownerDebt===null?null:currency(m.cashAvailable-m.ownerDebt);
 return {paid,resultBefore,costs,profit,netCash};
}
export function operationalCash(finance:FinanceState,index:number):number|null{
 const policy=finance.months[index]?.policySnapshot??finance.policy;
 if(policy.initialOperatingCash===null)return null;
 let balance=cents(policy.initialOperatingCash);
 // Opening balance is explicitly the company's own operating cash at the beginning of week 3.
 // Loans and contributions never enter this source-of-funds calculation.
 for(let i=2;i<=index;i++){
  const m=finance.months[i];
  if(!m||m.received===null||m.operatingPaid===null||m.ownerChargesPaid===null)return null;
  balance+=cents(m.received)-cents(m.operatingPaid)-cents(m.ownerChargesPaid)-m.payments.reduce((s,p)=>s+cents(p.amount),0);
 }
 return balance/100;
}
export function remuneration(finance:FinanceState,index:number){
 const m=finance.months[index]??emptyFinanceMonth(),policy=m.policySnapshot??finance.policy,result=monthFinancials(m),band=result.resultBefore===null?null:payBand(result.resultBefore),remaining=band===null?null:Math.max(0,currency(band-result.paid)),ownCash=operationalCash(finance,index);
 let status:'historical'|'missing'|'result'|'cash'|'released'|'paid'='missing';
 let available:number|null=null,authorized:number|null=null;
 if(index<2)status='historical';
 else if(band!==null&&band===0){status='result';authorized=0;}

 else if(band!==null&&result.netCash!==null&&ownCash!==null&&m.obligations!==null&&m.ownerCharges!==null&&m.ownerChargesPaid!==null&&policy.workingCapital!==null&&policy.obligationScope){
  const chargesOutstanding=Math.max(0,currency(m.ownerCharges-m.ownerChargesPaid));
  available=currency(Math.min(result.netCash,ownCash)-m.obligations-policy.workingCapital-chargesOutstanding);
  status=cents(available)>=cents(remaining!)?(remaining===0?'paid':'released'):'cash';authorized=status==='released'?remaining:0;
 }
 return {...result,band,remaining,ownCash,available,authorized,status,overpaid:band===null?null:Math.max(0,currency(result.paid-band))};
}
export function financeTotals(finance:FinanceState,index:number){
 const scope=Array.from({length:Math.max(0,index-1)},(_,i)=>finance.months[i+2]);
 const aggregate=(get:(m:FinanceMonth)=>number|null)=>scope.length&&scope.every(m=>m&&get(m)!==null)?sum(scope.map(m=>get(m)!)):null;
 const addOpening=(value:number|null,opening:number|null)=>value===null||opening===null?null:sum([value,opening]);
 const revenue=addOpening(aggregate(m=>m.revenue),finance.opening.revenue),costs=addOpening(aggregate(m=>monthFinancials(m).costs),finance.opening.costs);
 return {revenue,received:addOpening(aggregate(m=>m.received),finance.opening.received),costs,profit:revenue===null||costs===null?null:currency(revenue-costs),paid:addOpening(aggregate(m=>monthFinancials(m).paid),finance.opening.paid),knownRevenue:sum(scope.filter(Boolean).map(m=>m.revenue??0)),missingMonths:scope.filter(m=>!m||monthFinancials(m).profit===null).length};
}
export function financeEditable(p:Period,index:number,now=Date.now()):boolean{return !p.closed&&index>=2&&!p.finance?.months[index]?.closedAt&&now>=Date.parse(weekBounds(p,index).start)&&now<Date.parse(weekBounds(p,index).end);}
export function setFinanceMonth(p:Period,index:number,m:FinanceMonth,now=Date.now()){
 if(!financeEditable(p,index,now))throw new Error('Mês operacional encerrado, futuro ou histórico: dados preservados.');
 for(const value of [m.revenue,m.received,m.operatingCosts,m.operatingPaid,m.ownerCharges,m.ownerChargesPaid,m.cashAvailable,m.ownerDebt,m.obligations])if(value!==null&&(!Number.isFinite(value)||value<0||Math.abs(currency(value)-value)>.000001))throw new Error('Informe valores não negativos com até duas casas decimais.');
 if(m.ownerCharges!==null&&m.ownerChargesPaid!==null&&m.ownerChargesPaid>m.ownerCharges)throw new Error('Encargos pagos não podem exceder os encargos registrados neste mês.');
 p.finance=structuredClone(financeState(p));p.finance.months[index]={...structuredClone(m),policySnapshot:structuredClone(p.finance.policy)};
}
export function addFinancePayment(p:Period,index:number,payment:FinancePayment,now=Date.now()){
 if(weekIndexForDate(p,payment.date)!==index||!weekDates(p,index).includes(payment.date)||payment.date>new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}))throw new Error('A data do pagamento deve pertencer ao mês selecionado e não pode ser futura.');
 if(!Number.isFinite(payment.amount)||payment.amount<=0||currency(payment.amount)!==payment.amount)throw new Error('Informe um pagamento positivo com até duas casas decimais.');
 const m=structuredClone(p.finance?.months[index]??emptyFinanceMonth());
 if(m.payments.some(p=>p.id===payment.id))throw new Error('Pagamento já registrado.');
 if(m.cashAvailable!==null){if(cents(payment.amount)>cents(m.cashAvailable))throw new Error('Atualize o caixa disponível antes de registrar um pagamento superior ao saldo informado.');m.cashAvailable=currency(m.cashAvailable-payment.amount);}
 m.payments.push(payment);setFinanceMonth(p,index,m,now);
}
export function financeClients(finance:FinanceState,asOf:string){return {historical:finance.legacyClients,newCount:finance.contracts.filter(c=>c.date<=asOf).length,total:finance.legacyClients===null?null:finance.legacyClients+finance.contracts.filter(c=>c.date<=asOf).length};}
