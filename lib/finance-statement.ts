import { cents, validDate } from './company-finance.ts';
import type {ExtractedRow} from './finance-pdf.ts';

export type StatementRow = Omit<ExtractedRow, 'reference'> & { id: string };

function statementDate(text: string) {
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const date = brazilian ? [brazilian[3], brazilian[2], brazilian[1]].join('-') : text;
  return validDate(date) ? date : '';
}

function csvRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && (character === delimiter || character === '\n')) {
      row.push(field.trim());
      field = '';
      if (character === '\n') { rows.push(row); row = []; }
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('O CSV tem aspas sem fechamento.');
  rows.push([...row, field.trim()]);
  return rows;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fromCsv(text: string) {
  const dates = ['data', 'date', 'data lancamento', 'data do lancamento', 'data movimento'];
  const amounts = ['valor', 'amount', 'valor (r$)', 'valor da transacao', 'valor lancamento'];
  const descriptions = ['descricao', 'description', 'historico', 'descricao da transacao', 'lancamento', 'movimentacao', 'detalhes'];
  for (const delimiter of [';', ',', '\t']) {
    const rows = csvRows(text, delimiter);
    for (const [index, row] of rows.entries()) {
      const header = row.map(normalize);
      const date = header.findIndex(value => dates.includes(value));
      const amount = header.findIndex(value => amounts.includes(value));
      const description = header.findIndex(value => descriptions.includes(value));
      if (date < 0 || amount < 0 || description < 0) continue;
      const identifier = header.findIndex(value => ['id', 'identificador', 'fitid'].includes(value));
      return rows.slice(index + 1).flatMap(values => {
        const day = statementDate(values[date] ?? '');
        const value = cents(values[amount] ?? '');
        return day && Number.isSafeInteger(value) && value !== 0
          ? [{date: day, value, name: values[description] || 'Movimentação', reference: values[identifier]}]
          : [];
      });
    }
  }
  throw new Error('Use um CSV com as colunas Data, Valor com sinal e Descrição, ou importe um OFX.');
}

function fromOfx(text: string) {
  const field = (block: string, tag: string) => new RegExp('<' + tag + '>\\s*([^<\\r\\n]+)', 'i').exec(block)?.[1].trim() ?? '';
  return [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].flatMap(([, block]) => {
    const raw = field(block, 'DTPOSTED');
    const date = [raw.slice(0, 4), raw.slice(4, 6), raw.slice(6, 8)].join('-');
    const value = cents(field(block, 'TRNAMT'));
    const name = [field(block, 'NAME'), field(block, 'MEMO')].filter(Boolean).join(' · ') || 'Movimentação';
    return validDate(date) && Number.isSafeInteger(value) && value !== 0
      ? [{date, value, name, reference: field(block, 'FITID')}]
      : [];
  });
}

export async function readStatement(file: File): Promise<StatementRow[]> {
  if (file.size > 5_000_000) throw new Error('Selecione um extrato de até 5 MB.');
  let parsed: ExtractedRow[];
  if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
    const {readPdfTransactions} = await import('./finance-pdf');
    parsed = await readPdfTransactions(file);
  } else {
    const utf8 = await file.text();
    const text = utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(await file.arrayBuffer()) : utf8;
    parsed = /<OFX[>\s]/i.test(text) ? fromOfx(text) : fromCsv(text);
  }
  if (!parsed.length) throw new Error('O extrato não trouxe movimentações com data e valor reconhecíveis.');
  const counts = new Map<string, number>();
  return parsed.map(({reference, ...row}) => {
    const key = JSON.stringify(reference ? ['id', reference] : [row.date, row.value, row.name]);
    const number = (counts.get(key) ?? 0) + 1;
    counts.set(key, number);
    return {...row, id: key + ':' + number};
  });
}
