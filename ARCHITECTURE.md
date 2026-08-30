# ARCHITECTURE.md — SkipFlow

Beschrijvend overzicht van de applicatie-architectuur. Dit bestand documenteert
hoe de app gebouwd is en waarom bepaalde keuzes gemaakt zijn.
Zie CLAUDE.md voor de imperatieve regels die altijd gevolgd moeten worden.

---

## Wat is SkipFlow?

SkipFlow is een wedstrijdbeheersysteem voor competitief touwspringen.
Het beheert wedstrijden, deelnemers, clubs en onderdelen. Na het inloggen komt
elke gebruiker op de landingspagina (`/`, `HubView`) terecht — een tegeloverzicht
dat enkel de schermen toont waar het account recht op heeft. Elk scherm heeft
daarna zijn eigen route en een eigen recht (zie "Authenticatie & rechten"):

| Scherm       | Route            | Recht          | Doel |
|--------------|-------------------|----------------|------|
| *(landingspagina)* | `/`         | ingelogd       | tegeloverzicht — enige plek waarvandaan tussen schermen genavigeerd wordt |
| Beheer       | `/beheer`         | beheerder-only | wedstrijden en deelnemers aanmaken, CSV-import, clubs, blokken, gebruikers |
| Aanwezigheid | `/aanwezigheid`   | `aanwezigheid` | aanwezigheidsregistratie aan de inkomtafel — wedstrijdkeuze, zoeken, clubfilter, aanmelden/afwezig melden |
| Speaker      | `/speaker`        | `speaker`      | operatorscherm tijdens een actieve wedstrijd (reeksen markeren) |
| Display      | `/scherm`         | `backstage`    | groot scherm voor in de opwarmruimte (toont huidige en volgende reeks) |
| Podium       | `/scherm/podium`  | `podium`       | podium-onthulling voor de prijsuitreiking (Fase 3 — nu nog een placeholder) |

De Speaker- en Display-tegels op de landingspagina tonen altijd of, en welke,
wedstrijd er live staat (`activeCompetition` uit `AppContext`) — zo is meteen
duidelijk vanaf elk toestel of er iets bezig is, zonder het scherm te openen.

Primaire gebruiker: Antwerp Ropes. De app is gebouwd voor gebruik op meerdere
toestellen tegelijk (inkomtafel, speakertafel, groot scherm), elk met een eigen
login en enkel toegang tot de schermen waar dat account recht op heeft.

---

## Stack

| Laag        | Technologie                          |
|-------------|--------------------------------------|
| Frontend    | React 18, Vite, `react-router-dom` (hash-routing — geen server-rewrites nodig op Vercel) |
| Styling     | Inline CSS via stijlobjecten, opgebouwd uit `theme.js`-tokens — geen Tailwind, geen CSS modules |
| Database    | Firebase Firestore (NoSQL, realtime) |
| Auth        | Firebase Auth, e-mail/wachtwoord — rollen + rechten in `users/{uid}` |
| Storage     | Firebase Storage — clublogo's (`clubs/{clubId}/logo.*`) via `clubFactory.uploadLogo()` |
| Hosting     | Vercel                               |
| Taal        | Nederlands (alle UI-strings)         |

---

## Mappenstructuur

