/** Automação comercial v2 — arquivo completo para substituir a versão anterior.
 * Execute instalarAutomacaoComercial uma vez. Consulte docs/automacao-comercial.md.
 * Execuções: Registrar atividade ou Follow-up = Feito. Datas automáticas em São Paulo.
 * Data da atividade é saída; Data retroativa é entrada opcional, consumida uma vez.
 * Histórico em JSON na própria linha + cópias auditáveis na aba Histórico comercial.
 * Nunca deduz datas históricas pela etapa atual. Não envia mensagens externas.
 */
const COM = {
  version: 2,
  timezone: 'America/Sao_Paulo',
  auditSheet: 'Histórico comercial',
  auditHeaders: ['ID do registro','Registrado em (UTC)','Origem','ID comercial','Empresa','Operação','Data da atividade','Atividade registrada','Resultado / encaminhamento','Estado anterior (JSON)','Estado salvo (JSON)'],
  extra: ['Registrar atividade','Resultado / encaminhamento','Data retroativa','ID comercial (automático)'],
  activities: ['Abordagem com contato','Tentativa sem contato','Follow-up realizado','Resposta recebida','Contato com decisor','Reunião realizada','Proposta enviada','Cliente fechado'],
  sheets: ['Leads', 'Presencial'],
  resultCol: 14,
  resultHeaders: ['Origem','Nome','Tipo de registro','Atividade','Número','Contexto','Data prevista original','Data prevista atual','Data realizada','Data do registro','Semana prevista','Semana realizada','Situação','Etapa atual','Próxima ação','Primeira abordagem','Primeira resposta','Contato com decisor','Histórico de previsões','Observação'],
  added: {
    Leads: ['Follow-up','Contexto do follow-up','Número do follow-up','Data prevista da reunião','Data da atividade','Primeira resposta (automático)','Contato com decisor (automático)','Primeiro convite (automático)','Primeiro agendamento (automático)','Última reunião realizada (automático)','Proposta enviada (automático)','Fechamento (automático)','Encerramento (automático)','Histórico comercial (automático)','Alerta de registro (automático)'],
    Presencial: ['Follow-up','Contexto do follow-up','Número do follow-up','Próxima ação','Data prevista da reunião','Data da atividade','Primeira abordagem (automático)','Primeira resposta (automático)','Contato com decisor (automático)','Primeiro convite (automático)','Primeiro agendamento (automático)','Última reunião realizada (automático)','Proposta enviada (automático)','Fechamento (automático)','Encerramento (automático)','Histórico comercial (automático)','Alerta de registro (automático)']
  },
  stages: {
    Leads: ['A abordar','Aguardando resposta','Em conversa','Convite enviado','Call agendada','Call realizada','Proposta enviada','Contrato a enviar','Contrato enviado','Contrato assinado','Fechado','Encerrado','Perdido'],
    Presencial: ['Reserva','A visitar','Visitado','Contato do dono','Conversa com decisor','Follow-up','Reunião marcada','Reunião/apresentação realizada','Proposta enviada','Contrato a enviar','Contrato enviado','Contrato assinado','Fechado','Perdido']
  },
  actions: ['Fazer primeira abordagem','Visitar empresa','Fazer follow-up inicial','Dar continuidade à conversa','Entrar em contato com o decisor','Confirmar interesse e combinar horário','Enviar lembrete de reunião','Realizar reunião','Definir e enviar proposta','Fazer follow-up da proposta','Enviar contrato','Acompanhar assinatura','Iniciar onboarding','Confirmar contexto e fazer follow-up']
};

function comText(v) { return v == null ? '' : String(v).trim(); }
function comDate(v) {
  const text=comText(v);if(!text)return '';
  const br=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso=br?br[3]+'-'+br[2]+'-'+br[1]:text;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw new Error('Data inválida: '+text+'. Use dd/mm/aaaa.');
  const d=new Date(iso+'T12:00:00Z');
  if(isNaN(d.getTime())||d.toISOString().slice(0,10)!==iso)throw new Error('Data inválida: '+text);
  return iso;
}
function comContext(stage, firstResponse) {
  if (firstResponse || ['Visitado','Contato do dono','Em conversa','Conversa com decisor','Call agendada','Reunião marcada','Call realizada','Reunião realizada','Reunião/apresentação realizada','Proposta enviada','Contrato a enviar','Contrato enviado','Contrato assinado','Fechado'].indexOf(stage)>=0) return 'Após contato';
  if (stage === 'Aguardando resposta') return 'Sem resposta';
  return 'Confirmar contexto';
}
function comAction(stage, context) {
  const map = {'A abordar':'Fazer primeira abordagem','A visitar':'Visitar empresa','Reserva':'Visitar empresa','Aguardando resposta':'Fazer follow-up inicial','Em conversa':'Dar continuidade à conversa','Visitado':'Definir próximo contato','Contato do dono':'Entrar em contato com o decisor','Conversa com decisor':'Dar continuidade à conversa','Convite enviado':'Confirmar interesse e combinar horário','Call agendada':'Enviar lembrete de reunião','Reunião agendada':'Enviar lembrete de reunião','Reunião marcada':'Enviar lembrete de reunião','Call realizada':'Definir e enviar proposta','Reunião realizada':'Definir e enviar proposta','Reunião/apresentação realizada':'Definir e enviar proposta','Proposta enviada':'Fazer follow-up da proposta','Contrato a enviar':'Enviar contrato','Contrato enviado':'Acompanhar assinatura','Contrato assinado':'Iniciar onboarding','Fechado':'Iniciar onboarding','Perdido':'','Encerrado':''};
  if (stage === 'Follow-up') return context === 'Após contato' ? 'Dar continuidade à conversa' : context === 'Sem resposta' ? 'Fazer follow-up inicial' : 'Confirmar contexto e fazer follow-up';
  return map[stage] || '';
}

