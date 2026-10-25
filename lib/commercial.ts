import type {Period,Week} from './engine';
export type CommercialRow={id:string;origin:string;name:string;kind:string;activity:string;number:string;context:string;original:string;due:string;done:string;recorded:string;status:string;stage:string;action:string;first:string;response:string;decisor:string;history:string;note:string};
export type CommercialData={rows:CommercialRow[];syncedAt:string;warnings:string[];error?:string};
export type CommercialHours={id:string;date:string;channel:'Leads'|'Presencial';minutes:number;note:string};
export function csvRows(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('CSV inválido: aspas não fechadas.');row.push(cell);if(row.some(c=>c.trim()))rows.push(row);return rows;
}
function date(value:string){
 const v=value.trim();if(!v)return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
 const br=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(br)return `${br[3]}-${br[2]}-${br[1]}`;
 if(/^\d+(\.\d+)?$/.test(v))return new Date(Date.UTC(1899,11,30)+Math.floor(Number(v))*86400000).toISOString().slice(0,10);
 throw new Error(`Data ambígua na fonte: ${v}. Use datas sem horário (dd/mm/aaaa).`);
}
export function parseCommercial(text:string):CommercialData{
 const rows=csvRows(text),head=rows.shift()?.map(c=>c.replace(/^\uFEFF/,'').trim())||[],offset=head.indexOf('Origem');
 const headers=['Origem','Nome','Tipo de registro','Atividade','Número','Contexto','Data prevista original','Data prevista atual','Data realizada','Data do registro'];
 if(offset<0||headers.some((h,i)=>head[offset+i]!==h))throw new Error('Exporte Resultados, com cabeçalhos na linha 1 e a base a partir de N. O bloco antigo não é aceito.');
 const warnings:string[]=[],seen=new Set<string>();
 const parsed:CommercialRow[]=[];
 for(const line of rows){const a=line.slice(offset);if(!a[0]&&!a[1])continue;if(!['Leads','Presencial'].includes(a[0])){warnings.push('Origem desconhecida: '+a[0]);continue;}
 const [origin,name,kind,activity,number,context]=a;
 const row:CommercialRow={id:'',origin,name,kind,activity,number:number||'',context:context||'',original:date(a[6]||''),due:date(a[7]||''),done:date(a[8]||''),recorded:date(a[9]||''),status:a[12]||'',stage:a[13]||'',action:a[14]||'',first:date(a[15]||''),response:date(a[16]||''),decisor:date(a[17]||''),history:a[18]||'',note:a[19]||''};
 if(!['Cadastro','Follow-up','Reunião','Evento','Etapa'].includes(kind)){warnings.push('Tipo desconhecido: '+kind);continue;}
 if(['Follow-up','Reunião'].includes(kind)&&!number)warnings.push(`${origin} · ${name}: ${kind} sem número estável; confirme a identificação na fonte.`);
 row.id=JSON.stringify([origin,name,kind,kind==='Cadastro'?'':kind==='Follow-up'||kind==='Reunião'?number||row.original:activity,kind==='Evento'||kind==='Etapa'?row.done:'']);
 if(seen.has(row.id)){warnings.push(`${origin} · ${name}: registro duplicado (${kind}); não agrupado.`);row.id+=':duplicate:'+parsed.length;}
 seen.add(row.id);
 if(!row.done&&kind==='Evento')warnings.push(`${origin} · ${name}: evento sem data realizada.`);
 if(row.context==='Confirmar contexto')warnings.push(`${origin} · ${name}: confirme o contexto do follow-up.`);
 parsed.push(row);
 }
 if(!parsed.some(r=>r.kind==='Cadastro'))throw new Error('A base não contém cadastros. Verifique se Resultados foi atualizado pelo script.');
 return {rows:parsed,syncedAt:new Date().toISOString(),warnings};
}
export function mergeCommercial(previous:CommercialData|undefined,next:CommercialData):CommercialData{
 const rows=new Map((previous?.rows||[]).map(r=>[r.id,r]));
 for(const r of next.rows){const old=rows.get(r.id);rows.set(r.id,old?{...r,original:old.original||r.original,done:r.done||old.done,first:r.first||old.first,response:r.response||old.response,decisor:r.decisor||old.decisor}:r);}
 return {...next,rows:[...rows.values()]};
}
export function commercialStats(w:Week){
 const rows=w.commercialRows||[],dates=w.commercialDates||[],inPeriod=(d:string)=>!!d&&dates.includes(d);
 const planned=rows.filter(r=>r.kind==='Follow-up'&&inPeriod(r.original||r.due));
 const completed=planned.filter(r=>inPeriod(r.done));
 const approaches=rows.filter(r=>r.kind==='Evento'&&r.activity==='Primeira abordagem'&&inPeriod(r.done));
 const company=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
 const firstByCompany=new Map<string,string>();
 if(w.simplificationVersion===1)for(const r of rows){
  if(r.origin!=='Presencial')continue;
  const date=r.kind==='Cadastro'?r.first:r.kind==='Evento'&&r.activity==='Primeira abordagem'&&r.note.trim()?r.done:'';
  if(date&&(!firstByCompany.has(company(r.name))||date<firstByCompany.get(company(r.name))!))firstByCompany.set(company(r.name),date);
 }
 const visits=approaches.filter(r=>r.origin==='Presencial'&&(w.simplificationVersion!==1||!!r.note.trim()&&r.done===firstByCompany.get(company(r.name)))),meetings=rows.filter(r=>r.kind==='Reunião'&&inPeriod(r.done));
 const agenda=rows.filter(r=>r.kind==='Reunião'&&inPeriod(r.original||r.due));
 const reviewed=w.commercialReviews||{};
 return {planned,completed,approaches,visits,meetings,agenda,online:new Set(approaches.filter(r=>r.origin==='Leads').map(r=>r.name)).size,presential:new Set(visits.map(r=>w.simplificationVersion===1?company(r.name):r.name)).size,visitReviewed:visits.filter(r=>reviewed[r.id]?.done).length,meetingReviewed:meetings.filter(r=>reviewed[r.id]?.done).length,onTime:completed.filter(r=>r.done<=(r.original||r.due)).length,late:completed.filter(r=>r.done>(r.original||r.due)).length,previous:rows.filter(r=>r.kind==='Follow-up'&&inPeriod(r.done)&&!inPeriod(r.original||r.due)),cancelled:planned.filter(r=>/cancelad/i.test(r.status)),rescheduled:planned.filter(r=>r.original&&r.due!==r.original)};
}
export function installCommercial(p:Period,next:CommercialData,now=Date.now()){
 p.commercialData=mergeCommercial(p.commercialData,next);
 // The caller supplies the shared calendar. Closed weekly snapshots are immutable.
 for(const w of p.weeks){if(w.manualCommercialVersion===1||w.commercialVersion!==1||!w.commercialDates?.length||Date.parse(w.commercialDates.at(-1)!+'T23:59:59.999-03:00')<now)continue;w.commercialRows=structuredClone(p.commercialData.rows);w.commercialConfirmed=!next.warnings.some(s=>/duplicado|sem número estável|evento sem data/.test(s));}
}
