import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readXlsx, serialToDate, MAX_XLSX_DATE_SERIAL } from '../xlsx-read';
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
  it('accepts the last serial the format can hold', () => {
    expect(MAX_XLSX_DATE_SERIAL).toBe(2958465);
    expect(serialToDate(MAX_XLSX_DATE_SERIAL)).toBe('9999-12-31');
  });
  it('rejects serials outside the Excel range with an import error, not a raw RangeError', () => {
    expect(() => serialToDate(1e12)).toThrow(/outside the range Excel dates can hold/);
    expect(() => serialToDate(MAX_XLSX_DATE_SERIAL + 1)).toThrow(/outside the range Excel dates can hold/);
    expect(() => serialToDate(-5)).toThrow(/outside the range Excel dates can hold/);
    expect(() => serialToDate(Number.NaN)).toThrow(/outside the range Excel dates can hold/);
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

  it('rejects a small workbook whose XML expands past the decompressed size cap', () => {
    // A handful of shared strings made of one repeated character: a few KB in the zip, past the
    // cap in total once opened. Several moderate entries keep the fixture build fast; the cap is
    // on the total across entries, so they trip it together.
    const filler = `<si><t>${'a'.repeat(4 * 1024 * 1024)}</t></si>`;
    const xlsx = zipSync({
      'xl/workbook.xml': strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/sharedStrings.xml': strToU8(`<sst>${filler.repeat(30)}</sst>`),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>'),
    });
    expect(xlsx.length).toBeLessThan(MAX_IMPORT_FILE_BYTES);
    expect(() => readXlsx(xlsx)).toThrow(/expands to more than 100 MB/);
  }, 30000);

  it('ignores rows and cells numbered past the caps instead of allocating for them', () => {
    const xlsx = zipSync({
      'xl/workbook.xml': strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData>'
        + '<row r="1"><c r="A1" t="inlineStr"><is><t>Student Name</t></is></c><c r="ZZZZ1" t="inlineStr"><is><t>Far</t></is></c></row>'
        + '<row r="2000000"><c r="A2000000" t="inlineStr"><is><t>Ghost</t></is></c></row>'
        + '</sheetData></worksheet>'),
    });
    expect(readXlsx(xlsx)).toEqual([['Student Name']]);
  });

  it('fails the import with a clear error when a date cell holds an out-of-range serial', () => {
    const xlsx = zipSync({
      'xl/workbook.xml': strToU8('<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/styles.xml': strToU8('<styleSheet><cellXfs count="1"><xf numFmtId="14"/></cellXfs></styleSheet>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" s="0"><v>999999999999</v></c></row></sheetData></worksheet>'),
    });
    expect(() => readXlsx(xlsx)).toThrow(/outside the range Excel dates can hold/);
  });
});
