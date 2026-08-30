/**
 * pdfImport.js — SkipFlow
 *
 * Browserlaag voor PDF-import: stelt de pdfjs-worker in (Vite-specifieke
 * `?url`-import) en koppelt pdfExtract.js (tekst+doorstreping uit de PDF
 * trekken) aan pdfSchedule.js (de grammatica-parser). Dit is het enige
 * bestand dat een component mag aanspreken voor PDF-import — net zoals
 * Firestore-toegang enkel via dbSchema.js verloopt, verloopt PDF-parsing
 * enkel via deze ene functie.
 */

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { extractPages } from './pdfExtract';
import { parseSchedule } from './pdfSchedule';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Leest en parseert een wedstrijdschema-PDF.
 *
 * @param {File} file
 * @param {Array<{id:string, name:string, scoringType:string}>} events
 * @returns {Promise<{ sections: Array<{subtitle:string, blocks: Array<Object>}>, warnings: string[] }>}
 */
export async function parseCompetitionPdf(file, events) {
  const buffer = await file.arrayBuffer();
  const pages = await extractPages(buffer);
  return parseSchedule(pages, events);
}
