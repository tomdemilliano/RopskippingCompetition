/**
 * pdfSchedule.js — SkipFlow
 *
 * Pure grammatica-parser voor een Gymfed-wedstrijdschema, ONAFHANKELIJK van
 * pdfjs-dist of enige PDF-library — werkt op al-geëxtraheerde rijen/kolommen
 * (zie pdfImport.js voor de laag die pdfjs-dist gebruikt om die rijen uit een
 * echte PDF te trekken). Dat maakt dit bestand met gewone objecten testbaar,
 * ook buiten de browser (bv. in een Node-script tegen een echte PDF).
 *
 * Zie ARCHITECTURE.md — "PDF-import" voor de volledige grammatica-uitleg.
 * Kort samengevat:
 *   - Elke pagina begint met "Individuele wedstrijd" gevolgd door een
 *     dagdeel-titel ("B-niveau 13-15 jaar (...)") — een wissel van die titel
 *     opent een nieuwe sectie (één sectie = één potentiële wedstrijd/dagdeel).
 *   - Een onderdeelnaam-regel (bv. "Speed Sprint (30 seconden)") opent een
 *     nieuw blok van type "heats" en zet het "huidige onderdeel".
 *   - Een "Veld N"-kopregel (speed) of "Veld A/B - categorie"-kopregel
 *     (freestyle) opent een kolomblok — kan meermaals terugkeren onder
 *     hetzelfde onderdeel.
 *   - Een losse "tijd + tekst"-regel zonder kolomblok erna is een pauze/
 *     briefing/deuren/proefjury/prijsuitreiking-blok.
 *   - Reeksen worden NOOIT per kolomblok genummerd: alle rijen van hetzelfde
 *     onderdeel (over meerdere kolomblokken én meerdere fysieke blokken heen,
 *     bv. Freestyles onderbroken door pauzes) worden eerst verzameld en pas
 *     dan gegroepeerd op tijdstip (speed) of op categorie (freestyle) voor de
 *     uiteindelijke seriesNr-toekenning.
 */

export const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const VELD_NUM_RE = /^Veld\s+(\d+)\s*$/i;
const VELD_LETTER_RE = /^Veld\s+([A-Za-z])\b\s*-?\s*(.*)$/i;
const TITLE_RE = /^Individuele wedstrijd/i;

