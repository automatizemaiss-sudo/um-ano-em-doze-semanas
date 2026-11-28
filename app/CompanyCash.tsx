'use client';

import {useEffect, useRef, useState} from 'react';
import {
  accountEffect, businessEffect, cents, entriesThrough, entryLabels, monthEnd, nextMonth,
  openInvoices, readFinanceSetup, snapshot, validateEntry,
  type CashEntry, type CompanyFinance, type EntryKind, type FinanceAccount,
} from '../lib/company-finance';
import {readStatement, type StatementRow} from '../lib/finance-statement';

export const showMoney = (amount: number) => (amount / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const formatDate = (date: string) => date ? date.split('-').reverse().join('/') : 'Sem data';
const amountInput = (number?: number) => number === undefined ? '' : (number / 100).toFixed(2).replace('.', ',');
const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const inMonth = (date: string, month: string) => date.startsWith(month + '-');
const effective = (entry: CashEntry) => entry.kind === 'cardPayment' ? entry.date : entry.date || entry.invoice || '';

type Props = { finance?: CompanyFinance; save: (update: (finance?: CompanyFinance) => CompanyFinance) => void; today: string };
type Draft = Partial<CashEntry> & { statement?: {key: string; account: string; row: StatementRow} };
const tabs = ['Visão geral', 'Movimentações', 'Cartão', 'Conciliação', 'Contas e recorrências'] as const;

export function CompanyCash({finance, save, today}: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Visão geral');
  const [selectedMonth, setSelectedMonth] = useState('');
  const month = selectedMonth || today.slice(0, 7);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [statement, setStatement] = useState<StatementRow[]>([]);
  const [statementAccount, setStatementAccount] = useState('');
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const editor = useRef<HTMLDivElement>(null);
  const statementImport = useRef(0);
  useEffect(() => {
    if (draft) editor.current?.scrollIntoView({block: 'start'});
  }, [draft]);

  function edit(value: Draft) {
    setMessage('');
    setDraft(value);
    setFormVersion(version => version + 1);
  }

  if (!finance) return <section className="card company-finance">
    <h2>Configurar o financeiro</h2>
    <p>Carregue o arquivo de abertura com os saldos de corte, contas, fatura e recorrências da empresa.</p>
    <label>Arquivo de abertura<input type="file" accept=".json,application/json" onChange={async event => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      try {
        const setup = readFinanceSetup(await file.text());
        save(current => current ?? setup);
        setMessage('Financeiro configurado.');
      } catch (error) {setMessage((error as Error).message);}
    }}/></label>
    {message && <p role="status">{message}</p>}
  </section>;

  const ledger = finance;
  const end = monthEnd(month);
  const through = end > today ? end : today;
  const invoicesThrough = monthEnd(nextMonth(through.slice(0, 7)));
  const entries = entriesThrough(ledger, invoicesThrough);
  const {balances, cash, debt} = snapshot(ledger, today);
  const invoices = openInvoices(entries, today);
  const payableInvoices = invoices.filter(invoice => invoice.open > 0);
  const upcoming = [
    ...entries.filter(entry => entry.status === 'planned' && !['card', 'cardPayment'].includes(entry.kind) && (!entry.date || entry.date <= through))
      .map(entry => ({id: entry.id, date: entry.date, name: entry.name, value: businessEffect(ledger, entry), entry})),
    ...payableInvoices.filter(invoice => invoice.date <= through).map(invoice => ({
      id: 'invoice:' + invoice.date, date: invoice.date, name: 'Fatura do cartão', value: -invoice.open, entry: null,
      due: entries.find(entry => entry.invoice === invoice.date && entry.due)?.due,
    })),
  ];
  const forecast = upcoming.filter(item => item.date && (item.value || item.entry?.amount === 0)).sort((a, b) => a.date.localeCompare(b.date) || b.value - a.value);
  const plannedInMonth = upcoming.filter(item => inMonth(item.date, month));
  const awaitingExpenseAmount = forecast.some(item => item.date <= end && item.entry?.amount === 0);
  const pendingUndated = upcoming.filter(item => !item.date && item.value);
  const overdue = forecast.filter(item => item.date < today && !inMonth(item.date, month));
  const overdueNet = overdue.reduce((sum, item) => sum + item.value, 0);
  const openIn = plannedInMonth.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const openOut = plannedInMonth.reduce((sum, item) => sum + Math.max(0, -item.value), 0);
  const monthly = entries.filter(entry => inMonth(effective(entry), month)).sort((a, b) => effective(a).localeCompare(effective(b)));
  const spent = monthly.filter(entry => entry.status === 'confirmed' && entry.date > ledger.cutoff &&
    (entry.kind === 'expense' || entry.kind === 'card' || entry.kind === 'personalExpense'))
    .reduce((sum, entry) => sum + entry.amount, 0);
  const cardOutstanding = invoices.reduce((sum, invoice) => sum + invoice.confirmedOpen, 0);
  const accountName = (id?: string) => ledger.accounts.find(account => account.id === id)?.name;
  const posted = ledger.entries.filter(entry => entry.status === 'confirmed' && entry.date <= today);
  const cutoffMonth = ledger.cutoff.slice(0, 7);
  const currentStatementLinks = new Set(Object.entries(ledger.reconciled)
    .filter(([key]) => key.startsWith(statementAccount + ':')).map(([, id]) => id));
  const statementStart = statement.map(row => row.date).sort().at(0);
  const statementEnd = statementDate || statement.map(row => row.date).sort().at(-1) || '';
  const missingFromStatement = statementStart ? posted.filter(entry => entry.date >= statementStart &&
    entry.date <= statementEnd && entry.date > ledger.cutoff &&
    accountEffect(entry, statementAccount) !== 0 && !currentStatementLinks.has(entry.id)) : [];
  const recordedClosing = statementEnd && statementEnd >= ledger.cutoff && statementEnd <= today
    ? snapshot(ledger, statementEnd).balances.find(account => account.id === statementAccount)?.balance : undefined;
  const reportedClosing = statementBalance ? cents(statementBalance) : NaN;

  function updateEntry(entry: CashEntry, statementKey?: string) {
    save(current => {
      const base = current ?? ledger;
      return {
        ...base, entries: [...base.entries.filter(item => item.id !== entry.id), entry],
        reconciled: statementKey ? {...base.reconciled, [statementKey]: entry.id} : base.reconciled,
      };
    });
  }

  function saveEntry(entry: CashEntry) {
    try {
      validateEntry(entry, ledger.accounts);
      if (entry.status === 'confirmed' && entry.date > today) throw new Error('Use a situação Previsto para datas futuras.');
      if (entry.status === 'confirmed' && entry.date <= ledger.cutoff &&
          !ledger.entries.some(existing => existing.id === entry.id && existing.date <= ledger.cutoff))
        throw new Error('Use uma data posterior ao corte. Os movimentos anteriores já estão representados pelos saldos iniciais.');
      const linked = Object.entries(ledger.reconciled).some(([, id]) => id === entry.id);
      if (linked) throw new Error('Desfaça a conferência desse lançamento antes de alterá-lo.');
      if (entry.kind === 'cardPayment') {
        const open = openInvoices(entries.filter(previous => previous.id !== entry.id), today).find(item => item.date === entry.invoice)?.posted ?? 0;
        const alreadyPaid = posted.filter(previous => previous.id !== entry.id && previous.kind === 'cardPayment' && previous.invoice === entry.invoice)
          .reduce((sum, previous) => sum + previous.amount, 0);
        if (entry.amount > open - alreadyPaid) throw new Error('Confirme as compras da fatura antes de registrar um pagamento acima do saldo lançado.');
      }
      if (draft?.statement) {
        const {row, account} = draft.statement;
        if (entry.status !== 'confirmed' || row.date !== entry.date || row.value !== accountEffect(entry, account))
          throw new Error('Mantenha a data, o valor e a conta da linha do extrato para conciliá-la.');
      }
      updateEntry(entry, draft?.statement?.key);
      setDraft(null);
      setMessage('Movimentação salva.');
    } catch (error) {setMessage((error as Error).message);}
  }

  function removeEntry(entry: Draft) {
    if (Object.values(ledger.reconciled).includes(entry.id)) {setMessage('Desfaça a conferência desse lançamento antes de cancelar.'); return;}
    if (!window.confirm('Cancelar este lançamento?')) return;
    updateEntry({...entry, status: 'cancelled'} as CashEntry);
    setDraft(null);
    setMessage('Lançamento cancelado.');
  }

  function compare(row: StatementRow, entryId?: string) {
    const key = statementAccount + ':' + row.id;
    save(current => {
      const base = current ?? ledger;
      const reconciled = {...base.reconciled};
      if (entryId) reconciled[key] = entryId;
      else delete reconciled[key];
      return {...base, reconciled};
    });
  }

  return <div className="company-finance strategy-page">
    <div className="cf-toolbar">
      <nav aria-label="Financeiro da empresa">{tabs.map(value => <button key={value} type="button" className={tab === value ? 'primary' : 'secondary'} onClick={() => {setTab(value); setMessage('');}}>{value}</button>)}</nav>
      <label>Mês de consulta<input type="month" min={cutoffMonth} value={month} onChange={event => setSelectedMonth(event.target.value)}/></label>
      <button className="primary" onClick={() => edit({date: today, status: 'confirmed'})}>Novo lançamento</button>
    </div>
    {message && <p className="cf-message" role="status">{message}</p>}
    {draft && <div ref={editor}><EntryEditor key={formVersion} draft={draft} accounts={ledger.accounts} today={today}
      save={saveEntry} close={() => {setDraft(null); setMessage('');}} remove={() => removeEntry(draft)}/></div>}
    {tab === 'Visão geral' && <>
      <section className="card">
        <h2>Caixa e compromissos</h2>
        <div className="cf-metrics">
          <Metric label="Caixa da empresa hoje" value={cash}/>
          <Metric label="A receber no mês" value={openIn}/>
          <Metric label="A pagar no mês" value={openOut}/>
          <Metric label="Empresa deve a você" value={debt}/>
        </div>
        {ledger.openingDebtNote && <p>Saldo inicial com você em {formatDate(ledger.cutoff)}: {ledger.openingDebtNote}.</p>}
        <div className="cf-balances">{balances.filter(account => account.business).map(account => <Metric key={account.id} label={account.name} value={account.balance}/>)}</div>
      </section>
      <section className="card">
        <h2>Agenda de caixa</h2>
        {awaitingExpenseAmount && <p>Os totais e o caixa projetado consideram as despesas com valor informado.</p>}
        {overdue.length > 0 && <p>Há {overdue.length} lançamento(s) vencido(s) de outros meses, com saldo líquido de {showMoney(overdueNet)}. Eles entram na projeção.</p>}
        {end < today && <p>O saldo projetado parte do caixa de hoje. Use Movimentações para consultar os lançamentos efetivados no período.</p>}
        <div className="cf-table"><table><thead><tr><th>Data prevista</th><th>Compromisso</th><th>Valor</th><th>Caixa projetado</th></tr></thead><tbody>
          {(() => {
            let projected = cash;
            return forecast.filter(item => item.date <= end).map(item => {
              projected += item.value;
              return inMonth(item.date, month) && <tr key={item.id}>
                <td>{formatDate(item.date)} {item.date < today && <small>Vencido</small>}</td>
                <td>{item.entry ? <button className="text-button" onClick={() => edit(item.entry!)}>{item.name}</button> : <button className="text-button" onClick={() => setTab('Cartão')}>{item.name}</button>}{'due' in item && item.due && <small>Vencimento informado: {formatDate(item.due)}</small>}</td>
                <td>{item.entry?.amount === 0 ? 'A definir' : showMoney(item.value)}</td><td className={projected < 0 ? 'red' : ''}>{end >= today ? showMoney(projected) : '—'}</td>
              </tr>;
            });
          })()}
        </tbody></table></div>
        {!forecast.some(item => inMonth(item.date, month)) && <p>Sem compromissos com data neste mês.</p>}
      </section>
      {pendingUndated.length > 0 && <section className="card">
        <h2>Valores sem data confirmada</h2>
        <p>Preencha as datas conforme a operadora liberar a agenda. Esses valores ficam fora da projeção diária.</p>
        {pendingUndated.map(item => <div className="cf-line" key={item.id}><button className="text-button" onClick={() => item.entry && edit(item.entry)}>{item.name}</button><strong>{showMoney(item.value)}</strong></div>)}
      </section>}
    </>}
    {tab === 'Movimentações' && <section className="card">
      <h2>Movimentações do mês</h2>
      <p>Despesas lançadas no mês, incluindo compras no cartão e despesas pagas pela titular: <strong>{showMoney(spent)}</strong>.</p>
      <div className="cf-table"><table><thead><tr><th>Data</th><th>Descrição</th><th>Contas</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
        {monthly.map(entry => <tr key={entry.id}><td>{formatDate(effective(entry))}</td>
          <td><button className="text-button" onClick={() => edit(entry)}>{entry.name}</button><small>{entryLabels[entry.kind]}</small></td>
          <td>{[accountName(entry.from), accountName(entry.to)].filter(Boolean).join(' → ') || (entry.kind === 'card' ? 'Cartão da empresa' : '—')}</td>
          <td>{entry.amount === 0 ? 'A definir' : showMoney(entry.amount)}</td>
          <td>{entry.status === 'planned' ? 'Previsto' : (entry.date && entry.date <= ledger.cutoff ? 'No saldo de abertura' : 'Efetivado')}</td></tr>)}
      </tbody></table></div>
      {!monthly.length && <p>Sem lançamentos neste mês.</p>}
    </section>}
    {tab === 'Cartão' && <section className="card">
      <h2>Faturas e limite</h2>
      <div className="cf-metrics"><Metric label="Limite total informado" value={ledger.card.limit}/><Metric label="Compras lançadas em aberto" value={cardOutstanding}/><Metric label="Limite restante estimado" value={ledger.card.limit - cardOutstanding}/></div>
      <p>Fechamento no dia {ledger.card.closingDay}. Pagamento previsto no dia {ledger.card.paymentDay}. Compras variáveis ficam como previsão até você informar o valor cobrado.</p>
      {invoices.filter(invoice => inMonth(invoice.date, month) || invoice.confirmedOpen > 0).map(invoice => {
        const invoiceEntries = entries.filter(entry => entry.invoice === invoice.date);
        const due = invoiceEntries.find(entry => entry.due)?.due;
        return <details key={invoice.date} open={invoice.confirmedOpen > 0}>
        <summary>{formatDate(invoice.date)} · {showMoney(invoice.open)} em aberto</summary>
        {due && <p>Vencimento informado: {formatDate(due)}.</p>}
        <p>Lançado {showMoney(invoice.posted)} · previsto {showMoney(invoice.estimated)} · pago {showMoney(invoice.paid)}</p>
        {invoiceEntries.map(entry => <div className="cf-line" key={entry.id}>
          <button className="text-button" onClick={() => edit(entry)}>{entry.name}</button><span>{formatDate(entry.date)} · {showMoney(entry.amount)}</span>
        </div>)}
        {invoice.confirmedOpen > 0 && <button className="secondary" onClick={() => edit({name: 'Pagamento de fatura', kind: 'cardPayment', status: 'confirmed', date: today, invoice: invoice.date, amount: invoice.confirmedOpen})}>Registrar pagamento</button>}
      </details>;})}
    </section>}
    {tab === 'Conciliação' && <section className="card">
      <h2>Conferir com o extrato</h2>
      <p>Selecione a conta e importe um extrato em PDF, CSV ou OFX. Confira as sugestões por data e valor. Cada lado de uma transferência pode ser conciliado no extrato da conta correspondente.</p>
      <div className="form-grid">
        <label>Conta do extrato<select value={statementAccount} onChange={event => {statementImport.current++; setStatementAccount(event.target.value); setStatement([]); setStatementDate(''); setStatementBalance('');}}>
          <option value="">Selecione</option>{ledger.accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select></label>
        <label>Arquivo do extrato<input key={statementAccount} type="file" accept=".pdf,.csv,.ofx,.tsv,application/pdf,text/csv" disabled={!statementAccount} onChange={async event => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          const request = ++statementImport.current;
          setStatement([]); setStatementDate(''); setStatementBalance('');
          try {
            const rows = await readStatement(file);
            if (request === statementImport.current) {setStatement(rows); setMessage('');}
          } catch (error) {if (request === statementImport.current) setMessage((error as Error).message);}
        }}/></label>
      </div>
      {statement.length > 0 && <>
        <div className="form-grid">
          <label>Data final do extrato<input type="date" min={statementStart} max={today} value={statementEnd} onChange={event => setStatementDate(event.target.value)}/></label>
          <label>Saldo final do extrato<input inputMode="decimal" value={statementBalance} placeholder="Opcional" onChange={event => setStatementBalance(event.target.value)}/></label>
        </div>
        {recordedClosing !== undefined && <div className="cf-metrics">
          <Metric label="Saldo no financeiro na data" value={recordedClosing}/>
          {Number.isSafeInteger(reportedClosing) && <Metric label="Diferença entre extrato e financeiro" value={reportedClosing - recordedClosing}/>}
        </div>}
        {missingFromStatement.length > 0 && <details>
          <summary>{missingFromStatement.length} lançamento(s) do financeiro ainda sem confirmação no extrato</summary>
          {missingFromStatement.map(entry => <div className="cf-line" key={entry.id}>
            <button className="text-button" onClick={() => edit(entry)}>{entry.name}</button>
            <span>{formatDate(entry.date)} · {showMoney(accountEffect(entry, statementAccount))}</span>
          </div>)}
        </details>}
      </>}
      {statement.map(row => {
        const key = statementAccount + ':' + row.id;
        const linked = ledger.reconciled[key];
        const matches = posted.filter(entry => entry.date === row.date && accountEffect(entry, statementAccount) === row.value && !currentStatementLinks.has(entry.id));
        const pending = entries.filter(entry => entry.status === 'planned' && (entry.kind === 'receipt' || entry.kind === 'expense') &&
          (!entry.date || Math.abs(Date.parse(row.date) - Date.parse(entry.date)) <= 7 * 86_400_000) &&
          (row.value > 0 ? entry.kind === 'receipt' && (!entry.to || entry.to === statementAccount) :
            entry.kind === 'expense' && (!entry.from || entry.from === statementAccount)) && entry.amount === Math.abs(row.value));
        return <div className="cf-line cf-statement" key={row.id}>
          <span>{row.name}<small>{formatDate(row.date)} · {showMoney(row.value)}</small>
            {row.gross !== undefined && <small>Bruto {showMoney(row.gross)} · taxa do cartão {showMoney(row.fee ?? 0)} · antecipação {showMoney(row.anticipation ?? 0)}</small>}</span>
          {linked ? <button className="secondary" onClick={() => compare(row)}>Conferido · desfazer</button> : matches.length ?
            <div>{matches.map(entry => <button className="secondary" key={entry.id} onClick={() => compare(row, entry.id)}>Conferir com {entry.name}</button>)}</div>
            : row.date <= ledger.cutoff ? <span>Anterior ou igual ao corte</span>
            : <div>
              {pending.map(entry => <button className="secondary" key={entry.id} onClick={() => edit({
                ...entry, date: row.date, name: entry.name, status: 'confirmed',
                from: row.value < 0 ? statementAccount : undefined, to: row.value > 0 ? statementAccount : undefined,
                gross: row.gross ?? entry.gross, fee: row.fee ?? entry.fee, anticipation: row.anticipation ?? entry.anticipation,
                statement: {key, account: statementAccount, row},
              })}>Confirmar {entry.name}</button>)}
              <button className="secondary" onClick={() => edit({
                name: row.name, date: row.date, amount: Math.abs(row.value), status: 'confirmed',
                kind: row.value > 0 ? 'receipt' : 'expense',
                from: row.value < 0 ? statementAccount : undefined, to: row.value > 0 ? statementAccount : undefined,
                gross: row.gross, fee: row.fee, anticipation: row.anticipation,
                statement: {key, account: statementAccount, row},
              })}>Revisar e lançar</button>
            </div>}
        </div>;
      })}
    </section>}
    {tab === 'Contas e recorrências' && <>
      <section className="card">
        <h2>Contas pessoais e da empresa</h2>
        <p>Data de corte {formatDate(ledger.cutoff)}. Use Adiantamento ou Devolução quando a transferência também alterar a dívida com você.</p>
        {balances.map(account => <div className="cf-line" key={account.id}><span>{account.name}<small>{account.business ? 'Empresa' : 'Pessoal'}</small></span><strong>{showMoney(account.balance)}</strong></div>)}
        <form action={data => {
          const name = field(data, 'name'), opening = cents(field(data, 'opening') || '0');
          if (!name || !Number.isSafeInteger(opening)) {setMessage('Confira o nome e o saldo da conta.'); return;}
          const account = {id: crypto.randomUUID(), name, business: field(data, 'group') === 'business', opening};
          save(current => ({...(current ?? ledger), accounts: [...(current ?? ledger).accounts, account]}));
          setMessage('Conta cadastrada.');
        }}>
          <div className="form-grid"><label>Nome da conta<input name="name" required/></label><label>Grupo<select name="group"><option value="personal">Pessoal</option><option value="business">Empresa</option></select></label><label>Saldo na data de corte<input name="opening" inputMode="decimal" placeholder="0,00"/></label></div>
          <button className="secondary">Cadastrar conta</button>
        </form>
      </section>
      <section className="card">
        <h2>Recorrências mensais</h2>
        {ledger.recurring.map(item => <div className="cf-line" key={item.id}><span>{item.name}<small>{entryLabels[item.kind]} · dia {item.day}</small></span><strong>{item.amount === 0 ? 'A definir' : showMoney(item.amount)}</strong>
          <button className="secondary" onClick={() => setEditingRule(item.id)}>Editar regra</button></div>)}
        <form key={editingRule ?? 'new'} action={data => {
          const old = ledger.recurring.find(item => item.id === editingRule);
          const name = field(data, 'name'), day = Number(field(data, 'day'));
          const start = field(data, 'start'), kind = field(data, 'kind') as EntryKind;
          const amount = cents(field(data, 'amount') || (kind === 'expense' ? '0' : ''));
          if (!name || !Number.isSafeInteger(amount) || amount < 0 || (amount === 0 && kind !== 'expense') || !Number.isInteger(day) || day < 1 || day > 31 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(start) || start < cutoffMonth) {setMessage('Confira o valor, o dia e o mês inicial.'); return;}
          const rule = {...old, id: old?.id ?? crypto.randomUUID(), name, amount, day, kind, start};
          save(current => {
            const base = current ?? ledger;
            const previous = entriesThrough(base, monthEnd(today.slice(0, 7))).filter(entry =>
              editingRule && entry.id.startsWith(editingRule + ':') && entry.date && entry.date < start + '-01' &&
              !base.entries.some(saved => saved.id === entry.id));
            return {...base, entries: [...base.entries, ...previous], recurring: [...base.recurring.filter(item => item.id !== editingRule), rule]};
          });
          setEditingRule(null);
          setMessage('Recorrência salva.');
        }}>
          <RecurrenceFields rule={ledger.recurring.find(item => item.id === editingRule)} today={today} cutoffMonth={cutoffMonth}/>
          <button className="secondary">{editingRule ? 'Salvar regra' : 'Adicionar recorrência'}</button>
          {editingRule && <button type="button" className="secondary" onClick={() => setEditingRule(null)}>Cancelar edição</button>}
        </form>
      </section>
    </>}
  </div>;
}