```
src/
  App.jsx                          # Router-shell: auth-gate, routes + permissie-guards, klok, home-link
  AppContext.jsx                   # Centrale React context: data + actions
  dbSchema.js                      # ENIGE toegangspunt voor Firestore
  constants.js                     # APP_ID, getFirebaseConfig, emailForUsername
  seedData.js                      # Éénmalige seed voor events + competitionTypes
  theme.js                         # Design tokens: color, radius, shadow, font, space, statusColor
  index.css                        # Fontinstelling + minimale resets (geen Tailwind)
  main.jsx                         # React entry point

  components/
    LoginView.jsx                  # Inlogscherm — vóór elk ander scherm
    HubView.jsx                    # Landingspagina ("/") — tegels naar elk scherm met toegang
    ManagementView.jsx              # Beheerscherm orchestrator (wedstrijden + clubs + gebruikers)
    LiveView.jsx                    # Speaker — operatorscherm live wedstrijd
    DisplayView.jsx                 # Groot scherm (backstage) live wedstrijd
    AttendanceView.jsx              # Aanwezigheidsregistratie — kiosk voor de inkomtafel
    PodiumView.jsx                  # Podium-onthulling (Fase 3 — placeholder)

    ui/
      Button.jsx                   # Gedeelde knop (variant/size/icon), gebouwd uit theme.js
      Card.jsx                     # Gedeelde kaartcontainer
      Badge.jsx                    # Statuslabel/pill (tone + optioneel icoon)

    management/
      CompetitionsOverview.jsx      # Startpagina van Beheer — lijst van alle wedstrijden
      CompetitionDetail.jsx         # Events + programma (blocks) + deelnemerslijst
      ClubManagement.jsx            # Clubbeheer — stamdata + logo-upload (Storage)
      UserManagement.jsx            # Gebruikersbeheer — rollen + rechten toekennen

      modals/
        modalStyles.js              # Gedeelde stijlen voor alle modals, gebouwd uit theme.js
        AddCompetitionModal.jsx
        EditCompetitionModal.jsx
        EditParticipantModal.jsx
        ImportModal.jsx             # CSV-import met club-matching flow

  admin/
    seed-main.jsx                   # Standalone Firebase init voor seed-pagina
    SeedPage.jsx                    # Seed van events/competitionTypes + bootstrap eerste beheerder

seed.html                          # Standalone HTML entry point voor seed-pagina
firestore.rules                    # Referentie-security-rules — niet auto-gedeployed (zie bestand)
```

---

## Datamodel (Firestore)

Alle collecties leven onder `artifacts/{appId}/public/data/`.

### Collecties

```
settings/competition          singleton — activeCompetitionId
users/{uid}                   gebruikers + rechten (doc-id = Firebase Auth uid)
competitionTypes/{id}         wedstrijdtypes met standaard event-volgorde
events/{id}                   globale lijst van beschikbare onderdelen
clubs/{id}                    clubs met logo-referentie
competitions/{id}             wedstrijden — incl. finishedEvents/finishedSeries
competitions/{id}/
  participants/{id}           deelnemers per wedstrijd (subcollectie)
  blocks/{id}                 dagtijdlijn: blok → onderdeel (optioneel) → reeks (subcollectie)
```

### Sleuteldocumenten

**`competition/{id}`**
```
name, date, location, typeId → competitionTypes, status, eventOrder{},
finishedEvents[], finishedSeries{}, createdAt
```
`finishedEvents`/`finishedSeries` leven bewust hier en niet in een los
singleton — zie "Live voortgang" hieronder.

**`participant/{id}`**
```
name, clubId → clubs, externalId ("{name}_{clubId}"), isPresent, entries[], createdAt
```

**`entry` (embedded object in participant.entries[])**
```
eventId → events, seriesNr, fieldNr, scheduledTime "HH:MM", isScratched
```

**`block/{id}`** (subcollectie van competition — zie "Dagtijdlijn (blocks)")
```
type ("heats" | "pauze" | "lunchpauze" | "deuren" | "briefing" | "proefjury" | "prijsuitreiking"),
eventId → events (enkel bij type "heats"), label (bij niet-heats types),
scheduledTime "HH:MM", order, status ("gepland" | "actief" | "afgewerkt")
```

**`user/{uid}`**
```
username, role ("beheerder" | "medewerker"),
permissions { speaker, backstage, podium, aanwezigheid } (enkel relevant voor medewerker),
createdAt
```

### Afgeleide properties (nooit opgeslagen)

