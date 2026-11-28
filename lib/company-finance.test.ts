import assert from 'node:assert/strict';
import {test} from 'node:test';
import {businessEffect, entriesThrough, invoiceDate, openInvoices, snapshot, validateEntry, type CashEntry, type CompanyFinance} from './company-finance.ts';
import {readStatement} from './finance-statement.ts';

const opening = (): CompanyFinance => ({
  version: 1,
  cutoff: '2026-11-28',
  openingDebt: 10000,
  accounts: [
    {id: 'a', name: 'Empresa A', business: true, opening: 20000},
    {id: 'b', name: 'Empresa B', business: true, opening: 10000},
    {id: 'pf', name: 'Pessoal', business: false, opening: 30000},
  ],
  card: {closingDay: 17, paymentDay: 24, limit: 50000},
  entries: [], recurring: [], reconciled: {},
});

test('transferências preservam caixa consolidado e adiantamentos/devoluções atualizam a dívida', () => {
  const finance = opening();
  finance.entries = [
    {id: 'historical', kind: 'transfer', date: '2026-11-25', status: 'confirmed', from: 'a', to: 'b', name: 'Histórico', amount: 9999},
    {id: 'transfer', kind: 'transfer', date: '2026-12-01', status: 'confirmed', from: 'a', to: 'b', name: 'Entre contas da empresa', amount: 4000},
    {id: 'advance', kind: 'advance', date: '2026-12-01', status: 'confirmed', from: 'pf', to: 'a', name: 'Adiantamento', amount: 6000},
    {id: 'refund', kind: 'refund', date: '2026-12-02', status: 'confirmed', from: 'b', to: 'pf', name: 'Devolução', amount: 2000},
    {id: 'expense', kind: 'personalExpense', date: '2026-12-03', status: 'confirmed', from: 'pf', name: 'Despesa pela titular', amount: 1250},
  ];
  for (const entry of finance.entries) validateEntry(entry, finance.accounts);
  assert.deepEqual(snapshot(finance, finance.cutoff).balances.map(item => item.balance), [20000, 10000, 30000]);
  assert.equal(businessEffect(finance, finance.entries[1]), 0);
  assert.deepEqual(snapshot(finance, '2026-12-03').balances.map(item => item.balance), [22000, 12000, 24750]);
  assert.equal(snapshot(finance, '2026-12-03').cash, 34000);
  assert.equal(snapshot(finance, '2026-12-03').debt, 15250);
});

test('a compra gera fatura e só o pagamento tira dinheiro do caixa', () => {
  const finance = opening();
  assert.equal(invoiceDate(finance.card, '2026-12-17'), '2026-12-24');
  assert.equal(invoiceDate(finance.card, '2026-12-18'), '2027-01-24');
  const purchase: CashEntry = {id: 'purchase', date: '2026-12-09', amount: 9000, kind: 'card', status: 'confirmed', name: 'Compra'};
  const payment: CashEntry = {id: 'payment', date: '2026-12-24', invoice: '2026-12-24', amount: 9000, kind: 'cardPayment', status: 'confirmed', name: 'Pagamento', from: 'a'};
  finance.entries = [purchase, payment];
  const entries = entriesThrough(finance, '2027-01-01');
  assert.equal(openInvoices(entries, '2026-12-23')[0].open, 9000);
  assert.equal(openInvoices(entries, '2026-12-24')[0].open, 0);
  assert.equal(snapshot(finance, '2026-12-23').cash, 30000);
  assert.equal(snapshot(finance, '2026-12-24').cash, 21000);
});

test('a baixa com valor líquido substitui a parcela projetada sem duplicar a recorrência', () => {
  const finance = opening();
  finance.recurring = [{id: 'sale', start: '2026-12', day: 20, kind: 'receipt', amount: 10000, name: 'Parcela de teste'}];
  const planned = entriesThrough(finance, '2026-12-31')[0];
  const entry: CashEntry = {...planned, amount: 9000, status: 'confirmed', date: '2026-12-12', to: 'a', gross: 10000, fee: 600, anticipation: 400};
  validateEntry(entry, finance.accounts);
  finance.entries = [entry];
  assert.deepEqual(entriesThrough(finance, '2026-12-31'), [entry]);
  assert.equal(snapshot(finance, '2026-12-31').cash, 39000);
  assert.throws(() => validateEntry({...entry, amount: 9900}, finance.accounts), /bruto menos as taxas/);
});

test('conciliação lê CSV e OFX e mantém identificadores estáveis', async () => {
  const csv = new File(['Data;Valor;Identificador;Descrição\r\n01/12/2026;-5,20;1;"Nome; detalhe"\r\n02/12/2026;50,55;2;Pix\r\n'], 'teste.csv');
  const ofx = new File(['<OFX><STMTTRN>\n<DTPOSTED>20261203\n<TRNAMT>-12.34\n<FITID>abc\n<NAME>Pix\n</STMTTRN></OFX>'], 'teste.ofx');
  const parsed = await readStatement(csv);
  assert.deepEqual(parsed.map(({date, name, value}) => ({date, name, value})), [
    {date: '2026-12-01', name: 'Nome; detalhe', value: -520},
    {date: '2026-12-02', name: 'Pix', value: 5055},
  ]);
  assert.deepEqual(await readStatement(csv), parsed);
  assert.equal((await readStatement(ofx))[0].value, -1234);
});

test('uma despesa recorrente sem valor fica agendada e só afeta o caixa quando efetivada', () => {
  const finance = opening();
  finance.recurring = [{id: 'expense', start: '2026-12', day: 1, kind: 'expense', amount: 0, name: 'Despesa recorrente'}];
  const plans = entriesThrough(finance, '2027-01-31');
  assert.deepEqual(plans.map(item => item.date), ['2026-12-01', '2027-01-01']);
  validateEntry(plans[0], finance.accounts);
  assert.equal(businessEffect(finance, plans[0]), 0);
  assert.throws(() => validateEntry({...plans[0], status: 'confirmed', from: 'a'}, finance.accounts), /valor positivo/);
  finance.entries = [{...plans[0], status: 'confirmed', from: 'a', amount: 5000}];
  assert.equal(entriesThrough(finance, '2027-01-31').length, 2);
  assert.equal(snapshot(finance, '2026-12-01').cash, 25000);
  assert.equal(snapshot(finance, '2026-12-01').debt, 10000);
});
