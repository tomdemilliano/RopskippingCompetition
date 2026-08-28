/**
 * SeedPage.jsx — RopeScore Pro
 *
 * Eénmalige admin-pagina om de Firestore-collecties `events` en
 * `competitionTypes` te seeden. Toegankelijk via /admin/seed.
 *
 * Na een succesvolle seed verdwijnt de knop en toont de pagina
 * de huidige staat van de collecties zodat je kan verifiëren.
 */

import React, { useState, useEffect } from 'react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { runSeed } from '../seedData';
import { eventFactory, competitionTypeFactory, userFactory } from '../dbSchema';
import { emailForUsername } from '../constants';

// ─────────────────────────────────────────────────────────────────────────────
// STYLES (inline — conform project-conventie)
// ─────────────────────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: 'sans-serif',
  },
  heading: {
    fontSize: '1.4rem',
    fontWeight: 900,
    color: '#1e293b',
    marginBottom: '0.25rem',
  },
  subheading: {
    fontSize: '0.85rem',
    color: '#64748b',
    marginBottom: '2rem',
  },
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    fontSize: '0.75rem',
    fontWeight: 900,
    color: '#94a3b8',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '1rem',
  },
  btn: (variant) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0.6rem 1.4rem',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: variant === 'disabled' ? 'not-allowed' : 'pointer',
    opacity: variant === 'disabled' ? 0.5 : 1,
    background:
      variant === 'primary' ? '#2563eb'
      : variant === 'danger'  ? '#ef4444'
      : '#f1f5f9',
    color:
      variant === 'primary' ? '#fff'
      : variant === 'danger'  ? '#fff'
      : '#475569',
  }),
  resultBox: (type) => ({
    padding: '1rem 1.25rem',
    borderRadius: '8px',
    border: '1px solid',
    borderColor:
      type === 'success' ? '#bbf7d0'
      : type === 'error'   ? '#fecaca'
      : '#fef08a',
    background:
      type === 'success' ? '#f0fdf4'
      : type === 'error'   ? '#fef2f2'
      : '#fefce8',
    color:
      type === 'success' ? '#166534'
      : type === 'error'   ? '#991b1b'
      : '#854d0e',
    fontSize: '0.85rem',
    marginTop: '1rem',
  }),
  stat: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '0.3rem 0.7rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#334155',
    marginRight: '0.5rem',
    marginBottom: '0.5rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.5rem 0.75rem',
    background: '#f8fafc',
    color: '#94a3b8',
    fontSize: '0.7rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid #f8fafc',
    color: '#334155',
  },
  badge: (type) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 700,
    background: type === 'freestyle' ? '#f0f7ff' : '#f0fdf4',
    color:      type === 'freestyle' ? '#2563eb' : '#166534',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const SeedPage = () => {
  const [seedState, setSeedState]       = useState('idle'); // idle | running | done | error
  const [seedResult, setSeedResult]     = useState(null);
  const [events, setEvents]             = useState([]);
  const [types, setTypes]               = useState([]);
  const [users, setUsers]               = useState([]);
  const [loadingData, setLoadingData]   = useState(true);

  // Beheerder-bootstrap
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminState,    setAdminState]    = useState('idle'); // idle | busy | done | manual | error
  const [adminError,    setAdminError]    = useState('');
  const [adminUid,      setAdminUid]      = useState('');

  // Laad huidige staat van de collecties
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingData(true);
      try {
        const [evts, typs, usrs] = await Promise.all([
          eventFactory.getAll(),
          competitionTypeFactory.getAll(),
          userFactory.getAll(),
        ]);
        if (!cancelled) {
          setEvents(evts);
          setTypes(typs);
          setUsers(usrs);
        }
      } catch (err) {
        console.error('SeedPage load error:', err);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [seedState, adminState]); // herlaad na elke seed-run en na een geslaagde beheerder-aanmaak

  const hasBeheerder = users.some(u => u.role === 'beheerder');

  const handleCreateAdmin = async () => {
    if (!adminUsername.trim() || adminPassword.length < 6) {
      setAdminError('Gebruikersnaam en een wachtwoord van minstens 6 tekens zijn verplicht.');
      return;
    }
    const email = emailForUsername(adminUsername);
    if (!email) {
      setAdminError('Ongeldige gebruikersnaam — gebruik minstens één letter of cijfer.');
      return;
    }
    setAdminState('busy');
    setAdminError('');
    try {
      // Stap 1: het Firebase Auth-account — altijd toegelaten, geen rechten nodig.
      const auth = getAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, adminPassword);
      setAdminUid(cred.user.uid);

      // Stap 2: het Firestore-profiel — vereist onder de echte security rules
      // (zie firestore.rules) al een bestaande beheerder, wat er bij de
      // allereerste nog niet is. We proberen het toch (werkt zolang je nog
      // met de standaard/open rules draait); lukt het niet, dan toont de UI
      // de manuele Console-stap met dit uid.
      try {
        await userFactory.create(cred.user.uid, {
          username: adminUsername.trim(),
          role: 'beheerder',
          permissions: { speaker: false, backstage: false, podium: false, aanwezigheid: false },
        });
        setAdminState('done');
      } catch {
        setAdminState('manual');
      }
    } catch (err) {
      setAdminError(
        err.code === 'auth/email-already-in-use'
          ? 'Deze gebruikersnaam bestaat al.'
          : (err.message ?? 'Aanmaken mislukt.')
      );
      setAdminState('error');
    }
  };

  const handleSeed = async () => {
    setSeedState('running');
    setSeedResult(null);
    const result = await runSeed();
    setSeedResult(result);
    setSeedState(result.success ? 'done' : 'error');
  };

  const isAlreadySeeded =
    events.length >= 14 && types.length >= 7;

  const nothingToDo =
    seedResult?.eventsCreated === 0 && seedResult?.typesCreated === 0;

  // Helper: zoek event-naam op id
  const eventNameById = Object.fromEntries(events.map(e => [e.id, e.name]));

  return (
    <div style={s.page}>
      <div style={s.heading}>Database seed</div>
      <div style={s.subheading}>
        Vul de collecties <code>events</code> en <code>competitionTypes</code> éénmalig
        met basisdata. Veilig om meerdere keren te draaien — bestaande documenten
        worden niet aangeraakt.
      </div>

      {/* ── Huidige staat ── */}
      <div style={s.card}>
        <div style={s.cardTitle}>Huidige staat</div>

        {loadingData ? (
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Laden…</div>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <span style={s.stat}>
                {events.length === 0 ? '—' : '✓'} {events.length} events
              </span>
              <span style={s.stat}>
                {types.length === 0 ? '—' : '✓'} {types.length} wedstrijdtypes
              </span>
              <span style={s.stat}>
                {hasBeheerder ? '✓' : '—'} {users.length} gebruikers
              </span>
            </div>

            {isAlreadySeeded && seedState === 'idle' && (
              <div style={s.resultBox('success')}>
                De collecties zijn al gevuld. Je kan de seed opnieuw draaien
                om eventueel ontbrekende items toe te voegen.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Eerste beheerder ── */}
      {!loadingData && !hasBeheerder && (
        <div style={s.card}>
          <div style={s.cardTitle}>Eerste beheerder aanmaken</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
            Er bestaat nog geen beheerder-account. Zonder beheerder kan niemand
            inloggen in de app (die maakt op zijn beurt de rest van de gebruikers aan).
            Dit is de enige plek waar dat éénmalig, zonder ingelogde beheerder, kan.
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <input
              placeholder="Gebruikersnaam"
              value={adminUsername}
              onChange={e => setAdminUsername(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '0.85rem' }}
            />
            <input
              placeholder="Wachtwoord (min. 6 tekens)"
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '0.85rem' }}
            />
            <button
              style={s.btn(adminState === 'busy' ? 'disabled' : 'primary')}
              onClick={handleCreateAdmin}
              disabled={adminState === 'busy'}
            >
              {adminState === 'busy' ? '⏳ Bezig…' : '▶ Beheerder aanmaken'}
            </button>
          </div>
          {adminState === 'done' && (
            <div style={s.resultBox('success')}>
              Beheerder <strong>{adminUsername}</strong> aangemaakt — kan nu inloggen in de app.
            </div>
          )}
          {adminState === 'manual' && (
            <div style={s.resultBox('warning')}>
              <div style={{ marginBottom: '0.5rem' }}>
                Auth-account aangemaakt, maar het Firestore-profiel kon niet automatisch
                worden weggeschreven (de security rules staan dat terecht niet toe zonder
                bestaande beheerder). Voeg dit document handmatig toe via
                Firebase Console → Firestore Database → collectie <code>artifacts/ropescore-pro-v1/public/data/users</code>,
                document-id:
              </div>
              <div style={{ fontFamily: 'monospace', background: '#fff', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                {adminUid}
              </div>
              <div>met velden: <code>username: "{adminUsername}"</code>, <code>role: "beheerder"</code>,{' '}
                <code>permissions: {'{'}speaker:false, backstage:false, podium:false, aanwezigheid:false{'}'}</code>.
              </div>
            </div>
          )}
          {adminError && <div style={s.resultBox('error')}>{adminError}</div>}
        </div>
      )}

      {/* ── Seed-knop ── */}
      <div style={s.card}>
        <div style={s.cardTitle}>Seed uitvoeren</div>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Voegt toe: 14 onderdelen, 7 wedstrijdtypes.
          Bestaande items worden overgeslagen.
        </div>

        <button
          style={s.btn(seedState === 'running' ? 'disabled' : 'primary')}
          onClick={handleSeed}
          disabled={seedState === 'running'}
        >
          {seedState === 'running' ? '⏳ Bezig…' : '▶ Seed uitvoeren'}
        </button>

        {/* Resultaat */}
        {seedResult && (
          <div style={s.resultBox(seedResult.success ? (nothingToDo ? 'warning' : 'success') : 'error')}>
            {seedResult.success && nothingToDo && (
              <div>Niets toegevoegd — alle items bestonden al.</div>
            )}
            {seedResult.success && !nothingToDo && (
              <div>
                <strong>Klaar.</strong>
                {' '}Events aangemaakt: <strong>{seedResult.eventsCreated}</strong>
                {seedResult.eventsSkipped > 0 && `, overgeslagen: ${seedResult.eventsSkipped}`}.
                {' '}Types aangemaakt: <strong>{seedResult.typesCreated}</strong>
                {seedResult.typesSkipped > 0 && `, overgeslagen: ${seedResult.typesSkipped}`}.
              </div>
            )}
            {!seedResult.success && (
              <div><strong>Fout:</strong> {seedResult.error}</div>
            )}
            {seedResult.warnings.length > 0 && (
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                {seedResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── Overzicht events ── */}
      {events.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Events in Firestore ({events.length})</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Naam</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>ID</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ ...s.td, color: '#94a3b8', width: '40px' }}>{ev.sortOrder}</td>
                  <td style={{ ...s.td, fontWeight: 700 }}>{ev.name}</td>
                  <td style={s.td}>
                    <span style={s.badge(ev.scoringType)}>{ev.scoringType}</span>
                  </td>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {ev.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Overzicht competitionTypes ── */}
      {types.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Wedstrijdtypes in Firestore ({types.length})</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Naam</th>
                <th style={s.th}>Onderdelen</th>
                <th style={s.th}>ID</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td style={{ ...s.td, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.name}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {t.eventIds.map((eid) => (
                        <span
                          key={eid}
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                          }}
                        >
                          {eventNameById[eid] ?? eid}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {t.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SeedPage;