// Funções de negócio independentes do Google, verificáveis sem acessar a conta.
function comSeed(x) {
  const s={v:2,id:x.id||'',name:x.name,stage:x.stage||'',action:x.action||'',suggested:!x.action,
    first:x.first||'',response:x.response||'',decisor:x.decisor||'',stamps:{},tasks:[],events:[],meetings:[],
    current:null,meetingDate:x.meeting||'',status:x.status||'',context:x.context||'',number:'',
    lastActivity:'',alert:'',migrationWarnings:[]};
  if(x.first)s.events.push({type:'Primeira abordagem',done:x.first,recorded:'',source:'Data existente na planilha'});
  // Uma data de próxima ação pode ser visita ou reunião: não cria follow-up por si só.
  if(x.status==='A fazer') {
    const t=comTask(s,x.due||'',x.context||comContext(s.stage,s.response),'');
    t.legacy=true;
  }
  if(x.status==='Feito')s.migrationWarnings.push('Follow-up antigo marcado Feito sem data de execução confirmada.');
  if(x.meeting)s.meetings.push({n:1,original:x.meeting,due:x.meeting,done:'',created:'',changes:[],legacy:true});
  if(!x.first&&!['','Reserva','A visitar','A abordar'].includes(x.stage))
    s.migrationWarnings.push('Etapa anterior sem data da primeira abordagem; não foi atribuída ao dia da instalação.');
  return s;
}
function comUpgrade(previous,x) {
  const s=JSON.parse(JSON.stringify(previous));
  s.id=s.id||x.id||'';s.migrationWarnings=s.migrationWarnings||[];
  if(s.v!==2) {
    const t=s.current==null?null:s.tasks[s.current];
    if(t&&(t.due!==(x.due||'')||(t.done?'Feito':'A fazer')!==(x.status||''))) {
      s.migrationWarnings.push('Follow-up visível diverge do histórico anterior; conferir previsão e conclusão antigas.');
      // Preserva o compromisso antigo, sem tratá-lo como tarefa atual ao registrar o próximo.
      s.current=null;
    }
    if(s.stage!==x.stage)s.migrationWarnings.push('Etapa visível diverge do histórico anterior; data da mudança desconhecida.');
    s.stage=x.stage;s.action=x.action||'';s.status=x.status||'';s.context=x.context||'';
    s.meetingDate=x.meeting||'';
    s.lastActivity='';s.v=2;
  }
  s.name=x.name;return s;
}
function comTask(s,due,context,now) {
  const t={n:Math.max(0,...s.tasks.map(t=>Number(t.n)||0))+1,context:context||'',original:due,due:due,
    done:'',created:now,changes:[],cancelled:false};
  s.tasks.push(t);s.current=s.tasks.length-1;s.number=t.n;s.status='A fazer';s.context=t.context;
  return t;
}
function comEvolve(previous,x,today,now,fields) {
  const s=JSON.parse(JSON.stringify(previous));
  const touched=k=>fields.includes(k);
  const effective=comDate(x.retro)||today;
  if(effective>today)throw new Error('A execução não pode ter data futura. Use a data prevista para planejar.');
  s.alert='';s.name=x.name;
  const command=touched('activity')?x.activity:'';
  if(command&&!COM.activities.includes(command))throw new Error('Escolha uma atividade válida.');
  if(command==='Abordagem com contato'&&!comText(x.outcome))
    throw new Error('Preencha Resultado / encaminhamento antes de registrar a abordagem com contato.');
  let executed=false;
  const event=(type,note)=>{s.events.push({type:type,done:effective,recorded:now,source:note||''});executed=true;};
  const first=()=>{if(!s.first){s.first=effective;event('Primeira abordagem',x.outcome);}else event('Acompanhamento presencial',x.outcome);};
  const response=()=>{if(!s.response){s.response=effective;event('Primeira resposta',x.outcome);}};
  const milestone=type=>{event(type,x.outcome);if(!s.stamps[type])s.stamps[type]=effective;};
  const finishMeeting=()=>{
    let m=s.meetings[s.meetings.length-1];
    if(!m||m.done||m.cancelled){m={n:s.meetings.length+1,original:'',due:'',done:'',created:now,changes:[]};s.meetings.push(m);}
    m.done=effective;s.stamps['Reunião realizada']=effective;executed=true;
  };
  if(touched('action')){s.action=x.action;s.suggested=false;}
  if(touched('first')&&x.first!==s.first) {
    throw new Error('A primeira abordagem é histórica. Use Registrar atividade e, se necessário, Data retroativa.');
  }
  if(touched('stage')&&x.stage!==s.stage) {
    const old=s.stage;s.stage=x.stage;
    // Mudar uma etapa registra a mudança; não prova uma primeira visita efetiva.
    s.events.push({type:'Mudança de etapa',done:effective,recorded:now,from:old,to:x.stage});
    if(x.stage==='Aguardando resposta'&&x.origin==='Leads'&&!s.first){s.first=effective;event('Primeira abordagem',x.outcome);}
    if(x.stage==='Em conversa')response();
    if(x.stage==='Conversa com decisor'&&!s.decisor){s.decisor=effective;event('Contato com decisor',x.outcome);response();}
    const m={'Convite enviado':'Convite enviado','Proposta enviada':'Proposta enviada','Fechado':'Fechamento','Encerrado':'Encerramento','Perdido':'Encerramento'}[x.stage];
    if(m)milestone(m);
    if(['Call agendada','Reunião agendada','Reunião marcada'].includes(x.stage)) {
      milestone('Agendamento');
      const last=s.meetings[s.meetings.length-1];
      if(!last||last.done||last.cancelled)s.meetings.push({n:s.meetings.length+1,original:x.meeting||'',due:x.meeting||'',done:'',created:now,changes:[]});
    }
    if(['Call realizada','Reunião realizada','Reunião/apresentação realizada'].includes(x.stage))finishMeeting();
  }
  if(touched('meeting')&&x.meeting!==s.meetingDate) {
    let m=s.meetings[s.meetings.length-1];
    if(!m||m.done||m.cancelled) {
      if(x.meeting)s.meetings.push({n:s.meetings.length+1,original:x.meeting,due:x.meeting,done:'',created:now,changes:[]});
    } else {m.changes.push({from:m.due,to:x.meeting,at:now});m.due=x.meeting;if(!m.original)m.original=x.meeting;}
    s.meetingDate=x.meeting;
  }
  const finishFU=(touched('status')&&x.status==='Feito')||command==='Follow-up realizado';
  let t=s.current==null?null:s.tasks[s.current];
  const pending=t&&!t.done&&!t.cancelled;
  // Somente tarefa explicitamente planejada: a data genérica de próxima ação não é um follow-up.
  const planFU=touched('status')&&x.status==='A fazer'||touched('due')&&x.due&&x.status==='A fazer';
  if(planFU&&!pending&&!finishFU) {
    const due=t&&t.done&&!touched('due')?'':x.due||'';
    t=comTask(s,due,x.context||comContext(s.stage,s.response),now);
  }
  if(t&&!t.done&&!t.cancelled) {
    if(touched('due')&&x.due!==t.due){t.changes.push({from:t.due,to:x.due,at:now});t.due=x.due;if(!t.original)t.original=x.due;}
    if(touched('context'))t.context=x.context;
    s.context=t.context;s.number=t.n;
  }
  if(finishFU) {
    // Repetir Feito na tarefa já concluída não duplica; o comando explícito permite outro contato.
    if(!t||t.cancelled||(t.done&&command==='Follow-up realizado')) {
      t=comTask(s,'',x.context||comContext(s.stage,s.response),now);t.unplanned=true;
    }
    if(!t.done){t.done=effective;executed=true;}
    s.status='Feito';s.context=t.context;s.number=t.n;
  } else if(touched('status')&&x.status===''&&t&&!t.done) {
    t.cancelled=true;s.current=null;s.status='';s.number='';
  }
  if(command==='Abordagem com contato') {
    if(x.origin==='Presencial')first();
    else if(!s.first){s.first=effective;event('Primeira abordagem',x.outcome);}
    if(['','Reserva','A visitar','A abordar'].includes(s.stage))s.stage=x.origin==='Presencial'?'Visitado':'Aguardando resposta';
  }
  if(command==='Tentativa sem contato')event('Tentativa sem contato',x.outcome);
  if(command==='Resposta recebida') {if(s.response)event('Resposta recebida',x.outcome);else response();}
  if(command==='Contato com decisor'){if(!s.decisor)s.decisor=effective;event('Contato com decisor',x.outcome);response();}
  if(command==='Reunião realizada'&&!(touched('stage')&&['Call realizada','Reunião realizada','Reunião/apresentação realizada'].includes(x.stage))) {
    finishMeeting();s.stage=x.origin==='Leads'?'Call realizada':'Reunião/apresentação realizada';
  }
  if(command==='Proposta enviada'&&!(touched('stage')&&x.stage==='Proposta enviada')){milestone('Proposta enviada');s.stage='Proposta enviada';}
  if(command==='Cliente fechado'&&!(touched('stage')&&x.stage==='Fechado')){milestone('Fechamento');s.stage='Fechado';}
  const closed=['Encerrado','Perdido','Fechado'].includes(s.stage);
  if(closed&&(touched('stage')||command==='Cliente fechado')) {
    s.tasks.forEach(t=>{if(!t.done)t.cancelled=true;});s.meetings.forEach(m=>{if(!m.done)m.cancelled=true;});
    s.current=null;s.status='';s.number='';
  }
  if(!touched('action')&&(s.suggested||!s.action)) {s.action=comAction(s.stage,comContext(s.stage,s.response));s.suggested=true;}
  if(executed){s.lastActivity=effective;s.lastRecorded=now;s.lastActivityLabel=command||(finishFU?'Follow-up realizado':x.stage);s.lastOutcome=x.outcome||'';}
  s.consumeRetro=executed||touched('stage')&&x.stage!==previous.stage;
  const current=s.current==null?null:s.tasks[s.current];
  if(current&&!current.done&&!current.cancelled&&!current.due)s.alert='Informe a data prevista do follow-up.';
  if(s.migrationWarnings&&s.migrationWarnings.length)s.alert+=(s.alert?' ':'')+'Histórico anterior a conferir: '+s.migrationWarnings.join(' ');
  return s;
}
function comWeek(day) {
  if(!day)return '';const d=new Date(comDate(day)+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);
}
function comResultRows(origin,s) {
  const rows=[];
  function add(type,activity,n,context,original,due,done,recorded,status,changes,note) {
    // Data do registro é data de calendário; horário completo permanece no histórico/auditoria.
    const recordedDay=recorded?comStampDay(recorded):'';
    rows.push([origin,s.name,type,activity,n||'',context||'',original||'',due||'',done||'',recordedDay,
      comWeek(original||due),comWeek(done),status||'',s.stage,s.action,s.first,s.response,s.decisor,
      changes?JSON.stringify(changes):'',note||'']);
  }
  add('Cadastro','Situação atual',s.id,'','','','','','Atual',null,s.alert);
  s.tasks.forEach(t=>add('Follow-up','Follow-up',t.n,t.context,t.original,t.due,t.done,t.created,
    t.done?'Feito':t.cancelled?'Cancelado':'A fazer',t.changes,t.unplanned?'Realizado sem previsão anterior.':t.legacy?'Importado do histórico anterior.':''));
  s.meetings.forEach(m=>add('Reunião','Reunião/apresentação',m.n,'',m.original,m.due,m.done,m.created,
    m.done?'Realizada':m.cancelled?'Cancelada':'Agendada',m.changes,''));
  // O adaptador atual identifica eventos por tipo e dia. O histórico mantém cada ocorrência.
  const grouped={};
  s.events.forEach(e=>{const key=JSON.stringify([e.type,e.done]);(grouped[key]||(grouped[key]=[])).push(e);});
  Object.keys(grouped).forEach(key=>{
    const group=grouped[key],e=group[0];
    const notes=group.map(v=>v.source||(v.from!==undefined?v.from+' → '+v.to:''));
    add(e.type==='Mudança de etapa'?'Etapa':'Evento',e.type,'','','','',e.done,e.recorded,'Registrado',null,
      (group.length>1?group.length+' registros no dia. ':'')+notes.filter(Boolean).join(' | '));
  });
  return rows;
}
// Função sem dependência do fuso do projeto Apps Script (UTC−03 em São Paulo no ciclo).
function comStampDay(stamp){
  if(/^\d{4}-\d{2}-\d{2}$/.test(stamp))return stamp;
  return Utilities.formatDate(new Date(stamp),COM.timezone,'yyyy-MM-dd');
}