```js
isScratchedFromEvent(participant, eventId) → boolean
isFullyScratched(participant)              → boolean  // alle entries isScratched
sortedEntries(participant)                 → Entry[]
hasPermission(user, key)                   → boolean  // beheerder = altijd true
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
- `settingsFactory` — activeCompetitionId
- `userFactory` — CRUD + subscribe (lijst) + subscribeOne (eigen profiel) + getAll
- `competitionTypeFactory` — CRUD + subscribe
- `eventFactory` — CRUD + subscribe
- `clubFactory` — CRUD + subscribe + findByName (fuzzy matching) + uploadLogo (Storage)
- `competitionFactory` — CRUD + setStatus + saveEventOrder + saveProgress
- `participantFactory` — subscribe + setPresence + setScratchedForEvent/All + importBatch
- `blockFactory` — CRUD + subscribe + setStatus

`dbSchema.js` raakt Firestore én Firebase Storage aan (`clubFactory.uploadLogo`)
maar nooit Firebase Auth — het aanmaken en inloggen van gebruikers gebeurt in
`AppContext.jsx` (zie hieronder), want dat vereist Auth-SDK-calls
(`signInWithEmailAndPassword`, een tijdelijke secundaire app-instantie om
nieuwe accounts aan te maken) die niets met Firestore/Storage te maken hebben.
`initDb(db, appId, storage)` krijgt de Storage-instantie mee vanuit
`AppContext.jsx`, dezelfde plek waar ook Firestore en Auth geïnitialiseerd
worden — één Firebase-app-instantie voor alles.

---

## Authenticatie & rechten

Firebase Auth met e-mail/wachtwoord (geen anonieme auth meer in de hoofd-app —
`/seed.html` blijft wel anoniem inloggen voor zijn eigen, losstaande seed-taak).
Een `username` wordt intern vertaald naar een synthetisch e-mailadres
(`{username}@ropescore.pro.local`), zodat het inlogscherm gewoon een
gebruikersnaam + wachtwoord toont.

- **`beheerder`** — heeft altijd overal recht op, kan gebruikers aanmaken en
  rechten toekennen (via Gebruikersbeheer in Beheer), en is de enige rol die
  `/beheer` mag openen.
- **`medewerker`** — heeft enkel recht op de schermen die expliciet aangevinkt
  staan in `permissions` (`speaker`, `backstage`, `podium`, `aanwezigheid`).

Een nieuwe gebruiker aanmaken gebeurt via een **tijdelijke, secundaire
Firebase-app-instantie** in de browser (`AppContext.createUser`):
`createUserWithEmailAndPassword` logt anders automatisch in als het nieuwe
account, wat de sessie van de beheerder die de aanmaak doet zou verstoren.
Geen Cloud Function nodig — blijft dus binnen de "geen backend"-architectuur.

**Bootstrap van de allereerste beheerder**: er is bewust géén uitzondering in
de security rules die een gloednieuw account zichzelf beheerder laat maken
(dat zou elk Firebase Auth-account, ook eentje buiten de app aangemaakt, een
achterpoortje geven). De eerste beheerder wordt daarom éénmalig aangemaakt via
`/seed.html`, en het bijhorende Firestore-profiel wordt — als de security
rules al strikt staan — handmatig toegevoegd via de Firebase Console (de
seed-pagina toont de juiste uid en velden). Zie `firestore.rules` voor de
volledige uitleg en de eigenlijke rules (niet automatisch gedeployed door dit
repo — er is geen `firebase.json`/`.firebaserc`).

Routing (`App.jsx`) hangt elke route achter een guard:
- `/beheer` → `RequireAdmin` (enkel `role === 'beheerder'`)
- `/aanwezigheid`, `/speaker`, `/scherm`, `/scherm/podium` → `RequirePermission`
  op de bijhorende key uit de tabel bovenaan dit document

Zonder het recht toont de route een "Geen toegang"-scherm i.p.v. de inhoud.
De landingspagina (`HubView`) toont enkel tegels voor de schermen waar de
ingelogde gebruiker effectief recht op heeft — de guards in `App.jsx` blijven
de eigenlijke bewaking (rechtstreeks naar een URL navigeren zonder recht
toont alsnog "Geen toegang").

---

## State management

`AppContext.jsx` is de enige bron van waarheid voor app-state.

```
authReady                       Firebase geïnitialiseerd + auth-status gecontroleerd
authError                       Firebase-initialisatiefout
currentUser                     Firebase Auth user object, of null
userProfile                     users/{uid}-document van de ingelogde gebruiker
users                           Volledige gebruikerslijst — enkel geladen door
                                 het gebruikersbeheer-scherm via loadUsers()

