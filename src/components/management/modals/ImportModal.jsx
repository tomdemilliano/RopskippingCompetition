/**
 * ImportModal.jsx — RopeScore Pro
 *
 * CSV-import voor één event met club-matching flow.
 *
 * Stappen:
 *   1. PASTE   — gebruiker plakt CSV-tekst
 *   2. REVIEW  — geparseerde rijen getoond, onbekende clubs gemarkeerd
 *   3. RESOLVE — per onbekende club: kies bestaande of maak nieuwe aan
 *   4. IMPORT  — batch schrijven naar Firestore
 *   5. DONE    — bevestiging
 */

import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import { useAppContext } from '../../../AppContext';
import { modalStyles as s } from './modalStyles';

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parst een CSV-string naar een array van objecten.
 * Eerste rij = headers.
 */
function parseCsv(raw) {
  const lines = raw.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

/**
 * Zet geparseerde CSV-rijen om naar genormaliseerde import-rijen.
 *
 * Verwacht formaat voor speed-events:
 *   reeks, uur, skipper_veld1, club_veld1, ..., skipper_veld10, club_veld10
 *
 * Verwacht formaat voor freestyle-events:
 *   reeks, uur, veld, skipper, club
 */
function csvRowsToImportRows(csvRows, scoringType) {
  const rows = [];

  if (scoringType === 'freestyle') {
    for (const row of csvRows) {
      const name = row['skipper'] ?? row['naam'] ?? '';
      const club = row['club'] ?? '';
      if (!name) continue;
      rows.push({
        name,
        clubName:      club,
        seriesNr:      parseInt(row['reeks']) || 0,
        fieldNr:       row['veld'] ?? '',
        scheduledTime: row['uur'] ?? '',
      });
    }
  } else {
    // Speed: meerdere velden per rij
    for (const row of csvRows) {
      const seriesNr      = parseInt(row['reeks']) || 0;
      const scheduledTime = row['uur'] ?? '';
      for (let i = 1; i <= 10; i++) {
        const name = row[`skipper_veld${i}`] ?? row[`skipper veld${i}`] ?? '';
        const club = row[`club_veld${i}`]    ?? row[`club veld${i}`]    ?? '';
        if (!name) continue;
        rows.push({
          name,
          clubName: club,
          seriesNr,
          fieldNr:  i,
          scheduledTime,
        });
      }
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAP-COMPONENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  const steps = ['Plakken', 'Controleer', 'Clubs', 'Importeren'];
  return (
    <div style={{ display: 'flex', gap: '0', marginBottom: '1.25rem' }}>
      {steps.map((label, i) => {
        const idx    = i + 1;
        const done   = idx < current;
        const active = idx === current;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.75rem',
                background: done ? '#10b981' : active ? '#2563eb' : '#e2e8f0',
                color: (done || active) ? '#fff' : '#94a3b8',
              }}>
                {done ? '✓' : idx}
              </div>
              <div style={{
                fontSize: '0.65rem', marginTop: '4px', fontWeight: active ? 700 : 400,
                color: active ? '#2563eb' : '#94a3b8',
              }}>
                {label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: '2px', flex: 1, marginBottom: '18px',
                background: done ? '#10b981' : '#e2e8f0',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOFDCOMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportModal({ competitionId, eventId, onClose }) {
  const {
    events,
    clubs,
    participants,
    createClub,
    findClubByName,
    importParticipants,
  } = useAppContext();

  const event = events.find(e => e.id === eventId);

  // ── State ────────────────────────────────────────────────────────────────
  const [step,       setStep]       = useState(1); // 1-4
  const [csvText,    setCsvText]    = useState('');
  const [parseError, setParseError] = useState('');

  // Geparseerde import-rijen (na stap 1)
  const [importRows, setImportRows] = useState([]);

  // Club-resolutie: { [clubName]: { resolution: 'existing'|'new', clubId, newName, newShortName } }
  const [clubResolutions, setClubResolutions] = useState({});

  // Importvoortgang
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // ── Stap 1 → 2: CSV parsen ───────────────────────────────────────────────

  const handleParse = () => {
    setParseError('');
    if (!csvText.trim()) { setParseError('Geen CSV-tekst ingevoerd.'); return; }

    const csvRows = parseCsv(csvText);
    if (csvRows.length === 0) { setParseError('Geen geldige rijen gevonden. Controleer het formaat.'); return; }

    const rows = csvRowsToImportRows(csvRows, event?.scoringType ?? 'speed');
    if (rows.length === 0) { setParseError('Geen deelnemers gevonden in de CSV.'); return; }

    setImportRows(rows);

    // Verzamel unieke clubnamen en zoek matches
    const uniqueClubNames = [...new Set(rows.map(r => r.clubName).filter(Boolean))];
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
    setStep(2);
  };

  // ── Stap 2 → 3 (of direct naar 4 als geen onbekende clubs) ──────────────

  const unknownClubNames = useMemo(() =>
    Object.entries(clubResolutions)
      .filter(([, r]) => r.resolution !== 'existing')
      .map(([name]) => name),
  [clubResolutions]);

  const handleReviewNext = () => {
    if (unknownClubNames.length > 0) {
      setStep(3);
    } else {
      setStep(4);
      handleImport();
    }
  };

  // ── Stap 3: Club-resolutie bijwerken ────────────────────────────────────

  const updateResolution = (clubName, patch) => {
    setClubResolutions(prev => ({
      ...prev,
      [clubName]: { ...prev[clubName], ...patch },
    }));
  };

  const handleResolveNext = () => {
    // Valideer: alle onbekende clubs moeten een beslissing hebben
    for (const name of unknownClubNames) {
      const r = clubResolutions[name];
      if (r.resolution === 'existing' && !r.clubId) return;
      if (r.resolution === 'new' && !r.newName?.trim()) return;
    }
    setStep(4);
    handleImport();
  };

  // ── Stap 4: Importeren ───────────────────────────────────────────────────

  const handleImport = async () => {
    setImporting(true);
    try {
      // 1. Maak nieuwe clubs aan en vul clubId in voor resoluties
      const resolvedClubIds = { ...Object.fromEntries(
        Object.entries(clubResolutions)
          .filter(([, r]) => r.resolution === 'existing')
          .map(([name, r]) => [name, r.clubId])
      )};

      for (const name of unknownClubNames) {
        const r = clubResolutions[name];
        if (r.resolution === 'new' || r.resolution === 'fuzzy') {
          if (r.resolution === 'new') {
            const newId = await createClub({
              name:      r.newName.trim(),
              shortName: r.newShortName.trim(),
            });
            resolvedClubIds[name] = newId;
          } else {
            // fuzzy → gebruik gekozen bestaand clubId
            resolvedClubIds[name] = r.clubId;
          }
        }
      }

      // 2. Bouw definitieve import-rijen met clubId en externalId
      const finalRows = importRows.map(row => {
        const clubId = resolvedClubIds[row.clubName] ?? '';
        return {
          ...row,
          clubId,
          externalId: `${row.name}_${clubId}`,
        };
      });

      // 3. Batch schrijven
      await importParticipants(competitionId, eventId, participants, finalRows);

      setImportResult({
        success: true,
        count:   finalRows.length,
      });
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
      <div style={{ ...s.dialogWide, maxHeight: '85vh' }}>
        <div style={s.dialogHeader}>
          <span style={s.dialogTitle}>
            Importeer deelnemers — {event?.name ?? eventId}
          </span>
          <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={s.body}>
          <StepIndicator current={step} />

          {/* ── Stap 1: CSV plakken ── */}
          {step === 1 && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>
                Plak de CSV-inhoud hieronder. Verwacht formaat:
              </p>

              {event?.scoringType === 'freestyle' ? (
                <div style={{
                  background: '#f8fafc', border: '1px dashed #cbd5e1',
                  borderRadius: '6px', padding: '0.6rem', fontFamily: 'monospace',
                  fontSize: '0.75rem', color: '#475569', marginBottom: '1rem',
                }}>
                  reeks,uur,veld,skipper,club<br />
                  1,09:00,A,Jan Janssen,Antwerp Ropes<br />
                  1,09:00,B,Piet Pieters,Jump Club
                </div>
              ) : (
                <div style={{
                  background: '#f8fafc', border: '1px dashed #cbd5e1',
                  borderRadius: '6px', padding: '0.6rem', fontFamily: 'monospace',
                  fontSize: '0.75rem', color: '#475569', marginBottom: '1rem',
                }}>
                  reeks,uur,skipper_veld1,club_veld1,skipper_veld2,club_veld2,...<br />
                  1,09:00,Jan Janssen,Antwerp Ropes,Piet Pieters,Jump Club
                </div>
              )}

              <textarea
                style={{
                  ...s.input,
                  height: '220px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  resize: 'vertical',
                  marginBottom: '0.5rem',
                }}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="Plak hier de CSV-inhoud…"
                autoFocus
              />

              {parseError && <div style={s.errorMsg}>{parseError}</div>}
            </>
          )}

          {/* ── Stap 2: Controleer rijen ── */}
          {step === 2 && (
            <>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                {importRows.length} deelnemers gevonden.
                {unknownClubNames.length > 0 && (
                  <span style={{ color: '#f59e0b', fontWeight: 700, marginLeft: '6px' }}>
                    {unknownClubNames.length} onbekende club(s) — stap 3 vereist.
                  </span>
                )}
              </div>

              <div style={{ maxHeight: '320px', overflowY: 'auto', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Naam</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Club</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Reeks</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Veld</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>Tijd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, i) => {
                      const r = clubResolutions[row.clubName];
                      const clubUnknown = r && r.resolution !== 'existing';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600 }}>{row.name}</td>
                          <td style={{ padding: '0.4rem 0.75rem' }}>
                            <span style={{
                              color: clubUnknown ? '#f59e0b' : '#475569',
                              fontWeight: clubUnknown ? 700 : 400,
                            }}>
                              {row.clubName || '—'}
                              {clubUnknown && ' ⚠'}
                            </span>
                          </td>
                          <td style={{ padding: '0.4rem 0.75rem', color: '#64748b' }}>{row.seriesNr}</td>
                          <td style={{ padding: '0.4rem 0.75rem', color: '#64748b' }}>{row.fieldNr}</td>
                          <td style={{ padding: '0.4rem 0.75rem', color: '#64748b' }}>{row.scheduledTime}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Stap 3: Club-resolutie ── */}
          {step === 3 && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 0 }}>
                De volgende clubs zijn niet gevonden. Kies een bestaande club of maak een nieuwe aan.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {unknownClubNames.map(clubName => {
                  const r = clubResolutions[clubName];
                  return (
                    <div key={clubName} style={{
                      border: '1px solid #e2e8f0', borderRadius: '8px',
                      padding: '1rem', background: '#f8fafc',
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={15} color="#f59e0b" />
                        "{clubName}"
                      </div>

                      {/* Fuzzy match suggestie */}
                      {r.fuzzyMatches?.length > 0 && (
                        <div style={{
                          background: '#fffbeb', border: '1px solid #fef08a',
                          borderRadius: '6px', padding: '0.6rem 0.75rem',
                          marginBottom: '0.75rem', fontSize: '0.8rem', color: '#854d0e',
                        }}>
                          Mogelijk bedoel je: <strong>{r.fuzzyMatches.map(c => c.name).join(', ')}</strong>
                        </div>
                      )}

                      {/* Keuze: bestaande club */}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="radio"
                            name={`res_${clubName}`}
                            checked={r.resolution === 'existing' || r.resolution === 'fuzzy'}
                            onChange={() => updateResolution(clubName, {
                              resolution: 'existing',
                              clubId: r.fuzzyMatches?.[0]?.id ?? '',
                            })}
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

                      {/* Keuze: nieuwe club */}
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
                            <input
                              style={{ ...s.input, marginBottom: 0 }}
                              value={r.newName}
                              onChange={e => updateResolution(clubName, { newName: e.target.value })}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={s.label}>Afkorting</label>
                            <input
                              style={{ ...s.input, marginBottom: 0 }}
                              value={r.newShortName}
                              onChange={e => updateResolution(clubName, { newShortName: e.target.value })}
                              maxLength={6}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Stap 4: Importeren / resultaat ── */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              {importing && (
                <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Importeren…
                </div>
              )}
              {importResult?.success && (
                <div style={{ color: '#166534' }}>
                  <CheckCircle size={48} style={{ marginBottom: '1rem', color: '#10b981' }} />
                  <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>Klaar!</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#64748b' }}>
                    {importResult.count} deelnemers geïmporteerd voor {event?.name}.
                  </div>
                </div>
              )}
              {importResult?.success === false && (
                <div style={s.errorMsg}>
                  <strong>Importfout:</strong> {importResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer knoppen per stap */}
        <div style={s.footer}>
          {step === 1 && (
            <>
              <button style={s.btnSecondary} onClick={onClose}>Annuleren</button>
              <button style={s.btnPrimary} onClick={handleParse}>
                Volgende →
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button style={s.btnSecondary} onClick={() => setStep(1)}>← Terug</button>
              <button style={s.btnPrimary} onClick={handleReviewNext}>
                {unknownClubNames.length > 0 ? `Clubs oplossen (${unknownClubNames.length}) →` : 'Importeren →'}
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button style={s.btnSecondary} onClick={() => setStep(2)}>← Terug</button>
              <button style={s.btnPrimary} onClick={handleResolveNext}>
                Importeren →
              </button>
            </>
          )}
          {step === 4 && importResult?.success && (
            <button style={s.btnPrimary} onClick={onClose}>Sluiten</button>
          )}
          {step === 4 && importResult?.success === false && (
            <>
              <button style={s.btnSecondary} onClick={() => setStep(1)}>Opnieuw proberen</button>
              <button style={s.btnSecondary} onClick={onClose}>Sluiten</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
