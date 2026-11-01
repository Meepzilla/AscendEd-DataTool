import { strFromU8, unzipSync } from 'fflate';

// Reads the first worksheet of an Excel workbook (.xlsx) into rows of cell values, for importing students.
// An .xlsx file is a zip of XML files: the worksheet holds numbers and pointers into a shared list of strings,
// and a cell's style says whether its number is a date. Only what an import needs is read: text, numbers,
// true/false and dates (as YYYY-MM-DD). Formulas give their last calculated value.

export type CellValue = string | number | boolean | null;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m);

/** All the text in an element, joining rich-text runs (<r><t>…</t></r>) and leaving out phonetic hints (<rPh>). */
const textOf = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join('');

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

// Built-in number formats that show a date (ECMA-376 18.8.30).
const BUILT_IN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** Which cell styles (by index) show a date. */
function dateStyles(stylesXml: string | undefined): Set<number> {
  const result = new Set<number>();
  if (!stylesXml) return result;
  const custom = new Map<number, string>();
  for (const m of stylesXml.matchAll(/<numFmt\b[^>]*>/g)) custom.set(Number(attr(m[0], 'numFmtId')), decode(attr(m[0], 'formatCode') ?? ''));
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? '';
  [...xfs.matchAll(/<xf\b[^>]*>/g)].forEach((m, index) => {
    const id = Number(attr(m[0], 'numFmtId') ?? 0);
    // A custom format is a date if it has day, month or year codes outside quoted text and [colour] brackets.
    const code = (custom.get(id) ?? '').replace(/"[^"]*"|\[[^\]]*\]/g, '');
    if (BUILT_IN_DATE_FORMATS.has(id) || /[dy]|m{3,}/i.test(code)) result.add(index);
  });
  return result;
}

/** A spreadsheet date number as YYYY-MM-DD (days since 30 Dec 1899, or since 1 Jan 1904 in 1904 workbooks). */
export function serialToDate(serial: number, date1904 = false): string {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Column letters ("A", "AB") as a 0-based index. */
const columnIndex = (ref: string) => [...ref.replace(/\d+$/, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** The rows of the workbook's first worksheet. Throws if the file isn't a workbook. */
export function readXlsx(data: Uint8Array): CellValue[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, { filter: f => f.name.startsWith('xl/') && f.name.endsWith('.xml') || f.name.endsWith('.rels') });
  } catch {
    throw new Error('This file isn\'t an Excel workbook (.xlsx).');
  }
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : undefined);
  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new Error('This file isn\'t an Excel workbook (.xlsx).');

  // The first sheet in the workbook's order, found through its relationship id.
  const firstSheet = /<sheet\b[^>]*>/.exec(workbook)?.[0] ?? '';
  const relId = attr(firstSheet, 'r:id');
  const rels = read('xl/_rels/workbook.xml.rels') ?? '';
  const target = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0]).find(r => attr(r, 'Id') === relId);
  const targetPath = target ? attr(target, 'Target')! : 'worksheets/sheet1.xml';
  const sheetPath = targetPath.startsWith('/') ? targetPath.slice(1) : `xl/${targetPath}`;
  const sheet = read(sheetPath);
  if (!sheet) throw new Error('The workbook has no worksheet to read.');

  const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(workbook);
  const shared = [...(read('xl/sharedStrings.xml') ?? '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]));
  const dates = dateStyles(read('xl/styles.xml'));

  const rows: CellValue[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(attr(rowMatch[1], 'r')) || rows.length + 1;
    const row: CellValue[] = [];
    for (const cell of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, attrs, body = ''] = cell;
      const ref = attr(attrs, 'r');
      const col = ref ? columnIndex(ref) : row.length;
      const type = attr(attrs, 't');
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: CellValue = null;
      if (type === 'inlineStr') value = textOf(body);
      else if (raw === undefined) value = null;
      else if (type === 's') value = shared[Number(raw)] ?? null;
      else if (type === 'str' || type === 'e') value = decode(raw);
      else if (type === 'b') value = raw === '1';
      else {
        const n = Number(raw);
        value = Number.isFinite(n) && dates.has(Number(attr(attrs, 's') ?? 0)) ? serialToDate(n, date1904) : n;
      }
      row[col] = value;
    }
    rows[rowNumber - 1] = Array.from(row, v => v ?? null);
  }
  return Array.from(rows, r => r ?? []);
}