competitions, events,           Realtime Firestore listeners
clubs, competitionTypes         (starten zodra currentUser bekend is)
participants                    Per wedstrijd geladen via loadParticipants()
blocks                          Per wedstrijd geladen via loadBlocks()
activeCompetitionId             Uit settings/competition
finishedEvents, finishedSeries  Afgeleid van activeCompetition (zie "Live voortgang")
```

Afgeleide waarden worden berekend in de context via `useMemo` en `useCallback`:
- `getSortedEvents(competition)` — events gesorteerd op eventOrder
- `getClub(clubId)` — club opzoeken op id
- `getEvent(eventId)` — event opzoeken op id
- `activeCompetition` — afgeleid van competitions + activeCompetitionId
- `hasPermission(key)` — afgeleid van userProfile

Actions (schrijfoperaties) worden als functies uit de context geëxporteerd.
Componenten roepen nooit rechtstreeks factories, Firestore of Firebase Auth aan.

**Belangrijk voor nieuwe schermen**: `LiveView` en `DisplayView` roepen zelf
`loadParticipants(activeCompetition?.id)` en `loadBlocks(activeCompetition?.id)`
aan zodra ze mounten — ze vertrouwen daarvoor niet op `CompetitionDetail` in
Beheer. Elk scherm heeft nu immers zijn eigen route en kan rechtstreeks
geopend worden zonder eerst via Beheer te zijn gepasseerd; zonder deze eigen
listener zou zo'n scherm leeg blijven.

---

## Routing

`react-router-dom` met `HashRouter` (geen server-side rewrites nodig op
Vercel). `/`, `/beheer`, `/aanwezigheid` en `/speaker` delen een `ShellLayout`
(header met logo/home-link + klok + gebruiker/logout, `<Outlet/>` voor de
inhoud). De header bevat bewust géén kruis-scherm navigatieknoppen meer —
navigeren tussen schermen gebeurt uitsluitend via de tegels op de
landingspagina (`/`, `HubView`); de home-link in de header brengt je daar
altijd naar terug. `/scherm` en `/scherm/podium` zijn fullscreen, zonder
header, met een eigen "terug naar overzicht"-knop die naar `/` navigeert.
Een onbekend pad valt terug op `/`.

Binnen Beheer (`ManagementView`) geldt dezelfde regel: de knoppen om naar
Aanwezigheid, Speaker, Display of Podium te gaan staan daar niet — dat kan
vanaf de landingspagina. De sectie-tabs (Wedstrijden/Clubs/Gebruikers)
zijn geen "andere schermen" maar subsecties van Beheer zelf en blijven dus
gewoon zichtbaar.

---

## Design systeem (`theme.js` + UI-kit)

Alle styling blijft inline stijlobjecten per CLAUDE.md — geen Tailwind, geen
CSS modules — maar bouwt voortaan op gedeelde tokens in `theme.js` in plaats
van losse hexcodes te herhalen in elk bestand:

```
color        merkkleuren (primary/success/danger/warning/info) + neutralen
             (ink/body/muted/faint/border/surface/bg) + donkere "stage"-tokens
             voor Display/Podium/Login (stage/stageAlt/stageInk/stageMuted)
