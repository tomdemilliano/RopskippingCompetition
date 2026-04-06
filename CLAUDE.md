# CLAUDE.md — RopeScore Pro

Imperatieve regels voor AI-geassisteerde ontwikkeling.
Volg deze regels altijd, zonder uitzondering.
Zie ARCHITECTURE.md voor de beschrijvende architectuuroverzicht.

---

## Absolute regels

### DB-toegang — altijd via dbSchema.js

**Importeer NOOIT rechtstreeks uit `firebase/firestore` in een component of pagina.**

```js
// ✅ Correct
import { competitionFactory } from '../dbSchema';
await competitionFactory.update(id, data);

// ❌ Verboden
import { updateDoc, doc } from 'firebase/firestore';
await updateDoc(doc(db, 'competitions', id), data);
```

Alle Firestore-toegang verloopt via de factories in `dbSchema.js`.
Nieuwe operaties worden als benoemde functies aan de juiste factory toegevoegd.
Schrijf nooit Firestore-paden als literale strings buiten `dbSchema.js`.

### State lezen — altijd via AppContext

**Componenten lezen data via `useAppContext()`, nooit via directe factory-calls.**

```js
// ✅ Correct
const { competitions, getClub } = useAppContext();

// ❌ Verboden in een component
const clubs = await clubFactory.getAll();
```

Schrijfoperaties (actions) verlopen ook via de context:

```js
// ✅ Correct
const { createCompetition } = useAppContext();
await createCompetition(formData);

// ❌ Verboden in een component
await competitionFactory.create(formData);
```

---

## Naamgevingsconventies

### Firestore-velden
- Veldnamen: `camelCase`
- ID-velden: `id` (eigen doc-id), `{entity}Id` voor referenties (`clubId`, `typeId`)
- Booleans: prefix `is` of `has` (`isPresent`, `isScratched`)
- Datums: ISO-string `"YYYY-MM-DD"`, tijden: `"HH:MM"`
- Status: Nederlandse string enum (`"open"` | `"bezig"` | `"beëindigd"`)

### Bestanden
- `.js` voor pure logica zonder JSX (`dbSchema.js`, `constants.js`, `modalStyles.js`)
- `.jsx` voor React-componenten
- ComponentNamen: `PascalCase`
- Hulpfuncties en hooks: `camelCase`

### Variabelen
- Firestore document-id's: altijd Firestore auto-id's — nooit namen of omschrijvingen als sleutel
- `externalId` op participant: `"{name}_{clubId}"` — voor CSV-matching

---

## Styling

- Altijd inline CSS via stijlobjecten — geen Tailwind utility classes, geen CSS modules
- Stijlobjecten bovenaan het bestand definiëren als `const s = { ... }`
- Dynamische stijlen als functies: `card: (active) => ({ background: active ? ... : ... })`
- Geen externe stijlbestanden per component — gedeelde stijlen in `modalStyles.js`
- Kleurenpalet: lichtblauw (`#2563eb`), groen (`#10b981`), rood (`#ef4444`), grijs (`#94a3b8`, `#64748b`)
- Donker achtergrond voor Display view (`#0f172a`)

---

## UI-taal

Alle zichtbare tekst in de UI is **Nederlands**.
Technische code (variabelenamen, commentaar, commits) is **Engels**.

```js
// ✅ Correct
<button>Aanmaken</button>          // UI: Nederlands
const isPresent = true;            // Code: Engels

// ❌ Verboden
<button>Create</button>            // UI mag niet Engels zijn
const isAanwezig = true;           // Code mag niet Nederlands zijn
```

---

## Datamodel — belangrijke regels

### Schrap-status
- `isScratched` leeft **alleen** op entry-niveau (`participant.entries[].isScratched`)
- Er is **geen** `isScratched` of `eventStatus` op participant-niveau
- `isFullyScratched(participant)` is een afgeleide helper — nooit opslaan

```js
// ✅ Correct — gebruik de helper
const { isFullyScratched } = useAppContext();
if (isFullyScratched(participant)) { ... }

// ❌ Verboden — sla dit niet op in Firestore
await updateDoc(ref, { isScratched: true });
```

### Entries array
- Elke deelnemer heeft een `entries[]` array — één entry per event
- Entry-velden: `eventId`, `seriesNr`, `fieldNr`, `scheduledTime`, `isScratched`
- Gebruik `normalizeEntry()` in `dbSchema.js` bij het aanmaken van entries

### Referenties
- `competition.typeId` → `competitionTypes/{id}`
- `participant.clubId` → `clubs/{id}`
- `entry.eventId` → `events/{id}`
- Sla **nooit** namen op als referentie — altijd Firestore-ID's

---

## Componentregels

- Geen `<form>` elementen — gebruik `onClick` handlers
- Geen directe Firebase SDK imports in componenten of pagina's
- Modals krijgen altijd een `onClose` prop
- Modals slaan lokale state op en schrijven pas bij submit naar Firestore

---

## Nieuwe features toevoegen

Bij het toevoegen van een nieuwe Firestore-operatie:
1. Voeg een path helper toe aan `paths` in `dbSchema.js`
2. Voeg een converter toe indien het een nieuwe entiteit is
3. Voeg een factory-methode toe met JSDoc
4. Voeg een action toe aan `AppContext.jsx`
5. Gebruik de action in het component via `useAppContext()`

Bij het toevoegen van een nieuw collectie-veld:
1. Voeg het toe aan de `fromFirestore` converter (met fallback `?? ''`)
2. Voeg het toe aan de `toFirestore` converter indien schrijfbaar
3. Update `ARCHITECTURE.md`

---

## Wat niet mag

| Verboden                                      | Alternatief                          |
|-----------------------------------------------|--------------------------------------|
| `import { doc } from 'firebase/firestore'`    | Gebruik een factory uit `dbSchema.js` |
| Namen als Firestore-sleutels                  | Gebruik Firestore auto-id's           |
| `isScratched` op participant-niveau opslaan   | Gebruik `entries[].isScratched`       |
| `eventStatus` object op participant           | Afgeleid via `isScratchedFromEvent()` |
| Tailwind utility classes                      | Inline CSS stijlobjecten              |
| Engelse UI-strings                            | Nederlandse UI-strings                |
| `<form>` elementen                            | `onClick` handlers                    |
| Directe state-mutatie van Firestore-data      | Actions via AppContext                |
