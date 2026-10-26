'use client';
import {manualCommercialTotals,weekDates,type Entry,type Period} from '../lib/engine';

const fields=[['visits','Prospecções presenciais · novas empresas'],['followupsRequired','Follow-ups necessários'],['followupsCompleted','Follow-ups feitos'],['scheduled','Reuniões agendadas'],['calls','Reuniões realizadas']] as const;
export function ManualCommercialEntry({entry,setEntry}:{entry:Entry;setEntry:(entry:Entry)=>void}){
 return <><div className="form-grid">{fields.map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="1" value={entry[key]??0} onChange={e=>setEntry({...entry,[key]:Math.max(0,Math.trunc(Number(e.target.value)||0))})}/></label>)}</div><p className="quality-note">Prospecções: conte novas empresas distintas com contato efetivo e resultado ou encaminhamento registrado. Retornos e tentativas sem contato não entram nessa contagem.</p><p className="quality-note">Necessários: total que precisava fazer neste dia, incluindo os já feitos. Feitos: total realizado neste dia. Agendadas: novos agendamentos feitos neste dia, mesmo que a reunião aconteça depois. Realizadas: apenas as que aconteceram neste dia, sem cancelamentos. Reuniões ficam fora do score.</p></>;
}
export function ManualCommercialSummary({period,index,scope,now}:{period:Period;index:number;scope:string;now:number}){
 const today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const weeks=period.weeks.filter((w,i)=>w.manualCommercialVersion===1&&(scope==='period'?weekDates(period,i)[0]<=today:i===index));
 const entries=weeks.flatMap(w=>w.entries.filter(e=>scope==='day'?e.date===today:e.date<=today));
 const total=manualCommercialTotals({entries});
 return <section className="card"><div className="section-title"><h2>Resultados comerciais registrados</h2></div><p>Totais dos registros manuais no intervalo selecionado. Reuniões agendadas e realizadas são acompanhamento, fora do score.</p><div className="quality-grid">{[['Novas empresas',total.visits],['Follow-ups necessários',total.followupsRequired],['Follow-ups feitos',total.followups],['Reuniões agendadas',total.scheduled],['Reuniões realizadas',total.calls]].map(([label,value])=><div key={label}><span>{label}</span><strong>{entries.length?value:'Sem registro'}</strong></div>)}</div></section>;
}