radius       sm/md/lg/xl/pill
shadow       sm/md/lg + focus(kleur) voor een gekleurde focus-ring
font         body (Inter) en mono (IBM Plex Mono) — daadwerkelijk geladen
             via Google Fonts in index.html
space        herbruikbare spacing-stappen
statusColor  kleur per wedstrijdstatus (open/bezig/beëindigd)
```

Drie gedeelde componenten in `components/ui/` bouwen op deze tokens:
`Button` (variant/size/icon), `Card` en `Badge` (tone + optioneel icoon).
Beheer-schermen en de landingspagina gebruiken deze consequent; Display/
Podium/Login gebruiken vooral de kleur- en fonttokens rechtstreeks (eigen,
donkere layout — geen kandidaat voor de lichte Button/Badge-stijl).

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

PDF-import (Fase 2) hergebruikt dit stramien met een nieuwe stap 0 ervoor
(PDF → geparseerde rijen); zie ARCHITECTURE-blueprint voor het volledige plan.

---

## Dagtijdlijn (`blocks`)

Vervangt de vroegere `PAUZE_`-naamhack (een nep-deelnemer om een pauze te
markeren — bestond enkel nog in de intussen verwijderde `App_old.jsx`) door
een eerste-klas schema-item: `competitions/{id}/blocks/{id}`.

- **`type: "heats"`** — het blok verwijst naar een `eventId`; de reeksen zelf
  blijven volledig afgeleid uit `participant.entries[]` (gegroepeerd op
  `eventId` + `seriesNr`) — er is geen apart heat-document.
- **elk ander type** (`pauze`, `lunchpauze`, `deuren`, `briefing`,
  `proefjury`, `prijsuitreiking`) — geen `eventId`, wel een `label`.

Eén onderdeel kan best meerdere blokken hebben (bv. Freestyles onderbroken
door twee pauzes): elk blok heeft dan hetzelfde `eventId`, met een pauze-blok
ertussenin — de reeksnummering loopt gewoon door.

`LiveView` en `DisplayView` bepalen het "huidige blok" als het eerste blok
(gesorteerd op `order`) met `status !== 'afgewerkt'`. Is dat een niet-heats
blok, dan tonen beide schermen een generiek pauzescherm (label uit
`BLOCK_TYPE_LABELS` of het blok se eigen `label`) i.p.v. de reeksen-UI; de
speaker kan het blok afsluiten via `setBlockStatus(..., 'afgewerkt')`, wat
automatisch het volgende blok in de tijdlijn actief maakt.

`CompetitionDetail` (Beheer) heeft een minimale "Programma"-sectie om blokken
manueel te beheren (nodig zolang PDF-import — dat blokken automatisch zal
aanmaken — er nog niet is).

---

## Live voortgang

De voortgang van een wedstrijd (`finishedEvents`, `finishedSeries`) leeft op
het `competition`-document zelf, niet in een los `settings/progress`-singleton
zoals voorheen. Reden: dat singleton werd bij elke `startCompetition()`
onvoorwaardelijk gereset — inclusief bij het **hervatten** van een wedstrijd
die met `stopCompetitionLive()` gepauzeerd was, wat toen alle voortgang wiste.
Nu heeft elke wedstrijd gewoon haar eigen, permanente voortgangsvelden
(`[]`/`{}` bij aanmaak), en hervatten verliest niets meer.

`LiveView` gebruikt deze data om de operator-cursor te initialiseren.
`DisplayView` volgt dezelfde data volledig autonoom om het officiële scherm te tonen.

---

## Seed

De `events` en `competitionTypes` collecties worden éénmalig gevuld via `seedData.js`.
De seed is idempotent — bestaande documenten worden niet aangeraakt.
Na de seed is `constants.js` enkel nog nodig voor `APP_ID` en `getFirebaseConfig`.
De seed-pagina is bereikbaar via `/seed.html` (Vite multi-entry) en bevat ook
de eenmalige bootstrap van de eerste beheerder (zie "Authenticatie & rechten").
