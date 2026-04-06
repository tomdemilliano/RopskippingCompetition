# ARCHITECTURE.md — RopeScore Pro

Beschrijvend overzicht van de applicatie-architectuur. Dit bestand documenteert
hoe de app gebouwd is en waarom bepaalde keuzes gemaakt zijn.
Zie CLAUDE.md voor de imperatieve regels die altijd gevolgd moeten worden.

---

## Wat is RopeScore Pro?

RopeScore Pro is een wedstrijdbeheersysteem voor competitief touwspringen.
Het beheert wedstrijden, deelnemers, clubs en onderdelen, en biedt drie views:
- **Beheer** — wedstrijden en deelnemers aanmaken, CSV-import, aanwezigheid
- **Live** — operatorscherm tijdens een actieve wedstrijd (reeksen markeren)
- **Display** — groot scherm voor in de zaal (toont huidige en volgende reeks)

Primaire gebruiker: Antwerp Ropes. De app is gebouwd voor gebruik op een laptop
of tablet door een wedstrijdleider, met het displayscherm op een tweede monitor.

---

## Stack

| Laag        | Technologie                          |
|-------------|--------------------------------------|
| Frontend    | React 18, Vite, Pages-gebaseerde routing (geen React Router) |
| Styling     | Inline CSS via stijlobjecten — geen Tailwind, geen CSS modules |
| Database    | Firebase Firestore (NoSQL, realtime) |
| Auth        | Firebase Anonymous Auth              |
| Storage     | Firebase Storage (club-logo's)       |
| Hosting     | Vercel                               |
| Taal        | Nederlands (alle UI-strings)         |

---

## Mappenstructuur

```
src/
  App.jsx                          # Dunne shell: auth, routing, klok
  AppContext.jsx                   # Centrale React context: data + actions
  dbSchema.js                      # ENIGE toegangspunt voor Firestore
  constants.js                     # APP_ID, getFirebaseConfig
  seedData.js                      # Éénmalige seed voor events + competitionTypes
  index.css                        # Tailwind base (minimaal gebruikt)
  main.jsx                         # React entry point

  components/
    ManagementView.jsx              # Beheerscherm orchestrator
    LiveView.jsx                    # Operatorscherm live wedstrijd
    DisplayView.jsx                 # Zaalscherm live wedstrijd

    management/
      CompetitionList.jsx           # Linkerkolom: tabs + wedstrijdkaartjes
      CompetitionDetail.jsx         # Rechterkolom: events + deelnemerslijst

      modals/
        modalStyles.js              # Gedeelde stijlen voor alle modals
        AddCompetitionModal.jsx
        EditCompetitionModal.jsx
        EditParticipantModal.jsx
        ImportModal.jsx             # CSV-import met club-matching flow

  admin/
    seed-main.jsx                   # Standalone Firebase init voor seed-pagina
    SeedPage.jsx                    # UI voor het uitvoeren van de seed

seed.html                          # Standalone HTML entry point voor seed-pagina
```

---

## Datamodel (Firestore)

Alle collecties leven onder `artifacts/{appId}/public/data/`.

### Collecties

```
settings/competition          singleton — activeCompetitionId
settings/progress             singleton — finishedEvents[], finishedSeries{}
competitionTypes/{id}         wedstrijdtypes met standaard event-volgorde
events/{id}                   globale lijst van beschikbare onderdelen
clubs/{id}                    clubs met logo-referentie
competitions/{id}             wedstrijden
competitions/{id}/
  participants/{id}           deelnemers per wedstrijd (subcollectie)
```

### Sleuteldocumenten

**`competition/{id}`**
```
name, date, location, typeId → competitionTypes, status, eventOrder{}, createdAt
```

**`participant/{id}`**
```
name, clubId → clubs, externalId ("{name}_{clubId}"), isPresent, entries[], createdAt
```

**`entry` (embedded object in participant.entries[])**
```
eventId → events, seriesNr, fieldNr, scheduledTime "HH:MM", isScratched
```

### Afgeleide properties (nooit opgeslagen)

```js
isScratchedFromEvent(participant, eventId) → boolean
isFullyScratched(participant)              → boolean  // alle entries isScratched
sortedEntries(participant)                 → Entry[]
```

---

## Datalaag

De datalaag bestaat uit drie lagen in `dbSchema.js`:

```
Path helpers   → Firestore-paden als functies (intern)
Converters     → fromFirestore() en toFirestore() per entiteit
Factories      → benoemde lees/schrijf-operaties (geëxporteerd)
```

Geëxporteerde factories:
- `settingsFactory` — activeCompetitionId, progress
- `competitionTypeFactory` — CRUD + subscribe
- `eventFactory` — CRUD + subscribe
- `clubFactory` — CRUD + subscribe + findByName (fuzzy matching)
- `competitionFactory` — CRUD + setStatus + saveEventOrder
- `participantFactory` — subscribe + setPresence + setScratchedForEvent/All + importBatch

---

## State management

`AppContext.jsx` is de enige bron van waarheid voor app-state.

```
authReady / authError          Firebase auth status
competitions, events,          Realtime Firestore listeners
clubs, competitionTypes        (starten zodra auth klaar is)
participants                   Per wedstrijd geladen via loadParticipants()
activeCompetitionId            Uit settings/competition
finishedEvents, finishedSeries Uit settings/progress
```

Afgeleide waarden worden berekend in de context via `useMemo` en `useCallback`:
- `getSortedEvents(competition)` — events gesorteerd op eventOrder
- `getClub(clubId)` — club opzoeken op id
- `getEvent(eventId)` — event opzoeken op id
- `activeCompetition` — afgeleid van competitions + activeCompetitionId

Actions (schrijfoperaties) worden als functies uit de context geëxporteerd.
Componenten roepen nooit rechtstreeks factories of Firestore aan.

---

## CSV-import flow

De `ImportModal` doorloopt vier stappen:

1. **Paste** — gebruiker plakt CSV-tekst
2. **Review** — geparseerde rijen getoond, onbekende clubs gemarkeerd
3. **Resolve** — per onbekende club: koppel aan bestaande of maak nieuwe aan
   - Fuzzy matching (Levenshtein ≤ 2) suggereert mogelijke duplicaten
   - Nieuwe clubs worden aangemaakt vóór de batch-import
4. **Import** — `participantFactory.importBatch()` schrijft alle rijen in één batch

Matching van bestaande deelnemers verloopt via `externalId = "{name}_{clubId}"`.

CSV-formaat speed:
```
reeks,uur,skipper_veld1,club_veld1,skipper_veld2,club_veld2,...
```

CSV-formaat freestyle:
```
reeks,uur,veld,skipper,club
```

---

## Live voortgang

De voortgang van een actieve wedstrijd wordt bijgehouden in `settings/progress`:
- `finishedEvents: string[]` — eventIds volledig afgewerkt
- `finishedSeries: { [eventId]: number[] }` — seriesNrs afgewerkt per event

`LiveView` gebruikt deze data om de operator-cursor te initialiseren.
`DisplayView` volgt dezelfde data volledig autonoom om het officiële scherm te tonen.

---

## Seed

De `events` en `competitionTypes` collecties worden éénmalig gevuld via `seedData.js`.
De seed is idempotent — bestaande documenten worden niet aangeraakt.
Na de seed is `constants.js` enkel nog nodig voor `APP_ID` en `getFirebaseConfig`.
De seed-pagina is bereikbaar via `/seed.html` (Vite multi-entry).
