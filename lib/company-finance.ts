export const entryLabels = {
  receipt: 'Recebimento', expense: 'Despesa', transfer: 'Transferência entre contas',
  advance: 'Adiantamento da titular', refund: 'Devolução à titular',
  personalExpense: 'Despesa da empresa paga pela titular',
  card: 'Compra no cartão', cardPayment: 'Pagamento de fatura',
} as const;

export type EntryKind = keyof typeof entryLabels;
export type FinanceAccount = { id: string; name: string; business: boolean; opening: number };
export type CashEntry = {
  id: string; name: string; kind: EntryKind; amount: number; date: string;
  status: 'planned' | 'confirmed' | 'cancelled'; from?: string; to?: string;
  invoice?: string; due?: string; gross?: number; fee?: number; anticipation?: number;
};
export type Recurrence = Omit<CashEntry, 'date' | 'status' | 'invoice' | 'due'> & { day: number; start: string };
export type CompanyFinance = {
  version: 1; cutoff: string; openingDebt: number; openingDebtNote?: string; accounts: FinanceAccount[];
  card: { closingDay: number; paymentDay: number; limit: number };
  entries: CashEntry[]; recurring: Recurrence[]; reconciled: Record<string, string>;
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
}
export function monthEnd(month: string) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}
export function nextMonth(month: string) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
}
function dateInMonth(month: string, day: number) {
  return month + '-' + String(Math.min(day, Number(monthEnd(month).slice(-2)))).padStart(2, '0');
}
export function invoiceDate(card: CompanyFinance['card'], purchaseDate: string) {
  let month = purchaseDate.slice(0, 7);
  if (Number(purchaseDate.slice(-2)) > card.closingDay) month = nextMonth(month);
  if (card.paymentDay <= card.closingDay) month = nextMonth(month);
  return dateInMonth(month, card.paymentDay);
}
export function entriesThrough(finance: CompanyFinance, through: string) {
  const entries = new Map(finance.entries.map(entry => [entry.id, entry]));
  for (const recurring of finance.recurring) {
    const { day, start, ...template } = recurring;
    for (let month = start; month <= through.slice(0, 7); month = nextMonth(month)) {
      const id = recurring.id + ':' + month;
      if (entries.has(id)) continue;
      const date = dateInMonth(month, day);
      if (date > through) continue;
      entries.set(id, {...template, id, date, status: 'planned'});
    }
  }
  return [...entries.values()].filter(entry => entry.status !== 'cancelled').map(entry => (
    entry.kind === 'card' && entry.date && !entry.invoice
      ? {...entry, invoice: invoiceDate(finance.card, entry.date)}
      : entry
  ));
}
export function accountEffect(entry: CashEntry, account: string) {
  if (entry.kind === 'card' || entry.status === 'cancelled') return 0;
  return (entry.to === account ? entry.amount : 0) - (entry.from === account ? entry.amount : 0);
}
export function snapshot(finance: CompanyFinance, through: string) {
  const posted = finance.entries.filter(entry => entry.status === 'confirmed' && entry.date > finance.cutoff && entry.date <= through);
  const balances = finance.accounts.map(account => ({
    ...account, balance: account.opening + posted.reduce((sum, entry) => sum + accountEffect(entry, account.id), 0),
  }));
  const cash = balances.filter(account => account.business).reduce((sum, account) => sum + account.balance, 0);
  const debt = posted.reduce((sum, entry) => {
    if (entry.kind === 'advance' || entry.kind === 'personalExpense') return sum + entry.amount;
    return entry.kind === 'refund' ? sum - entry.amount : sum;
  }, finance.openingDebt);
  return {balances, cash, debt};
}
export function openInvoices(entries: CashEntry[], through: string) {
  const invoices = new Map<string, {date: string; posted: number; estimated: number; paid: number}>();
  for (const entry of entries) {
    if (!entry.invoice || (entry.kind !== 'card' && entry.kind !== 'cardPayment')) continue;
    const invoice = invoices.get(entry.invoice) ?? {date: entry.invoice, posted: 0, estimated: 0, paid: 0};
    if (entry.kind === 'cardPayment') {
      if (entry.status === 'confirmed' && entry.date <= through) invoice.paid += entry.amount;
    } else if (entry.status === 'confirmed' && entry.date <= through) invoice.posted += entry.amount;
    else invoice.estimated += entry.amount;
    invoices.set(invoice.date, invoice);
  }
  return [...invoices.values()].map(invoice => ({
    ...invoice, open: Math.max(0, invoice.posted + invoice.estimated - invoice.paid),
    confirmedOpen: Math.max(0, invoice.posted - invoice.paid),
  })).sort((first, second) => first.date.localeCompare(second.date));
}
export function businessEffect(finance: CompanyFinance, entry: CashEntry) {
  if (entry.amount === 0 || entry.kind === 'card' || entry.status === 'cancelled') return 0;
  // An account can be chosen at settlement for forecast-only operating entries.
  if (entry.kind === 'receipt' && !entry.to) return entry.amount;
  if (entry.kind === 'expense' && !entry.from) return -entry.amount;
  return finance.accounts.filter(account => account.business)
    .reduce((sum, account) => sum + accountEffect(entry, account.id), 0);
}
export function periodActivity(finance: CompanyFinance, start: string, end: string) {
  const entries = finance.entries.filter(entry => entry.status === 'confirmed' && entry.date > finance.cutoff && entry.date >= start && entry.date <= end);
  return {
    receipts: entries.filter(entry => entry.kind === 'receipt').reduce((sum, entry) => sum + entry.amount, 0),
    cashPaid: entries.filter(entry => entry.kind === 'expense' || entry.kind === 'cardPayment')
      .reduce((sum, entry) => sum - businessEffect(finance, entry), 0),
    ...snapshot(finance, end),
  };
}
export function cents(value: string) {
  const normalized = value.trim().replace(/^(?:R\$)\s*/, '');
  const decimal = normalized.includes(',') ? normalized.replaceAll('.', '').replace(',', '.') : normalized;
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(decimal)) return NaN;
  const amount = Math.round(Number(decimal) * 100);
  return Number.isSafeInteger(amount) ? amount : NaN;
}

