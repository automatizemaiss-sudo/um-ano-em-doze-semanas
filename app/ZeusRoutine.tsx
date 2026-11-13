'use client';
import {Plus} from 'lucide-react';
import type {Entry} from '../lib/engine';

const fields=[['leads','Leads Prospectados'],['scheduled','Reuniões agendadas'],['calls','Reuniões Feitas'],['sales','Vendas'],['followupsRequired','Follow-ups necessários'],['followupsCompleted','Follow-ups feitos']] as const;

export function ZeusRoutine({entry,setEntry}:{entry:Entry;setEntry:(entry:Entry)=>void}){
 if(!entry.zeus)return <button type="button" className="text-button" onClick={()=>setEntry({...entry,zeus:{leads:0,scheduled:0,calls:0,sales:0,followupsRequired:0,followupsCompleted:0}})}><Plus size={14}/> Registrar Rotina Zeus</button>;
 return <section aria-label="Rotina Zeus"><h3>Rotina Zeus</h3><p className="quality-note">Registro opcional, sem metas e fora do score.</p><div className="form-grid">{fields.map(([key,label])=><label key={key}>{label}<input type="number" min="0" step="1" value={entry.zeus![key]??0} onChange={e=>setEntry({...entry,zeus:{...entry.zeus!,[key]:Math.max(0,Math.trunc(Number(e.target.value)||0))}})}/></label>)}</div><button type="button" className="text-button" onClick={()=>{const next={...entry};delete next.zeus;setEntry(next);}}>Remover rotina Zeus</button></section>;
}

export function ZeusSummary({entries}:{entries:Entry[]}){
 return <section className="card"><div className="section-title"><h2>Zeus · resultados registrados</h2></div><p>Totais do intervalo selecionado.</p><div className="quality-grid">{fields.map(([key,label])=><div key={key}><span>{label}</span><strong>{entries.reduce((sum,entry)=>sum+(entry.zeus?.[key]??0),0)}</strong></div>)}</div></section>;
}