function comHeaders(sh) {
  const a=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],m={};
  a.forEach((h,i)=>{if(h){if(m[String(h)])throw new Error('Cabeçalho duplicado: '+h);m[String(h)]=i+1;}});return m;
}
function comMap(name,h) {
  return {name:1,stage:h.Etapa,due:h[name==='Leads'?'Data de follow-up':'Data da próxima ação'],
    action:h['Próxima ação'],status:h['Follow-up'],context:h['Contexto do follow-up'],number:h['Número do follow-up'],
    meeting:h['Data prevista da reunião'],effective:h['Data da atividade'],retro:h['Data retroativa'],
    activity:h['Registrar atividade'],outcome:h['Resultado / encaminhamento'],id:h['ID comercial (automático)'],
    first:h[name==='Leads'?'Data em que foi chamado':'Primeira abordagem (automático)'],
    response:h['Primeira resposta (automático)'],decisor:h['Contato com decisor (automático)'],
    history:h['Histórico comercial (automático)'],alert:h['Alerta de registro (automático)']};
}
function comInput(values,m,tz) {
  const x={inputWarnings:[]};
  Object.keys(m).forEach(k=>{const v=m[k]?values[m[k]-1]:'';x[k]=v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):comText(v);});
  ['first','response','decisor','due','meeting','retro','effective'].forEach(k=>{
    try{x[k]=comDate(x[k]);}catch(err){x.inputWarnings.push({field:k,message:err.message});x[k]='';}
  });return x;
}
function comRealRecord(name,row){return !!comText(row[0])&&!(name==='Presencial'&&comText(row[0])==='Abordagens');}
function comSet(sh,row,col,value) {
  if(!col)return;const cell=sh.getRange(row,col),old=cell.getValue();
  if(old instanceof Date&&value instanceof Date&&old.getTime()===value.getTime())return;
  if(String(old)!==String(value))cell.setValue(typeof value==='string'&&value.startsWith('=')?"'"+value:value);
}
function comDayValue(day){return day?new Date(comDate(day)+'T12:00:00-03:00'):'';}
function comState(raw,x) {
  if(!raw)return comSeed(x);
  let old;try{old=JSON.parse(raw);}catch(err){throw new Error('Histórico inválido em '+x.name+'. O conteúdo original foi preservado.');}
  if(!old||!Array.isArray(old.events)||!Array.isArray(old.tasks)||!Array.isArray(old.meetings))
    throw new Error('Estrutura do histórico inválida em '+x.name+'.');
  if(old.v>COM.version)throw new Error('Histórico de versão mais recente em '+x.name+'.');
  return comUpgrade(old,x);
}
function comAuditSheet(ss) {
  let sh=ss.getSheetByName(COM.auditSheet);
  if(!sh){sh=ss.insertSheet(COM.auditSheet);sh.getRange(1,1,1,COM.auditHeaders.length).setValues([COM.auditHeaders]);sh.setFrozenRows(1);sh.hideColumns(10,2);}
  const headers=sh.getRange(1,1,1,COM.auditHeaders.length).getValues()[0];
  if(headers.some((v,i)=>v!==COM.auditHeaders[i]))throw new Error('Aba '+COM.auditSheet+' já existe com outro conteúdo. Nada foi substituído.');
  return sh;
}
function comAuditValues(origin,s,operation,previous) {
  const raw=JSON.stringify(s);
  if(raw.length>45000||String(previous||'').length>49000)throw new Error('Histórico extenso em '+s.name+'. Arquive com apoio técnico; nada foi truncado.');
  const prior=previous?JSON.parse(previous):{};
  const executed=s.lastRecorded&&s.lastRecorded!==prior.lastRecorded;
  const values=[Utilities.getUuid(),new Date().toISOString(),origin,s.id,s.name,operation,
    executed?s.lastActivity:'',executed?s.lastActivityLabel:'',executed?s.lastOutcome:'',previous||'',raw];
  return values.map(v=>typeof v==='string'&&v.startsWith('=')?"'"+v:v);
}
function comAppendAudit(ss,rows) {
  if(!rows.length)return;
  const sh=comAuditSheet(ss),row=sh.getLastRow()+1,last=row+rows.length-1;
  if(last>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),last-sh.getMaxRows());
  sh.getRange(row,1,rows.length,COM.auditHeaders.length).setValues(rows);
}
function comAudit(ss,origin,s,operation,previous) {
  comAppendAudit(ss,[comAuditValues(origin,s,operation,previous)]);
}
function comSaveMigration(ss,plan) {
  const changed=plan.filter(p=>JSON.stringify(p.state)!==p.old);
  comAppendAudit(ss,changed.map(p=>comAuditValues(p.sh.getName(),p.state,'Instalação / migração sem presumir execuções',p.old)));
  // Escrita por blocos: centenas de empresas não exigem milhares de chamadas de célula.
  const runs=[];
  plan.forEach(p=>{let run=runs[runs.length-1];if(!run||run[0].sh!==p.sh||run[run.length-1].row+1!==p.row){run=[];runs.push(run);}run.push(p);});
  runs.forEach(run=>{
    const first=run[0];
    [['history',p=>JSON.stringify(p.state)],['id',p=>p.state.id],['alert',p=>p.state.alert]].forEach(pair=>{
      first.sh.getRange(first.row,first.m[pair[0]],run.length,1).setValues(run.map(p=>[pair[1](p)]));
    });
  });
}
function comWrite(sh,row,h,m,s) {
  // Persista antes das projeções. Falha posterior nunca destrói o evento já registrado.
  comSet(sh,row,m.history,JSON.stringify(s));comSet(sh,row,m.id,s.id);
  comSet(sh,row,m.stage,s.stage);comSet(sh,row,m.action,s.action);comSet(sh,row,m.status,s.status);
  comSet(sh,row,m.context,s.context);comSet(sh,row,m.number,s.number);comSet(sh,row,m.alert,s.alert);
  if(s.first&&!sh.getRange(row,m.first).getValue())comSet(sh,row,m.first,comDayValue(s.first));
  const dates={'Primeira resposta (automático)':s.response,'Contato com decisor (automático)':s.decisor,
    'Primeiro convite (automático)':s.stamps['Convite enviado'],'Primeiro agendamento (automático)':s.stamps.Agendamento,
    'Última reunião realizada (automático)':s.stamps['Reunião realizada'],'Proposta enviada (automático)':s.stamps['Proposta enviada'],
    'Fechamento (automático)':s.stamps.Fechamento,'Encerramento (automático)':s.stamps.Encerramento};
  Object.keys(dates).forEach(k=>{if(dates[k])comSet(sh,row,h[k],comDayValue(dates[k]));});
  if(s.lastActivity)comSet(sh,row,m.effective,comDayValue(s.lastActivity));
  const task=s.current==null?null:s.tasks[s.current];
  if(task&&!task.done&&!task.cancelled)comSet(sh,row,m.due,comDayValue(task.due));
  if(s.consumeRetro)comSet(sh,row,m.retro,'');
  // Comando consumido; pode selecionar a mesma atividade novamente em outra ocasião.
  comSet(sh,row,m.activity,'');
}
function comEnsureColumns(sh) {
  let h=comHeaders(sh);
  COM.added[sh.getName()].concat(COM.extra).forEach(header=>{
    if(!h[header]) {
      // As listas de validação ficam fora da tabela ordenável. Insere antes delas,
      // para que o Google ajuste suas referências sem misturar opções com empresas.
      const optionCols=Object.keys(h).filter(k=>k.startsWith('Opções de ')).map(k=>h[k]);
      const col=optionCols.length?Math.min(...optionCols):sh.getLastColumn()+1;
      if(optionCols.length)sh.insertColumnBefore(col);
      else if(col>sh.getMaxColumns())sh.insertColumnsAfter(sh.getMaxColumns(),col-sh.getMaxColumns());
      sh.getRange(1,col).setValue(header);h=comHeaders(sh);
    }
  });return comHeaders(sh);
}
function comFilter(sh) {
  // Ordenação move IDs e históricos, mas não as listas de opções à direita.
  const h=comHeaders(sh),filter=sh.getFilter(),width=Math.max(...Object.values(comMap(sh.getName(),h)).filter(Boolean));
  const firstOption=Math.min(...Object.keys(h).filter(k=>k.startsWith('Opções de ')).map(k=>h[k]));
  if(firstOption<=width)throw new Error('Há listas de opções dentro da tabela em '+sh.getName()+'. Mova as listas para depois das colunas comerciais antes de instalar.');
  if(filter&&filter.getRange().getColumn()===1&&filter.getRange().getNumColumns()===width)return;
  const criteria={};
  if(filter){const fr=filter.getRange();for(let c=fr.getColumn();c<=fr.getLastColumn();c++){const rule=filter.getColumnFilterCriteria(c);if(rule)criteria[c]=rule;}filter.remove();}
  const next=sh.getRange(1,1,sh.getMaxRows(),width).createFilter();
  Object.keys(criteria).filter(c=>Number(c)<=width).forEach(c=>next.setColumnFilterCriteria(Number(c),criteria[c]));
}
function instalarAutomacaoComercial() {
  const ss=SpreadsheetApp.getActive(),lock=LockService.getDocumentLock();lock.waitLock(30000);
  try {
    comAuditSheet(ss);
    // Valida todas as linhas antes de migrar qualquer histórico.
    const plan=[];
    COM.sheets.forEach(name=>{
      const sh=ss.getSheetByName(name);if(!sh)throw new Error('Aba não encontrada: '+name);
      const h=comEnsureColumns(sh),m=comMap(name,h);
      if(!m.stage||!m.due||!m.first)throw new Error('Cabeçalhos obrigatórios ausentes em '+name);
      const seen={};
      sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),sh.getLastColumn()).getValues().forEach((row,i)=>{
        if(!comRealRecord(name,row))return;
        const x=comInput(row,m,ss.getSpreadsheetTimeZone());x.origin=name;
        const state=comState(x.history,x);state.id=state.id||x.id||Utilities.getUuid();
        if(seen[state.id])throw new Error('ID duplicado em '+name+': '+x.name);seen[state.id]=true;
        x.inputWarnings.forEach(w=>{const message=w.message+' (campo '+w.field+')';if(!state.migrationWarnings.includes(message))state.migrationWarnings.push(message);});
        state.alert=state.migrationWarnings.length?'Histórico anterior a conferir: '+state.migrationWarnings.join(' '):state.alert;
        plan.push({sh:sh,h:h,m:m,row:i+2,state:state,old:x.history});
      });
    });
    // Não reescreve etapas, datas nem Feito/A fazer existentes durante a migração.
    comSaveMigration(ss,plan);
    COM.sheets.forEach(name=>{
      const sh=ss.getSheetByName(name),h=comHeaders(sh),m=comMap(name,h);
      const rule=items=>SpreadsheetApp.newDataValidation().requireValueInList(items,true).setAllowInvalid(false).build();
      [[m.activity,COM.activities],[m.status,['A fazer','Feito']]].forEach(pair=>sh.getRange(2,pair[0],sh.getMaxRows()-1,1).setDataValidation(rule(pair[1])));
      sh.getRange(1,m.effective).setNote('Última atividade registrada automaticamente. Para lançar outra data, preencha Data retroativa ANTES de Registrar atividade ou Feito.');
      sh.getRange(1,m.activity).setNote('Preencha Resultado / encaminhamento e depois selecione o que executou. Tentativas sem contato não contam como novas empresas.');
      sh.getRange(1,m.retro).setNote('Opcional. Data de uma execução passada. É consumida na próxima atividade; sem ela, usa a data de São Paulo.');
      sh.getRange(1,m.status).setNote('A fazer planeja um follow-up. Feito registra sua conclusão com data automática. Para o próximo: A fazer e nova data prevista.');
      [m.due,m.meeting,m.effective,m.retro,m.first,m.response,m.decisor].forEach(c=>sh.getRange(2,c,sh.getMaxRows()-1,1).setNumberFormat('dd/MM/yyyy'));
      sh.setFrozenRows(1);comFilter(sh);
      // Oculta apenas detalhes técnicos; mantém última atividade e alertas visíveis.
      Object.keys(h).filter(k=>k.includes('(automático)')&&k!=='Alerta de registro (automático)').forEach(k=>sh.hideColumns(h[k]));
      ['Número do follow-up','Contexto do follow-up'].forEach(k=>sh.hideColumns(h[k]));
      [m.activity,m.outcome,m.effective,m.retro,m.alert].forEach(c=>sh.showColumns(c));
    });
    comRefresh(ss);
    ['comercialAoEditar','comercialAoAbrir'].forEach(handler=>{
      const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler&&t.getTriggerSourceId()===ss.getId());
      existing.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));
      if(!existing.length){const b=ScriptApp.newTrigger(handler).forSpreadsheet(ss);if(handler==='comercialAoEditar')b.onEdit().create();else b.onOpen().create();}
    });
    comercialAoAbrir();ss.toast('Versão 2 instalada. Datas automáticas e histórico preservado.','Comercial',8);
  } finally {lock.releaseLock();}
}
function comercialAoAbrir() {
  SpreadsheetApp.getUi().createMenu('Comercial')
    .addItem('Atualizar dados do dashboard','atualizarResultadosComerciais')
    .addItem('Ver histórico de atividades','mostrarHistoricoComercial')
    .addItem('Mostrar Resultados','mostrarResultadosComerciais')
    .addItem('Verificar automação','verificarAutomacaoComercial').addToUi();
}
function mostrarHistoricoComercial(){const sh=comAuditSheet(SpreadsheetApp.getActive());sh.showSheet();sh.activate();}
function mostrarResultadosComerciais(){const sh=SpreadsheetApp.getActive().getSheetByName('Resultados');if(sh){sh.showSheet();sh.activate();sh.getRange('N1').activate();}}
function verificarAutomacaoComercial() {
  const ss=SpreadsheetApp.getActive();
  const installed=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='comercialAoEditar'&&t.getTriggerSourceId()===ss.getId());
  SpreadsheetApp.getUi().alert(installed?'Gatilho de edição instalado. Data automática: São Paulo. Consulte Execuções no Apps Script se uma edição não aparecer no histórico.':'Gatilho ausente: execute instalarAutomacaoComercial.');
}
function comercialAoEditar(e) {
  if(!e||!e.range)throw new Error('Não execute comercialAoEditar manualmente. Edite a planilha ou execute instalarAutomacaoComercial.');
  const sh=e.range.getSheet();if(!COM.sheets.includes(sh.getName())||e.range.getLastRow()<2)return;
  const ss=e.source||sh.getParent(),lock=LockService.getDocumentLock();lock.waitLock(30000);
  try {
    const h=comHeaders(sh),m=comMap(sh.getName(),h);
    if(!m.activity||!m.history)throw new Error('Execute instalarAutomacaoComercial primeiro.');
    const fields=Object.keys(m).filter(k=>m[k]>=e.range.getColumn()&&m[k]<=e.range.getLastColumn());
    if(!fields.length)return;
    if(fields.some(k=>['history','id','effective','response','decisor','number'].includes(k)))
      throw new Error('Este campo é automático. Para uma execução passada, use Data retroativa e Registrar atividade.');
    const now=new Date(),today=Utilities.formatDate(now,COM.timezone,'yyyy-MM-dd'),stamp=now.toISOString();
    const changes=[];
    for(let row=Math.max(2,e.range.getRow());row<=e.range.getLastRow();row++) {
      const values=sh.getRange(row,1,1,sh.getLastColumn()).getValues()[0];
      if(!comRealRecord(sh.getName(),values))continue;
      const x=comInput(values,m,ss.getSpreadsheetTimeZone());x.origin=sh.getName();
      const invalid=x.inputWarnings.find(w=>fields.includes(w.field)||w.field==='retro');
      if(invalid)throw new Error(x.name+': '+invalid.message);
      let state=comState(x.history,x);state.id=state.id||x.id||Utilities.getUuid();
      // Cadastro novo: não inicializa com Feito ou com a etapa recém-selecionada como se fossem antigos.
      if(!x.history)state=comSeed(Object.assign({},x,{id:state.id,stage:fields.includes('stage')?'':x.stage,status:fields.includes('status')?'':x.status}));
      state=comEvolve(state,x,today,stamp,fields);
      changes.push({row:row,state:state,old:x.history});
    }
    changes.forEach(p=>{
      comAudit(ss,sh.getName(),p.state,'Edição: '+fields.join(', '),p.old);
      comWrite(sh,p.row,h,m,p.state);
    });
    comRefresh(ss);
  } catch(err) {ss.toast(String(err.message||err),'Comercial: verificar registro',15);throw err;}
  finally {lock.releaseLock();}
}
function atualizarResultadosComerciais() {
  const lock=LockService.getDocumentLock();lock.waitLock(30000);
  try{comRefresh(SpreadsheetApp.getActive());}finally{lock.releaseLock();}
}
function comRefresh(ss) {
  // Monta e valida tudo antes de tocar no destino. A atualização não inventa eventos de edições perdidas.
  const all=[],seen={},ids={};
  COM.sheets.forEach(name=>{
    const sh=ss.getSheetByName(name);if(!sh)throw new Error('Aba ausente: '+name);
    const h=comHeaders(sh),m=comMap(name,h);
    if(!m.history)throw new Error('Instale a automação em '+name+'.');
    sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),sh.getLastColumn()).getValues().forEach(row=>{
      if(!comRealRecord(name,row))return;
      const x=comInput(row,m,ss.getSpreadsheetTimeZone()),s=comState(x.history,x);
      const key=name+'|'+s.name.toLocaleLowerCase();seen[key]=(seen[key]||0)+1;
      if(s.id){const id=name+'|'+s.id;if(ids[id])throw new Error('ID comercial duplicado: '+s.name);ids[id]=true;}
      if(x.inputWarnings.length)s.alert+=' '+x.inputWarnings.map(w=>w.message).join(' ');
      const task=s.current==null?null:s.tasks[s.current];
      if(s.stage!==x.stage||task&&(task.done?'Feito':task.cancelled?'':'A fazer')!==x.status||task&&!task.done&&task.due!==x.due)
        s.alert+=' Dados visíveis divergem do histórico; verifique o gatilho e as datas antes de contabilizar.';
      s.stage=x.stage;s.action=x.action;s.name=x.name;
      all.push({origin:name,state:s,key:key});
    });
  });
  const rows=[];
  all.forEach(o=>{if(seen[o.key]>1)o.state.alert+=' Nome duplicado nesta aba; conferir identidade da empresa.';rows.push(...comResultRows(o.origin,o.state));});
  let out=ss.getSheetByName('Resultados');if(!out)out=ss.insertSheet('Resultados');
  const neededRows=rows.length+1,neededCols=COM.resultCol+COM.resultHeaders.length-1;
  if(out.getMaxRows()<neededRows)out.insertRowsAfter(out.getMaxRows(),neededRows-out.getMaxRows());
  if(out.getMaxColumns()<neededCols)out.insertColumnsAfter(out.getMaxColumns(),neededCols-out.getMaxColumns());
  const old=out.getRange(1,COM.resultCol,1,COM.resultHeaders.length).getValues()[0];
  if(old.some((v,i)=>v&&v!==COM.resultHeaders[i]))throw new Error('Resultados!N:AG contém outros dados. Nada foi substituído.');
  const dateIndices=[6,7,8,9,10,11,15,16,17];
  const converted=rows.map(r=>r.map((v,i)=>dateIndices.includes(i)?comDayValue(v):typeof v==='string'&&v.startsWith('=')?"'"+v:v));
  const oldLastRow=out.getLastRow();
  // Grava o bloco novo primeiro; só depois remove sobras da exportação anterior.
  out.getRange(1,COM.resultCol,neededRows,COM.resultHeaders.length).setValues([COM.resultHeaders,...converted]);
  if(oldLastRow>neededRows)out.getRange(neededRows+1,COM.resultCol,oldLastRow-neededRows,COM.resultHeaders.length).clearContent();
  dateIndices.forEach(i=>out.getRange(2,COM.resultCol+i,Math.max(1,rows.length),1).setNumberFormat('dd/MM/yyyy'));
  out.getRange(1,COM.resultCol,1,COM.resultHeaders.length).setBackground('#334155').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  ss.toast('Base do dashboard atualizada: '+all.length+' cadastros.','Comercial',4);
}
