'use client';
import type {Entry} from '../lib/engine';
type XSession={done:boolean;note:string};
export function DailyStudyUpdates({entry,setEntry,xSession,setXSession}:{entry:Entry;setEntry:(e:Entry)=>void;xSession:XSession;setXSession:(x:XSession)=>void}){
 return <section><h3>Atualizações</h3><div className="form-grid">{([['news','The News'],['superhuman','Superhuman AI'],['instagram','Instagram profissional']] as const).map(([key,label])=><label key={key}>{label}<select value={entry.newsUpdates?.[key]??'Não realizado'} onChange={e=>setEntry({...entry,newsUpdates:{...entry.newsUpdates,[key]:e.target.value as NonNullable<Entry['newsUpdates']>[typeof key]}})}><option>Não realizado</option><option>Concluído</option>{key!=='instagram'&&<option>Sem edição</option>}</select></label>)}</div><h4>X · sessão semanal</h4><label className="check-label"><input type="checkbox" checked={xSession.done} onChange={e=>setXSession({...xSession,done:e.target.checked})}/> Sessão do X realizada nesta semana</label><label>Observações do X<textarea value={xSession.note} onChange={e=>setXSession({...xSession,note:e.target.value})}/></label></section>;
}