function Metric({label, value}: {label: string; value: number}) {
  return <div><span>{label}</span><strong>{showMoney(value)}</strong></div>;
}

function RecurrenceFields({rule, today, cutoffMonth}: {rule?: CompanyFinance['recurring'][number]; today: string; cutoffMonth: string}) {
  return <div className="form-grid">
    <label>Descrição<input name="name" defaultValue={rule?.name} required/></label>
    <label>Tipo<select name="kind" defaultValue={rule?.kind}>{(['receipt', 'expense', 'card'] as const).map(kind => <option value={kind} key={kind}>{entryLabels[kind]}</option>)}</select></label>
    <label>Valor previsto<input name="amount" defaultValue={amountInput(rule?.amount || undefined)} inputMode="decimal"/>
      <small>Para uma despesa com valor a definir, deixe em branco.</small></label>
    <label>Dia do mês<input name="day" type="number" min="1" max="31" defaultValue={rule?.day} required/></label>
    <label>{rule ? 'Aplicar a partir de' : 'Começar em'}<input type="month" name="start" min={cutoffMonth} defaultValue={nextMonth(today.slice(0, 7))} required/></label>
  </div>;
}

function EntryEditor({draft, accounts, today, save, close, remove}: {
  draft: Draft; accounts: FinanceAccount[]; today: string; save: (value: CashEntry) => void; close: () => void; remove: () => void;
}) {
  const [kind, setKind] = useState<EntryKind>(draft.kind ?? 'receipt');
  const [status, setStatus] = useState(draft.status ?? 'confirmed');
  const amountOptional = kind === 'expense' && status === 'planned';
  const source = ['expense', 'transfer', 'advance', 'refund', 'personalExpense', 'cardPayment'].includes(kind);
  const destination = ['receipt', 'transfer', 'advance', 'refund'].includes(kind);
  return <section className="card">
    <h2>{draft.id ? 'Editar movimentação' : 'Novo lançamento'}</h2>
    <form onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const entry: CashEntry = {
        id: draft.id ?? crypto.randomUUID(), name: field(data, 'name'), kind, amount: cents(field(data, 'amount') || (amountOptional ? '0' : '')),
        date: field(data, 'date'), status: kind === 'cardPayment' ? 'confirmed' : status,
      };
      if (source) entry.from = field(data, 'from') || undefined;
      if (destination) entry.to = field(data, 'to') || undefined;
      if (kind === 'cardPayment' || kind === 'card') entry.invoice = field(data, 'invoice') || undefined;
      if (kind === 'card') entry.due = field(data, 'due') || undefined;
      if (kind === 'receipt') {
        for (const fieldName of ['gross', 'fee', 'anticipation'] as const) {
          const value = field(data, fieldName);
          if (value) entry[fieldName] = cents(value);
        }
      }
      save(entry);
    }}>
      <div className="form-grid">
        <label>Tipo<select name="kind" value={kind} onChange={event => setKind(event.target.value as EntryKind)}>{Object.entries(entryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Descrição<input name="name" defaultValue={draft.name} required/></label>
        <label>{kind === 'receipt' ? 'Valor líquido' : 'Valor'}<input name="amount" inputMode="decimal" defaultValue={amountInput(draft.amount || undefined)} placeholder={amountOptional ? 'A definir' : undefined} required={!amountOptional}/></label>
        {kind !== 'cardPayment' && <label>Situação<select name="status" value={status} onChange={event => setStatus(event.target.value as CashEntry['status'])}><option value="confirmed">Efetivado</option><option value="planned">Previsto</option></select></label>}
        <label>{status === 'planned' && kind !== 'cardPayment' ? 'Data prevista' : 'Data efetiva'}<input name="date" type="date" defaultValue={draft.date || (status === 'confirmed' && !draft.id ? today : '')} required={status === 'confirmed' || kind === 'cardPayment'}/></label>
        {source && <AccountField name="from" label="Conta de origem" defaultValue={draft.from} accounts={accounts}/>}
        {destination && <AccountField name="to" label="Conta de destino" defaultValue={draft.to} accounts={accounts}/>}
        {(kind === 'card' || kind === 'cardPayment') && <label>Data de pagamento da fatura<input name="invoice" type="date" required={kind === 'cardPayment'} defaultValue={draft.invoice}/></label>}
        {kind === 'card' && <label>Vencimento informado da fatura<input name="due" type="date" defaultValue={draft.due}/></label>}
      </div>
      {kind === 'receipt' && <details open={draft.gross !== undefined || draft.fee !== undefined || draft.anticipation !== undefined}>
        <summary>Valor bruto e taxas de cartão</summary>
        <div className="form-grid">{([['gross', 'Valor bruto'], ['fee', 'Taxa do cartão'], ['anticipation', 'Taxa de antecipação']] as const).map(([name, label]) => <label key={name}>{label}<input name={name} inputMode="decimal" defaultValue={amountInput(draft[name])}/></label>)}</div>
      </details>}
      <div className="cf-toolbar"><button className="primary">Salvar</button><button type="button" className="secondary" onClick={close}>Fechar</button>
        {draft.id && <button type="button" className="secondary" onClick={remove}>Cancelar lançamento</button>}</div>
    </form>
  </section>;
}

function AccountField({name, label, defaultValue, accounts}: {name: string; label: string; defaultValue?: string; accounts: FinanceAccount[]}) {
  return <label>{label}<select name={name} defaultValue={defaultValue ?? ''}><option value="">Selecione</option>
    {accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.business ? 'empresa' : 'pessoal'}</option>)}</select></label>;
}
