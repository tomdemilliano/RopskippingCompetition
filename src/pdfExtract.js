/**
 * pdfExtract.js — SkipFlow
 *
 * Haalt uit een PDF-bestand de ruwe bouwstenen die pdfSchedule.js nodig heeft:
 * tekst gegroepeerd in rijen/kolommen op basis van (x, y)-positie, en welke
 * tekstfragmenten doorstreept zijn.
 *
 * Bewust gescheiden van pdfSchedule.js (de grammatica-parser, die geen
 * pdfjs-dist kent) zodat de grammatica zelf met gewone objecten getest kan
 * worden. Bewust gescheiden van pdfImport.js (de browser/Vite-laag die de
 * pdfjs-worker instelt) zodat dit bestand ook in een kaal Node-script werkt
 * (pdfjs-dist valt dan terug op een synchrone "fake worker").
 *
 * Doorstreping wordt gedetecteerd via de content-stream operatorlist: Gymfed-
 * schema's tekenen een doorstreping als een losse horizontale lijn (een
 * moveTo+lineTo-pad, subop [13,14]) gevolgd door stroke() — te onderscheiden
 * van tabelranden/achtergronden, die als rechthoekpaden (subop [19]) getekend
 * worden. Geverifieerd tegen een echt Gymfed-schema (zie ARCHITECTURE.md).
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROW_Y_TOLERANCE = 1.5;
const STRIKE_X_OVERLAP_MIN = 0.5; // minstens 50% overlap tussen streep en tekst-breedte
const STRIKE_Y_SLACK = 1.5;

function groupIntoRows(items) {
  const rows = [];
  for (const it of items) {
    if (it.str.trim() === '') continue;
    const y = it.transform[5];
    let row = rows.find(r => Math.abs(r.y - y) < ROW_Y_TOLERANCE);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({
      text:   it.str,
      x:      it.transform[4],
      width:  it.width,
      height: it.height,
      struck: false,
    });
  }
  rows.sort((a, b) => b.y - a.y);
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

async function extractStrikeSegments(page) {
  const opList = await page.getOperatorList();
  const { OPS } = pdfjsLib;
  const segments = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] !== OPS.constructPath) continue;
    const [subops, coords] = opList.argsArray[i];
    // Een losse doorstreep-lijn is precies moveTo (13) + lineTo (14) — geen
    // rechthoek (die gebruikt subop 19: re) en geen complexer pad.
    if (subops.length !== 2 || subops[0] !== 13 || subops[1] !== 14) continue;
    const nextOp = opList.fnArray[i + 1];
    if (nextOp !== OPS.stroke) continue;

    const [x1, y1, x2, y2] = coords;
    if (Math.abs(y1 - y2) > 0.5) continue; // enkel horizontale lijnen
    segments.push({ x1: Math.min(x1, x2), x2: Math.max(x1, x2), y: (y1 + y2) / 2 });
  }

  return segments;
}

function applyStrikethrough(rows, segments) {
  for (const row of rows) {
    for (const item of row.items) {
      const itemLo = item.x;
      const itemHi = item.x + item.width;
      for (const seg of segments) {
        if (seg.y < item.y - STRIKE_Y_SLACK || seg.y > item.y + item.height + STRIKE_Y_SLACK) continue;
        const overlap = Math.min(itemHi, seg.x2) - Math.max(itemLo, seg.x1);
        if (overlap / (itemHi - itemLo) >= STRIKE_X_OVERLAP_MIN) {
          item.struck = true;
          break;
        }
      }
    }
  }
}

/**
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {Promise<Array<{ rows: Array<{y:number, items: Array<{text,x,width,height,struck}>}> }>>}
 */
export async function extractPages(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await pdfjsLib.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = groupIntoRows(content.items);
    // y op de items zetten (nodig voor de doorstreep-vergelijking hierboven) —
    // groupIntoRows kent y enkel aan de rij toe, niet aan elk item apart.
    for (const row of rows) for (const item of row.items) item.y = row.y;

    const segments = await extractStrikeSegments(page);
    applyStrikethrough(rows, segments);

    pages.push({ rows });
  }

  return pages;
}
