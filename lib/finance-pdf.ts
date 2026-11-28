import { cents, validDate } from './company-finance.ts';

type TextCell = {str: string; transform: ArrayLike<number>};
export type ExtractedRow = {date: string; name: string; value: number; reference?: string; gross?: number; fee?: number; anticipation?: number};
type Transaction = ExtractedRow & {invoice?: string; asaasKind?: 'gross' | 'fee' | 'anticipation'};

function pdfAmount(text: string) {
  return cents(text.replace(/R\$|\s/g, ''));
}

function linesFrom(items: TextCell[]) {
  const cells = items.filter(item => item.str.trim()).sort((a, b) => b.transform[5] - a.transform[5]);
  const lines: {y: number; cells: TextCell[]}[] = [];
  for (const cell of cells) {
    const y = cell.transform[5];
    const previous = lines.at(-1);
    if (previous && previous.y - y <= 1.8) previous.cells.push(cell);
    else lines.push({y, cells: [cell]});
  }
  for (const line of lines) line.cells.sort((a, b) => a.transform[4] - b.transform[4]);
  return lines;
}

const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
function dateParts(year: string, month: number, day: string) {
  if (month < 1) return '';
  const date = [year, String(month).padStart(2, '0'), day].join('-');
  return validDate(date) ? date : '';
}

export function parseStatementPdf(pages: TextCell[][]): ExtractedRow[] {
  const heading = pages[0]?.map(cell => cell.str).join(' ').toLowerCase() ?? '';
  const provider = heading.includes('movimentações') && /asaas|extrato gerado em/.test(heading) ? 'asaas'
    : heading.includes('saldo por transação') ? 'inter'
    : heading.includes('valores em r$') && heading.includes('movimentações') ? 'nu' : null;
  if (!provider) throw new Error('Layout de PDF desconhecido. Use o PDF de extrato do Asaas, Banco Inter ou Nu, ou exporte CSV ou OFX.');
  const transactions: Transaction[] = [];
  let date = '', subtotalSign = 0;
  for (const items of pages) {
    const lines = linesFrom(items);
    for (const [index, line] of lines.entries()) {
      const {cells} = line;
      const words = cells.map(cell => cell.str.trim());
      const first = words[0];
      if (!first) continue;
      if (provider === 'asaas') {
        const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(first);
        if (!parts || !cells.at(-1) || cells[0].transform[4] > 100 || cells.at(-1)!.transform[4] < 430) continue;
        date = dateParts(parts[3], Number(parts[2]), parts[1]);
        const value = pdfAmount(words.at(-1)!);
        const nearby = lines.slice(Math.max(0, index - 2), index + 3).filter(item => Math.abs(item.y - line.y) <= 9);
        const name = nearby.flatMap(item => item.cells.filter(cell => cell.transform[4] >= 115 && cell.transform[4] < 455))
          .map(cell => cell.str.trim()).join(' ') || 'Movimentação Asaas';
        const invoice = /fatura nr\.\s*(\d+)/i.exec(name)?.[1];
        const asaasKind = /^taxa de cartão/i.test(name) ? 'fee' : /^taxa de antecipação/i.test(name) ? 'anticipation' : value > 0 ? 'gross' : undefined;
        if (date && Number.isSafeInteger(value) && value !== 0) transactions.push({date, name, value, invoice, asaasKind});
      } else if (provider === 'inter') {
        const parts = /^(\d{2}) de (\S+) de (\d{4})$/i.exec(first);
        if (parts) {date = dateParts(parts[3], months.indexOf(parts[2].slice(0, 3).toUpperCase()) + 1, parts[1]); continue;}
        const moneyIndex = cells.findIndex((cell, i) => cell.transform[4] >= 330 && cell.transform[4] < 475 && /R\$/.test(words[i]));
        if (moneyIndex < 1 || !date || cells[0].transform[4] > 100) continue;
        const value = pdfAmount(words[moneyIndex]);
        if (Number.isSafeInteger(value) && value !== 0) transactions.push({date, value, name: words.slice(0, moneyIndex).join(' ')});
      } else {
        const parts = /^(\d{2}) ([A-Z]{3}) (\d{4})$/.exec(first);
        if (parts) {date = dateParts(parts[3], months.indexOf(parts[2]) + 1, parts[1]); subtotalSign = 0;}
        if (words.some(word => /^Total de entradas$/i.test(word))) {subtotalSign = 1; continue;}
        if (words.some(word => /^Total de saídas$/i.test(word))) {subtotalSign = -1; continue;}
        if (/^Saldo do dia$/i.test(first)) {subtotalSign = 0; continue;}
        if (!date || !subtotalSign || cells[0].transform[4] < 100 || cells[0].transform[4] > 160 || cells.at(-1)!.transform[4] < 450) continue;
        const value = pdfAmount(words.at(-1)!);
        if (Number.isSafeInteger(value) && value !== 0) transactions.push({date, value: subtotalSign * Math.abs(value), name: words.slice(0, -1).join(' ')});
      }
    }
  }
  if (provider !== 'asaas') return transactions;
  // An Asaas settlement commonly appears as a credit and separate fee rows.
  const groups = new Map<string, Transaction[]>();
  for (const row of transactions) {
    if (!row.invoice || !row.asaasKind) continue;
    const key = row.date + ':' + row.invoice;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return transactions.flatMap(row => {
    const key = row.date + ':' + row.invoice;
    const group = groups.get(key);
    if (!group || group.filter(item => item.asaasKind === 'gross').length !== 1) return [row];
    if (row.asaasKind !== 'gross') return [];
    const fee = -group.filter(item => item.asaasKind === 'fee').reduce((sum, item) => sum + item.value, 0);
    const anticipation = -group.filter(item => item.asaasKind === 'anticipation').reduce((sum, item) => sum + item.value, 0);
    return [{date: row.date, name: row.name, value: row.value - fee - anticipation, reference: 'asaas:' + key, gross: row.value, fee, anticipation}];
  });
}

export async function readPdfTransactions(file: File) {
  // PDF.js ships prebundled ESM. Serve it as-is so Next's bundler does not wrap its module runtime.
  const libraryUrl = new URL('pdfjs-dist/build/pdf.mjs?finance-pdf-asset', import.meta.url);
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs?finance-pdf-asset', import.meta.url);
  const {getDocument, PDFWorker}: typeof import('pdfjs-dist') = await import(/* webpackIgnore: true */ libraryUrl.href);
  const port = new Worker(workerUrl, {type: 'module'});
  const worker = PDFWorker.create({port});
  const task = getDocument({data: new Uint8Array(await file.arrayBuffer()), worker, isEvalSupported: false, disableFontFace: true});
  try {
    const document = await task.promise;
    if (document.numPages > 80) throw new Error('Selecione um PDF de até 80 páginas.');
    const pages: TextCell[][] = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      pages.push((await page.getTextContent()).items.filter((item): item is Extract<typeof item, {str: string}> => 'str' in item));
      page.cleanup();
    }
    return parseStatementPdf(pages);
  } finally {
    try {await task.destroy();} finally {worker.destroy(); port.terminate();}
  }
}
