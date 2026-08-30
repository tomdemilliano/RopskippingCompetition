/**
 * PdfImportModal.jsx — SkipFlow
 *
 * Importeert een volledig wedstrijdschema (PDF, zoals Gymfed aanlevert) in
 * één keer, in plaats van CSV per onderdeel te moeten plakken. Hergebruikt
 * hetzelfde stramien als ImportModal.jsx (plakken/uploaden → nakijken →
 * clubs koppelen → importeren) — enkel stap 0 verandert.
 *
 * Zie pdfImport.js / pdfSchedule.js voor de eigenlijke parser en
 * ARCHITECTURE.md — "PDF-import" voor de volledige grammatica-uitleg.
 *
 * Stappen:
 *   0. UPLOAD    — PDF kiezen en laten inlezen
 *   1. DAGDEEL   — enkel getoond als de PDF meerdere dagdelen bevat
 *   2. NAKIJKEN  — blokken/reeksen bevestigen, onderdelen koppelen,
 *                  schrappingen (automatisch gedetecteerd) corrigeren
 *   3. CLUBS     — onbekende clubs koppelen of aanmaken (zelfde flow als CSV)
 *   4. IMPORT    — wegschrijven: eerst de dagtijdlijn (blocks), dan de
 *                  deelnemers per onderdeel
 */

import React, { useMemo, useState } from 'react';
import { X, AlertTriangle, CheckCircle, Upload, FileWarning } from 'lucide-react';
import { useAppContext } from '../../../AppContext';
import { modalStyles as s } from './modalStyles';
import { color, radius } from '../../../theme';
import { parseCompetitionPdf } from '../../../pdfImport';