export function validateEntry(entry: CashEntry, accounts: FinanceAccount[]) {
  if (!entry.name.trim() || (entry.date && !validDate(entry.date)))
    throw new Error('Informe uma descrição e use uma data válida.');
  const awaitingAmount = entry.kind === 'expense' && entry.status === 'planned' && entry.date && entry.amount === 0;
  if (!Number.isSafeInteger(entry.amount) || (entry.amount <= 0 && !awaitingAmount))
    throw new Error('Informe um valor positivo ou mantenha a despesa com data como Previsto até definir o valor.');
  if (entry.status === 'confirmed' && !entry.date) throw new Error('Informe a data efetiva.');
  if ((entry.invoice && !validDate(entry.invoice)) || (entry.due && !validDate(entry.due)))
    throw new Error('Informe datas válidas para a fatura.');
  const from = accounts.find(account => account.id === entry.from);
  const to = accounts.find(account => account.id === entry.to);
  switch (entry.kind) {
    case 'receipt':
      if ((entry.to || entry.status === 'confirmed') && !to?.business) throw new Error('Escolha a conta da empresa que recebeu.');
      for (const number of [entry.gross, entry.fee, entry.anticipation]) {
        if (number !== undefined && (!Number.isSafeInteger(number) || number < 0)) throw new Error('Confira o bruto e as taxas.');
      }
      if (entry.gross !== undefined && entry.gross - (entry.fee ?? 0) - (entry.anticipation ?? 0) !== entry.amount)
        throw new Error('O valor líquido deve ser o bruto menos as taxas.');
      break;
    case 'expense':
      if ((entry.from || entry.status === 'confirmed') && !from?.business) throw new Error('Escolha a conta da empresa que pagou.');
      break;
    case 'cardPayment':
      if (!from?.business || !entry.invoice || entry.status !== 'confirmed') throw new Error('Informe a fatura e a conta da empresa que pagou.');
      break;
    case 'transfer':
      if (!from || !to || from === to) throw new Error('Escolha duas contas diferentes.');
      break;
    case 'advance':
      if (!from || from.business || !to?.business) throw new Error('Escolha uma conta pessoal de origem e uma conta da empresa de destino.');
      break;
    case 'refund':
      if (!from?.business || !to || to.business) throw new Error('Escolha uma conta da empresa de origem e uma conta pessoal de destino.');
      break;
    case 'personalExpense':
      if (!from || from.business) throw new Error('Escolha a conta pessoal que fez o pagamento.');
      break;
    case 'card':
      if (!entry.date && !entry.invoice) throw new Error('Informe a data da compra ou da fatura.');
      break;
  }
}

export function readFinanceSetup(text: string): CompanyFinance {
  const data = JSON.parse(text) as CompanyFinance;
  if (data?.version !== 1 || !validDate(data.cutoff) || !Number.isSafeInteger(data.openingDebt) ||
      (data.openingDebtNote !== undefined && typeof data.openingDebtNote !== 'string') ||
      !Array.isArray(data.accounts) || !Array.isArray(data.entries) || !Array.isArray(data.recurring) ||
      !data.card || ![data.card.closingDay, data.card.paymentDay].every(day => Number.isInteger(day) && day >= 1 && day <= 31) ||
      !Number.isSafeInteger(data.card.limit) || data.card.limit <= 0) throw new Error('Arquivo de configuração financeira inválido.');
  const unique = (items: {id: string}[]) => new Set(items.map(item => item.id)).size === items.length;
  if (!unique(data.accounts) || !unique(data.recurring) || !unique(data.entries) ||
      data.accounts.some(account => !account.id || !account.name?.trim() || typeof account.business !== 'boolean' || !Number.isSafeInteger(account.opening)))
    throw new Error('Confira as contas e os identificadores no arquivo.');
  for (const entry of data.entries) {
    if (!Object.hasOwn(entryLabels, entry.kind) || !['confirmed', 'planned', 'cancelled'].includes(entry.status)) throw new Error('Tipo ou situação inválida.');
    validateEntry(entry, data.accounts);
  }
  for (const item of data.recurring) {
    if (!['receipt', 'expense', 'card'].includes(item.kind) || !monthPattern.test(item.start) || item.start < data.cutoff.slice(0, 7) ||
        !Number.isInteger(item.day) || item.day < 1 || item.day > 31) throw new Error('Confira as recorrências no arquivo.');
    validateEntry({...item, date: dateInMonth(item.start, item.day), status: 'planned'}, data.accounts);
  }
  return {...data, reconciled: {}};
}
