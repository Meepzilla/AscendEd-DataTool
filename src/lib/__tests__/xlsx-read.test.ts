import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readXlsx, serialToDate } from '../xlsx-read';
import { MAX_IMPORT_FILE_BYTES } from '../helpers';

describe('serialToDate', () => {
  it('is one day later than the old base before Mar 1900, keeping the phantom leap day', () => {
    expect(serialToDate(1)).toBe('1900-01-01');
    expect(serialToDate(59)).toBe('1900-02-28');
    expect(serialToDate(60)).toBe('1900-02-29');
    expect(serialToDate(61)).toBe('1900-03-01');
  });
  it('leaves modern dates unchanged', () => {
    expect(serialToDate(45658)).toBe('2025-01-01');
    expect(serialToDate(45658, true)).toBe('2029-01-02');
  });
});

describe('readXlsx', () => {
  it('rejects a file over 10 MB with a clear error', () => {
    expect(() => readXlsx(new Uint8Array(MAX_IMPORT_FILE_BYTES + 1))).toThrow(/larger than 10 MB/);
    expect(MAX_IMPORT_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
  it('still rejects a small file that is not a workbook', () => {
    expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow(/isn't an Excel workbook/);
  });

  it('replaces a bad numeric entity instead of aborting the whole import', () => {
    const xlsx = zipSync({
      'xl/workbook.xml': strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/sharedStrings.xml': strToU8('<sst><si><t>Bad &#x110000; entity</t></si><si><t>Fish &amp; Chips</t></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData></worksheet>'),
    });
    expect(readXlsx(xlsx)).toEqual([['Bad \uFFFD entity', 'Fish & Chips']]);
  });
});