const s2 = {
  dropZone: {
    border: `2px dashed ${color.faintest}`,
    borderRadius: radius.md,
    padding: '2.5rem 1rem',
    textAlign: 'center',
    color: color.muted,
    cursor: 'pointer',
  },
  sectionCard: (active) => ({
    border: `1px solid ${active ? color.primary : color.border}`,
    background: active ? color.primarySoft : color.surface,
    borderRadius: radius.md,
    padding: '0.9rem 1rem',
    cursor: 'pointer',
    marginBottom: '0.6rem',
  }),
  blockCard: {
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    marginBottom: '0.6rem',
    overflow: 'hidden',
  },
  blockHeader: (isHeats) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.55rem 0.8rem',
    background: isHeats ? color.surfaceAlt : color.borderSoft,
    flexWrap: 'wrap',
  }),
  timeChip: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: color.body,
    minWidth: '42px',
  },
  select: {
    border: `1px solid ${color.faintest}`,
    borderRadius: '6px',
    padding: '0.3rem 0.5rem',
    fontSize: '0.8rem',
    color: color.ink,
  },
  entryTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.78rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.3rem 0.7rem',
    color: color.faint,
    fontWeight: 700,
    fontSize: '0.65rem',
    textTransform: 'uppercase',
  },
  td: {
    padding: '0.25rem 0.7rem',
    borderTop: `1px solid ${color.borderSoft}`,
  },
  strikeRow: {
    background: color.dangerSoft,
  },
  warningBox: {
    background: color.warningSoft,
    border: `1px solid ${color.warningBorder}`,
    borderRadius: '6px',
    padding: '0.6rem 0.75rem',
    fontSize: '0.8rem',
    color: '#854d0e',
    marginBottom: '0.75rem',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildBlockState(section) {
  return section.blocks.map((b, i) => ({
    ...b,
    key: i,
    included: true,
    chosenEventId: b.kind === 'heats' ? (b.matchedEvent?.id ?? '') : '',
    chosenType: b.kind === 'label' ? b.type : '',
    entries: b.kind === 'heats'
      ? b.rawEntries.map((e, j) => ({ ...e, key: j, isScratched: e.isScratched }))
      : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PdfImportModal({ competitionId, onClose }) {
  const {
    events, clubs, participants,
    createClub, findClubByName, importParticipants, importBlocks,
    blockTypeLabels,
  } = useAppContext();

  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState(null);
  const [sectionIdx, setSectionIdx] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [clubResolutions, setClubResolutions] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const goToReview = (secIdx) => {
    setSectionIdx(secIdx);
    setBlocks(buildBlockState(parsed.sections[secIdx]));
    setStep(2);
  };

  // ── Stap 0: uploaden + parsen ────────────────────────────────────────────

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setParseError('');
    setParsing(true);
    try {
      const result = await parseCompetitionPdf(f, events);
      setParsed(result);
      if (result.sections.length === 0) {
        setParseError('Geen wedstrijdschema herkend in dit PDF-bestand.');
      } else if (result.sections.length === 1) {
        setSectionIdx(0);
        setBlocks(buildBlockState(result.sections[0]));
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (err) {
      setParseError('PDF inlezen mislukt: ' + (err.message ?? err));
    } finally {
      setParsing(false);
    }
  };

  // ── Stap 2: nakijken ──────────────────────────────────────────────────────

  const updateBlock = (key, patch) => {
    setBlocks(prev => prev.map(b => (b.key === key ? { ...b, ...patch } : b)));
  };

  const toggleEntryScratch = (blockKey, entryKey) => {
    setBlocks(prev => prev.map(b => {
      if (b.key !== blockKey) return b;
      return {
        ...b,
        entries: b.entries.map(e => (e.key === entryKey ? { ...e, isScratched: !e.isScratched } : e)),
      };
    }));
  };

  const includedHeatsBlocks = useMemo(
    () => blocks.filter(b => b.included && b.kind === 'heats'),
    [blocks]
  );
  const unresolvedEventBlocks = includedHeatsBlocks.filter(b => !b.chosenEventId);
  const totalEntryCount = includedHeatsBlocks.reduce((sum, b) => sum + b.entries.length, 0);

  // ── Stap 3: clubs koppelen ────────────────────────────────────────────────

  const uniqueClubNames = useMemo(() => {
    const names = new Set();
    for (const b of includedHeatsBlocks) {
      for (const e of b.entries) if (e.clubName) names.add(e.clubName);
    }
    return [...names];
  }, [includedHeatsBlocks]);

  const goToClubResolution = () => {
    const resolutions = {};
    for (const name of uniqueClubNames) {
      const { exact, fuzzy } = findClubByName(name);
      if (exact) {
        resolutions[name] = { resolution: 'existing', clubId: exact.id };
      } else {
        resolutions[name] = {
          resolution:   fuzzy.length > 0 ? 'fuzzy' : 'new',
          fuzzyMatches: fuzzy,
          clubId:       fuzzy[0]?.id ?? '',
          newName:      name,
          newShortName: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4),
        };
      }
    }
    setClubResolutions(resolutions);
    setStep(3);
  };

  const updateResolution = (clubName, patch) => {
    setClubResolutions(prev => ({ ...prev, [clubName]: { ...prev[clubName], ...patch } }));
  };

  const unresolvedClubNames = useMemo(() =>
    uniqueClubNames.filter(name => {
      const r = clubResolutions[name];
      if (!r) return true;
      if (r.resolution === 'new') return !r.newName?.trim();
      return !r.clubId;
    }),
  [uniqueClubNames, clubResolutions]);

  // ── Stap 4: importeren ────────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    setStep(4);
    try {
      // 1. Nieuwe clubs aanmaken, clubId per naam verzamelen
      const clubIdByName = {};
      for (const name of uniqueClubNames) {
        const r = clubResolutions[name];
        if (r.resolution === 'new') {
          clubIdByName[name] = await createClub({ name: r.newName.trim(), shortName: r.newShortName.trim() });
        } else {
          clubIdByName[name] = r.clubId;
        }
      }

      // 2. Deelnemers per gekozen onderdeel groeperen en wegschrijven
      const byEventId = new Map();
      for (const b of includedHeatsBlocks) {
        if (!byEventId.has(b.chosenEventId)) byEventId.set(b.chosenEventId, []);
        for (const e of b.entries) {
          const clubId = clubIdByName[e.clubName] ?? '';
          byEventId.get(b.chosenEventId).push({
            name:          e.participantName,
            clubId,
            externalId:    `${e.participantName}_${clubId}`,
            seriesNr:      e.seriesNr,
            fieldNr:       e.fieldNr,
            scheduledTime: e.scheduledTime,
            categoryLabel: e.categoryLabel,
            isScratched:   e.isScratched,
          });
        }
      }
      let participantCount = 0;
      for (const [eventId, rows] of byEventId) {
        await importParticipants(competitionId, eventId, participants, rows);
        participantCount += rows.length;
      }

      // 3. Dagtijdlijn (blocks) wegschrijven, enkel de meegenomen blokken
      const blocksData = blocks
        .filter(b => b.included)
        .map((b, i) => b.kind === 'heats'
          ? { type: 'heats', eventId: b.chosenEventId, scheduledTime: b.entries[0]?.scheduledTime ?? '', order: i }
          : { type: b.chosenType, label: b.label, scheduledTime: b.scheduledTime, order: i }
        );
      await importBlocks(competitionId, blocksData);

      setImportResult({ success: true, participantCount, blockCount: blocksData.length });
    } catch (err) {
      setImportResult({ success: false, error: err.message ?? 'Onbekende fout.' });
    } finally {
      setImporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={s.overlay}>
      <div style={{ ...s.dialogWide, maxHeight: '88vh' }}>
        <div style={s.dialogHeader}>
          <span style={s.dialogTitle}>Volledig wedstrijdschema importeren (PDF)</span>
          <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={s.body}>
          {/* ── Stap 0: uploaden ── */}
          {step === 0 && (
            <>
              <p style={{ fontSize: '0.85rem', color: color.body, marginTop: 0 }}>
                Upload het volledige wedstrijdschema zoals Gymfed het aanlevert (PDF).
                De dagtijdlijn (onderdelen, pauzes, jurybriefing, prijsuitreiking) en alle
                deelnemers per reeks worden automatisch herkend — je krijgt straks een
                nakijkscherm voor je iets definitief opslaat.
              </p>

              <label style={s2.dropZone}>
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files?.[0])}
                />
                <Upload size={28} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontWeight: 700, color: color.inkSoft }}>
                  {file ? file.name : 'Klik om een PDF te kiezen'}
                </div>
                {parsing && <div style={{ marginTop: '0.5rem' }}>Bezig met inlezen…</div>}
              </label>

              {parseError && <div style={{ ...s.errorMsg, marginTop: '0.75rem' }}>{parseError}</div>}
            </>
          )}

          {/* ── Stap 1: dagdeel kiezen ── */}
          {step === 1 && parsed && (
            <>
              <p style={{ fontSize: '0.85rem', color: color.body, marginTop: 0 }}>
                Dit PDF-bestand bevat meerdere dagdelen. Kies welk dagdeel bij
                <strong> deze </strong> wedstrijd hoort — de rest wordt genegeerd.
              </p>
              {parsed.sections.map((section, i) => {
                const heatsCount = section.blocks.filter(b => b.kind === 'heats').length;
                const entryCount = section.blocks
                  .filter(b => b.kind === 'heats')
                  .reduce((sum, b) => sum + b.rawEntries.length, 0);
                return (
                  <div key={i} style={s2.sectionCard(false)} onClick={() => goToReview(i)}>
                    <div style={{ fontWeight: 800, color: color.inkSoft }}>{section.subtitle}</div>
                    <div style={{ fontSize: '0.78rem', color: color.muted, marginTop: '2px' }}>
                      {heatsCount} onderdeel-blokken · {entryCount} deelnemers
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ── Stap 2: nakijken ── */}
          {step === 2 && (
            <>
              {parsed.warnings.length > 0 && (
                <div style={s2.warningBox}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                    <FileWarning size={14} /> Nakijken vereist
                  </div>
                  {parsed.warnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
              )}
              <p style={{ fontSize: '0.8rem', color: color.muted, marginTop: 0 }}>
                {totalEntryCount} deelnemers gevonden. Rood-gemarkeerde rijen zijn automatisch
                als geschrapt herkend (doorstreping in de PDF) — controleer deze, doorstreping
                is niet 100% waterdicht te detecteren.
              </p>

              {blocks.map(b => (
                <div key={b.key} style={s2.blockCard}>
                  <div style={s2.blockHeader(b.kind === 'heats')}>
                    <input
                      type="checkbox"
                      checked={b.included}
                      onChange={() => updateBlock(b.key, { included: !b.included })}
                      title="Meenemen in import"
                    />
                    <span style={s2.timeChip}>{b.kind === 'heats' ? (b.entries[0]?.scheduledTime ?? '') : b.scheduledTime}</span>

                    {b.kind === 'heats' ? (
                      <>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: color.inkSoft }}>
                          {b.eventName}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: color.muted }}>→ koppel aan:</span>
                        <select
                          style={s2.select}
                          value={b.chosenEventId}
                          onChange={e => updateBlock(b.key, { chosenEventId: e.target.value })}
                        >
                          <option value="">— kies onderdeel —</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                        </select>
                        {!b.chosenEventId && b.included && (
                          <AlertTriangle size={14} color={color.warning} title="Onderdeel nog niet gekoppeld" />
                        )}
                        <span style={{ fontSize: '0.75rem', color: color.muted, marginLeft: 'auto' }}>
                          {b.entries.length} deelnemers
                        </span>
                      </>
                    ) : (
                      <>
                        <select
                          style={s2.select}
                          value={b.chosenType}
                          onChange={e => updateBlock(b.key, { chosenType: e.target.value })}
                        >
                          {Object.entries(blockTypeLabels).map(([type, label]) => (
                            <option key={type} value={type}>{label}</option>
                          ))}
                        </select>
                        <span style={{ fontSize: '0.8rem', color: color.body }}>{b.label}</span>
                      </>
                    )}
                  </div>

                  {b.kind === 'heats' && b.included && b.entries.length > 0 && (
                    <table style={s2.entryTable}>
                      <thead>
                        <tr>
                          <th style={s2.th}>Tijd</th>
                          <th style={s2.th}>Reeks</th>
                          <th style={s2.th}>Veld</th>
                          <th style={s2.th}>Club</th>
                          <th style={s2.th}>Naam</th>
                          <th style={s2.th}>Geschrapt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.entries.map(e => (
                          <tr key={e.key} style={e.isScratched ? s2.strikeRow : undefined}>
                            <td style={s2.td}>{e.scheduledTime}</td>
                            <td style={s2.td}>{e.seriesNr}</td>
                            <td style={s2.td}>{e.fieldNr}</td>
                            <td style={s2.td}>{e.clubName}</td>
                            <td style={s2.td}>{e.participantName}</td>
                            <td style={s2.td}>
                              <input
                                type="checkbox"
                                checked={e.isScratched}
                                onChange={() => toggleEntryScratch(b.key, e.key)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </>
          )}

          {/* ── Stap 3: clubs koppelen (zelfde flow als CSV-import) ── */}
          {step === 3 && (
            <>
              <p style={{ fontSize: '0.85rem', color: color.body, marginTop: 0 }}>
                De volgende clubs zijn niet automatisch gevonden. Kies een bestaande club of
                maak een nieuwe aan.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {uniqueClubNames.filter(name => clubResolutions[name]?.resolution !== 'existing' || true).map(clubName => {
                  const r = clubResolutions[clubName];
                  if (r.resolution === 'existing' && !r.fuzzyMatches) return null;
                  return (
                    <div key={clubName} style={{ border: `1px solid ${color.border}`, borderRadius: radius.md, padding: '1rem', background: color.surfaceAlt }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={15} color={color.warning} />
                        &ldquo;{clubName}&rdquo;
                      </div>

                      {r.fuzzyMatches?.length > 0 && (
                        <div style={{ background: color.warningSoft, border: `1px solid ${color.warningBorder}`, borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#854d0e' }}>
                          Mogelijk bedoel je: <strong>{r.fuzzyMatches.map(c => c.name).join(', ')}</strong>
                        </div>
                      )}

                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="radio"
                            name={`res_${clubName}`}
                            checked={r.resolution === 'existing' || r.resolution === 'fuzzy'}
                            onChange={() => updateResolution(clubName, { resolution: 'existing', clubId: r.fuzzyMatches?.[0]?.id ?? r.clubId })}
                          />
                          Koppel aan bestaande club
                        </label>
                        {(r.resolution === 'existing' || r.resolution === 'fuzzy') && (
                          <select
                            style={{ ...s.input, marginTop: '0.4rem', marginBottom: 0 }}
                            value={r.clubId}
                            onChange={e => updateResolution(clubName, { clubId: e.target.value, resolution: 'existing' })}
                          >
                            <option value="">— Kies een club —</option>
                            {[...clubs].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                          type="radio"
                          name={`res_${clubName}`}
                          checked={r.resolution === 'new'}
                          onChange={() => updateResolution(clubName, { resolution: 'new' })}
                        />
                        Maak nieuwe club aan
                      </label>
                      {r.resolution === 'new' && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem' }}>
                          <div style={{ flex: 2 }}>
                            <label style={s.label}>Naam</label>
                            <input style={{ ...s.input, marginBottom: 0 }} value={r.newName} onChange={e => updateResolution(clubName, { newName: e.target.value })} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={s.label}>Afkorting</label>
                            <input style={{ ...s.input, marginBottom: 0 }} value={r.newShortName} onChange={e => updateResolution(clubName, { newShortName: e.target.value })} maxLength={6} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {uniqueClubNames.every(name => clubResolutions[name]?.resolution === 'existing' && !clubResolutions[name]?.fuzzyMatches?.length) && (
                  <div style={{ fontSize: '0.85rem', color: color.muted, fontStyle: 'italic' }}>
                    Alle clubs zijn automatisch herkend.
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Stap 4: importeren / resultaat ── */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              {importing && <div style={{ color: color.muted, fontSize: '0.9rem' }}>Importeren…</div>}
              {importResult?.success && (
                <div>
                  <CheckCircle size={48} style={{ marginBottom: '1rem', color: color.success }} />
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: color.inkSoft }}>Klaar!</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: color.muted }}>
                    {importResult.participantCount} deelnemers en {importResult.blockCount} blokken geïmporteerd.
                  </div>
                </div>
              )}
              {importResult?.success === false && (
                <div style={s.errorMsg}><strong>Importfout:</strong> {importResult.error}</div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={s.footer}>
          {step === 0 && (
            <button style={s.btnSecondary} onClick={onClose}>Annuleren</button>
          )}
          {step === 1 && (
            <button style={s.btnSecondary} onClick={() => setStep(0)}>← Terug</button>
          )}
          {step === 2 && (
            <>
              <button style={s.btnSecondary} onClick={() => setStep(parsed.sections.length > 1 ? 1 : 0)}>← Terug</button>
              <button
                style={s.btnPrimary}
                onClick={goToClubResolution}
                disabled={unresolvedEventBlocks.length > 0 || totalEntryCount === 0}
                title={unresolvedEventBlocks.length > 0 ? 'Koppel eerst elk onderdeel-blok aan een bestaand onderdeel.' : ''}
              >
                Volgende →
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button style={s.btnSecondary} onClick={() => setStep(2)}>← Terug</button>
              <button style={s.btnPrimary} onClick={handleImport} disabled={unresolvedClubNames.length > 0}>
                Importeren →
              </button>
            </>
          )}
          {step === 4 && importResult?.success && (
            <button style={s.btnPrimary} onClick={onClose}>Sluiten</button>
          )}
          {step === 4 && importResult?.success === false && (
            <>
              <button style={s.btnSecondary} onClick={() => setStep(3)}>Terug</button>
              <button style={s.btnSecondary} onClick={onClose}>Sluiten</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
