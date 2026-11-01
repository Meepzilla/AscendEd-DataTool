// The text of a PDF as lines, page by page, for importing students from an "IEP at a Glance" PDF. Uses pdf.js
// (the legacy build, which runs on older iPads too), loaded only when a PDF is imported. Text on the same
// baseline is one line, read left to right, so a form's two columns ("Name: …   Eligibility: …") stay together.

import type { TextItem } from 'pdfjs-dist/types/src/display/api';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjs: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs').then(lib => {
    if (typeof window !== 'undefined' && !lib.GlobalWorkerOptions.workerSrc) {
      // Served from this site (the bundler copies the worker), so it works offline and within the site's CSP.
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    }
    return lib;
  });
  return pdfjs;
}

/** Lines of text on each page. Throws if the file isn't a PDF or has no text (a scan). */
export async function readPdfLines(data: Uint8Array): Promise<string[][]> {
  const lib = await loadPdfJs();
  let doc;
  try {
    // A copy: pdf.js takes over the buffer it is given.
    doc = await lib.getDocument({ data: data.slice(), useSystemFonts: false, disableFontFace: true }).promise;
  } catch {
    throw new Error('This file couldn\'t be read as a PDF.');
  }
  try {
    const pages: string[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(toLines(content.items.filter((item): item is TextItem => 'str' in item)));
      page.cleanup();
    }
    if (!pages.some(lines => lines.length > 0)) throw new Error('This PDF has no text to read (it may be a scan). Export it from the program that made it instead.');
    return pages;
  } finally {
    void doc.destroy();
  }
}

/** Groups text pieces into lines by their baseline (top to bottom), each read left to right. */
export function toLines(items: Pick<TextItem, 'str' | 'transform' | 'width'>[]): string[] {
  const rows: { y: number; parts: { x: number; end: number; str: string }[] }[] = [];
  for (const item of items) {
    if (!item.str) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let row = rows.find(r => Math.abs(r.y - y) < 2);
    if (!row) { row = { y, parts: [] }; rows.push(row); }
    row.parts.push({ x, end: x + item.width, str: item.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => {
      const parts = row.parts.sort((a, b) => a.x - b.x);
      let text = '';
      let end = -Infinity;
      for (const part of parts) {
        // A gap between pieces is a space, unless one of them already has it.
        if (text && part.x - end > 1 && !/\s$/.test(text) && !/^\s/.test(part.str)) text += ' ';
        text += part.str;
        end = part.end;
      }
      return text.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);
}