/** "8:45" -> 525 (minuten sinds middernacht), voor chronologisch sorteren. */
export function timeToMinutes(time) {
  const m = TIME_RE.exec((time ?? '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function normalizeForMatch(text) {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Zoek het events-document waarvan de naam als "kern" in de PDF-regel
 * voorkomt. Geen exacte match nodig — Gymfed-schema's gebruiken vaak een
 * uitgebreidere naam ("Speed Sprint (30 seconden)") dan wat in de app als
 * event geregistreerd staat ("Speed Sprint" of zelfs enkel "Speed").
 * Langste eventnaam wint bij meerdere treffers (voorkomt dat "Speed" een
 * regel voor "DD Speed Sprint" afsnoept).
 *
 * @param {string} rawRowText
 * @param {Array<{id:string,name:string,scoringType:string}>} events
 * @returns {{id:string,name:string,scoringType:string}|null}
 */
export function matchEventName(rawRowText, events) {
  const norm = normalizeForMatch(rawRowText);
  const candidates = [...events]
    .filter(ev => ev.name?.trim())
    .sort((a, b) => b.name.length - a.name.length);
  for (const ev of candidates) {
    const evNorm = normalizeForMatch(ev.name);
    if (evNorm && norm.includes(evNorm)) return ev;
  }
  return null;
}

const BREAK_TYPE_GUESSES = [
  [/jurybriefing/i, 'briefing'],
  [/proefjury/i, 'proefjury'],
  [/prijsuitreiking/i, 'prijsuitreiking'],
  [/lunch/i, 'lunchpauze'],
  [/pauze/i, 'pauze'],
  [/deuren|opwarming/i, 'deuren'],
];

/** Gok het bloktype op basis van het label — de operator kan dit nadien altijd corrigeren. */
export function guessBreakType(label) {
  for (const [re, type] of BREAK_TYPE_GUESSES) {
    if (re.test(label)) return type;
  }
  return 'pauze';
}

const DATE_ROW_RE = /\d{1,2}\/\d{1,2}\/\d{4}/;

/**
 * Elke pagina eindigt met een adresregel (bevat een dd/mm/jjjj-datumstempel)
 * direct voorafgegaan door de zaalnaam — beide zijn voettekst, geen
 * onderdeelnaam, ook al bevat de zaalnaam-regel op zich geen tijd of cijfers
 * die hem anders al zouden uitsluiten. De datumregel is een betrouwbaar
 * anker: hij komt verder nergens in het schema voor.
 */
function stripFooterRows(rows) {
  const dateIdx = rows.findIndex(r =>
    r.items.some(it => DATE_ROW_RE.test(it.text))
  );
  if (dateIdx === -1) return rows;
  return rows.filter((_, i) => i !== dateIdx && i !== dateIdx - 1);
}

function classifyHeaderRow(items) {
  if (items.length === 0) return null;

  const numMatches = items.map(it => VELD_NUM_RE.exec(it.text.trim()));
  if (numMatches.every(Boolean)) {
    return {
      kind: 'speed',
      columns: items.map((it, i) => ({
        fieldNr: parseInt(numMatches[i][1], 10),
        anchorX: it.x,
      })),
    };
  }

  const letterMatches = items.map(it => VELD_LETTER_RE.exec(it.text.trim()));
  if (letterMatches.every(Boolean)) {
    return {
      kind: 'freestyle',
      columns: items.map((it, i) => ({
        fieldNr: letterMatches[i][1].toUpperCase(),
        categoryLabel: letterMatches[i][2].trim(),
        anchorX: it.x,
      })),
    };
  }

  return null;
}

/** Kolomgrenzen = middens tussen opeenvolgende ankers, zodat elke x-positie een unieke kolom kiest. */
function columnBoundaries(columns) {
  const sorted = [...columns].sort((a, b) => a.anchorX - b.anchorX);
  return sorted.map((col, i) => ({
    ...col,
    lo: i === 0 ? -Infinity : (sorted[i - 1].anchorX + col.anchorX) / 2,
    hi: i === sorted.length - 1 ? Infinity : (col.anchorX + sorted[i + 1].anchorX) / 2,
  }));
}

function pickColumn(x, boundaries) {
  return boundaries.find(b => x >= b.lo && x < b.hi) ?? null;
}

/**
 * Heeft deze tijd-regel minstens één volledig (club, naam)-paar? Onderscheidt
 * een echte reeks-datarij van een losse tijd+label-regel die toevallig met
 * een tijd begint (bv. "13:25 Prijsuitreiking B 13-15 jaar").
 */
function rowHasDataPair(items, kind) {
  if (kind === 'speed') {
    return items.length >= 3; // tijd + minstens club + naam
  }
  // freestyle: elke tijd-marker in de rij moet minstens 2 items vóór de
  // volgende tijd-marker (of het einde) hebben — club + naam.
  const timeIdxs = [];
  items.forEach((it, i) => { if (TIME_RE.test(it.text.trim())) timeIdxs.push(i); });
  return timeIdxs.some((start, g) => {
    const end = g + 1 < timeIdxs.length ? timeIdxs[g + 1] : items.length;
    return end - start - 1 >= 2;
  });
}

/**
 * @typedef {Object} PageRow
 * @property {number} y
 * @property {Array<{text:string, x:number, width:number, height:number, struck?:boolean}>} items
 */

/**
 * @typedef {Object} PageData
 * @property {PageRow[]} rows  gesorteerd van boven (hoge y) naar onder (lage y)
 */

/**
 * Loopt alle rijen van alle pagina's top-naar-onder af en bouwt een geordende
 * lijst van dagdeel-secties (elk potentieel een aparte wedstrijd/competitie),
 * elk met hun geordende blokken en, voor "heats"-blokken, hun deelnemer-
 * entries met correct toegekende seriesNr.
 *
 * @param {PageData[]} pages
 * @param {Array<{id:string,name:string,scoringType:string}>} events
 * @returns {{ sections: Array<{subtitle:string, blocks: Array<Object>}>, warnings: string[] }}
 */
export function parseSchedule(pages, events) {
  const sections = [];
  const warnings = [];

  let currentSection = null;
  let activeColumns = null; // { kind: 'speed'|'freestyle', boundaries: [...] }
  let currentEventName = null;
  let currentEvent = null;
  let openHeatsBlock = null;
  let order = 0;
  let expectSubtitle = false;

  const ensureSection = (subtitle) => {
    if (!currentSection || currentSection.subtitle !== subtitle) {
      currentSection = { subtitle, blocks: [] };
      sections.push(currentSection);
      order = 0;
      currentEventName = null;
      currentEvent = null;
      activeColumns = null;
    }
  };

  const flushHeatsBlock = () => {
    if (openHeatsBlock && openHeatsBlock.rawEntries.length > 0) {
      currentSection.blocks.push(openHeatsBlock);
    }
    openHeatsBlock = null;
  };

  const openOrReuseHeatsBlock = (scheduledTime) => {
    if (!openHeatsBlock) {
      openHeatsBlock = {
        kind: 'heats',
        eventName: currentEventName,
        matchedEvent: currentEvent,
        scheduledTime,
        order: order++,
        rawEntries: [],
      };
    }
    return openHeatsBlock;
  };

  for (const page of pages) {
    const pageRows = stripFooterRows(page.rows);
    for (const row of pageRows) {
      const items = row.items.filter(it => it.text.trim() !== '');
      if (items.length === 0) continue;
      const rowText = items.map(it => it.text.trim()).join(' ').trim();

      if (expectSubtitle) {
        ensureSection(rowText);
        expectSubtitle = false;
        continue;
      }
      if (TITLE_RE.test(rowText)) {
        expectSubtitle = true;
        continue;
      }
      if (!currentSection) continue; // vóór de eerste titel — niets herkend, negeren

      const header = classifyHeaderRow(items);
      if (header) {
        flushHeatsBlock();
        activeColumns = { kind: header.kind, boundaries: columnBoundaries(header.columns) };
        continue;
      }

      const firstIsTime = TIME_RE.test(items[0].text.trim());

      // Een tijd-regel is enkel een échte data-rij als er ook minstens één
      // volledig (club, naam)-paar op volgt. Zonder deze check zou een losse
      // tijd+label-regel zoals "13:25 Prijsuitreiking B 13-15 jaar" — die
      // ook met een tijd begint — foutief als een (leeg) reeks-record voor
      // het nog actieve kolomblok verwerkt worden i.p.v. het blok af te
      // sluiten, waardoor het lopende heats-blok nooit geflushed wordt.
      const rowLooksLikeData = firstIsTime && activeColumns && rowHasDataPair(items, activeColumns.kind);

      if (rowLooksLikeData && activeColumns.kind === 'speed') {
        const time = items[0].text.trim();
        const rest = items.slice(1);
        const block = openOrReuseHeatsBlock(time);
        for (let i = 0; i + 1 < rest.length; i += 2) {
          const clubItem = rest[i];
          const nameItem = rest[i + 1];
          const col = pickColumn(clubItem.x, activeColumns.boundaries);
          if (!col) {
            warnings.push(`Kon veld niet bepalen voor "${nameItem.text}" om ${time}.`);
            continue;
          }
          block.rawEntries.push({
            scheduledTime: time,
            fieldNr: col.fieldNr,
            categoryLabel: '',
            clubName: clubItem.text.trim(),
            participantName: nameItem.text.trim(),
            isScratched: !!(clubItem.struck || nameItem.struck),
          });
        }
        continue;
      }

      if (rowLooksLikeData && activeColumns.kind === 'freestyle') {
        const groupStarts = [];
        items.forEach((it, i) => { if (TIME_RE.test(it.text.trim())) groupStarts.push(i); });
        const block = openOrReuseHeatsBlock(items[0].text.trim());
        for (let g = 0; g < groupStarts.length; g++) {
          const start = groupStarts[g];
          const end = g + 1 < groupStarts.length ? groupStarts[g + 1] : items.length;
          const timeItem = items[start];
          const rest = items.slice(start + 1, end);
          const clubItem = rest[0];
          const nameItem = rest[1];
          const col = pickColumn(timeItem.x, activeColumns.boundaries);
          if (!col || !clubItem) {
            warnings.push(`Kon kolom niet bepalen om ${timeItem.text.trim()}.`);
            continue;
          }
          block.rawEntries.push({
            scheduledTime: timeItem.text.trim(),
            fieldNr: col.fieldNr,
            categoryLabel: col.categoryLabel,
            clubName: clubItem.text.trim(),
            participantName: nameItem ? nameItem.text.trim() : '',
            isScratched: !!(clubItem.struck || nameItem?.struck),
          });
        }
        continue;
      }

      if (firstIsTime) {
        // Losse tijd + label, geen actief kolomblok -> pauze/briefing/....
        flushHeatsBlock();
        activeColumns = null;
        const time = items[0].text.trim();
        const label = items.slice(1).map(it => it.text.trim()).join(' ').trim();
        if (label) {
          currentSection.blocks.push({
            kind: 'label',
            type: guessBreakType(label),
            label,
            scheduledTime: time,
            order: order++,
          });
        }
        continue;
      }

      // Geen tijd, geen kopregel -> kandidaat-onderdeelnaam (of onherkende ruis, bv. voettekst).
      const matched = matchEventName(rowText, events);
      if (matched || looksLikeEventNameCandidate(rowText)) {
        flushHeatsBlock();
        activeColumns = null;
        currentEventName = matched ? matched.name : rowText;
        currentEvent = matched;
        if (!matched) {
          warnings.push(`Onderdeel "${rowText}" niet automatisch herkend — koppel het in het nakijkscherm.`);
        }
      }
      // Anders: onherkende regel (voettekst, adres, ...) — genegeerd.
    }
  }
  flushHeatsBlock();

  assignSeriesNumbers(sections);

  return { sections, warnings };
}

/**
 * Ruwe heuristiek om voettekst ("SPORTHAL DE ZEURT SCHOTEN") te onderscheiden
 * van een echte, maar onbekende onderdeelnaam: een onderdeelnaam is relatief
 * kort en bevat typisch geen adres-achtige tekens. Niet waterdicht — vandaar
 * dat een onmatchte kandidaat altijd in de review-stap terechtkomt i.p.v.
 * stilzwijgend als blok aangemaakt te worden.
 */
function looksLikeEventNameCandidate(text) {
  if (text.length > 60) return false;
  if (/\d{2,}/.test(text)) return false; // adressen/postcodes bevatten vaak cijferreeksen
  if (/,/.test(text)) return false;
  return true;
}

/**
 * Kent seriesNr toe binnen elke sectie, per (onderdeel × categorie):
 *   - speed:      groepeer op scheduledTime, chronologisch genummerd
 *   - freestyle:  groepeer op categoryLabel, elke deelnemer een eigen
 *                 doorlopend nummer, chronologisch binnen die categorie
 * Loopt over alle fysieke blokken van hetzelfde onderdeel heen (zie
 * bestandskop) — nooit gereset per blok.
 */
function assignSeriesNumbers(sections) {
  for (const section of sections) {
    const byEventKey = new Map();
    for (const block of section.blocks) {
      if (block.kind !== 'heats') continue;
      const key = block.matchedEvent?.id ?? `__unmatched__:${block.eventName}`;
      if (!byEventKey.has(key)) byEventKey.set(key, []);
      byEventKey.get(key).push(block);
    }

    for (const blocks of byEventKey.values()) {
      const allEntries = blocks.flatMap(b => b.rawEntries);
      const isFreestyle = allEntries.some(e => e.categoryLabel);

      if (isFreestyle) {
        // Elke deelnemer is zijn eigen reeks (solo-optreden). seriesNr loopt
        // GLOBAAL door over alle categorieën/kolommen (A/B) heen binnen dit
        // onderdeel — nooit per categorie herstart. Categorieën lopen
        // parallel (kolom A/B tegelijk beoordeeld), dus chronologisch
        // sorteren op tijdstip geeft de volgorde zoals het schema ze opsomt;
        // categoryLabel blijft bewaard voor latere podium-groepering, maar
        // stuurt de reeksnummering zelf niet aan — anders zouden twee
        // gelijktijdige categorieën dezelfde seriesNr delen en zou de reeks-
        // afleiding (eventId + seriesNr) ze foutief samenvoegen tot één reeks.
        allEntries.sort((a, b) => timeToMinutes(a.scheduledTime) - timeToMinutes(b.scheduledTime));
        allEntries.forEach((e, i) => { e.seriesNr = i + 1; });
      } else {
        const byTime = new Map();
        for (const e of allEntries) {
          if (!byTime.has(e.scheduledTime)) byTime.set(e.scheduledTime, []);
          byTime.get(e.scheduledTime).push(e);
        }
        const times = [...byTime.keys()].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        times.forEach((t, i) => {
          for (const e of byTime.get(t)) e.seriesNr = i + 1;
        });
      }
    }
  }
}
