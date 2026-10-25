'use client';
import {useState} from 'react';
import {weekDates,type Period} from '../lib/engine';
import {installCommercial,parseCommercial} from '../lib/commercial';

export function CommercialSource({period,update,message}:{period:Period;update:(fn:(p:Period)=>void)=>void;message:(text:string)=>void}){
 const [busy,setBusy]=useState(false);
 const data=period.commercialData;
 const install=(csv:string)=>{
  const next=parseCommercial(csv);
  update(p=>{p.weeks.forEach((w,i)=>{if(w.commercialVersion===1)w.commercialDates=weekDates(p,i);});installCommercial(p,next);});
  message('Fonte comercial atualizada. Semanas encerradas preservadas.');
 };
 const fail=(error:unknown)=>{
  const text=error instanceof Error?error.message:'Não foi possível ler a planilha.';
  update(p=>{if(p.commercialData)p.commercialData.error=text;});message(text);
 };
 return <section className="card"><h2>Dados comerciais da planilha</h2><p>Prospecções, resultados e follow-ups são registrados na planilha. Atualize a leitura para refletir as alterações no dashboard.</p><p>Última leitura: {data?new Date(data.syncedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Ainda não realizada'}.</p>{data?.error&&<p role="alert" className="amber">{data.error} Os últimos dados válidos foram preservados.</p>}<div className="heading-actions"><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch('/api/commercial');if(!response.ok){const error=await response.json();throw new Error(error.error||'Falha na leitura.');}install(await response.text());}catch(error){fail(error);}finally{setBusy(false);}}}>{busy?'Lendo planilha…':'Atualizar da planilha'}</button><label className="secondary import-label">Importar CSV de Resultados<input aria-label="Importar CSV de Resultados" type="file" accept=".csv,text/csv" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);try{install(await file.text());}catch(error){fail(error);}finally{setBusy(false);}}}/></label></div><p>Se o acesso direto exigir autenticação, exporte a aba Resultados como CSV e importe aqui.</p>{!!data?.warnings.length&&<details><summary>{data.warnings.length} registros a conferir</summary>{data.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</details>}</section>;
}
